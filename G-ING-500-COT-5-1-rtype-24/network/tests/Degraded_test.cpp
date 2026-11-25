#include "network/handshake.hpp"
#include "network/reliable.hpp"

#include <asio/ip/address_v4.hpp>
#include <asio/ip/udp.hpp>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <gtest/gtest.h>
#include <random>
#include <string>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;
using Clock = net::ReliableQueue::Clock;
using Endpoint = asio::ip::udp::endpoint;

// Deterministic lossy link: the same seed always loses the same datagrams, so
// a failure is reproducible in CI.
class FlakyLink {
public:
    FlakyLink(unsigned seed, double loss) : _rng(seed), _loss(loss) {}

    [[nodiscard]] bool drops()
    {
        std::uniform_real_distribution<double> die(0.0, 1.0);
        return die(_rng) < _loss;
    }

    [[nodiscard]] int delayMs(int maxDelayMs)
    {
        std::uniform_int_distribution<int> delay(0, maxDelayMs);
        return delay(_rng);
    }

private:
    std::mt19937 _rng;
    double _loss;
};

Clock::time_point at(int milliseconds)
{
    return Clock::time_point{} + std::chrono::milliseconds(milliseconds);
}

Endpoint endpoint(std::uint16_t port)
{
    return Endpoint(asio::ip::address_v4::loopback(), port);
}

Bytes connectPacket(std::uint32_t roomInstance, const std::string &name)
{
    net::ConnectMsg message;
    message.lobbyToken = 0x1234;
    message.roomInstance = roomInstance;
    message.name = name;
    Bytes out;
    net::Writer writer(out, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::Connect, 1);
    EXPECT_TRUE(net::encode(message, writer));
    return out;
}

std::uint16_t seqOf(const Bytes &payload)
{
    return static_cast<std::uint16_t>(payload[0] | (payload[1] << 8));
}

Bytes payloadOf(std::uint16_t seq)
{
    return Bytes{static_cast<std::uint8_t>(seq & 0xFF), static_cast<std::uint8_t>(seq >> 8)};
}

} // namespace

TEST(DegradedNetwork, ConnectRetriesGetTheAcceptThroughALossyLink)
{
    net::Handshake handshake(1);
    const Endpoint client = endpoint(40000);
    const Bytes connect = connectPacket(1, "Momo");
    FlakyLink link(7, 0.3);

    Bytes reply;
    int acceptedAttempt = -1;
    for (int attempt = 0; attempt < 20; ++attempt) {
        if (link.drops()) {
            continue; // the CONNECT is lost
        }
        ASSERT_TRUE(handshake.handle(connect.data(), connect.size(), client, reply));
        ASSERT_FALSE(reply.empty());
        if (link.drops()) {
            reply.clear();
            continue; // the ACCEPT is lost, the client retries
        }
        acceptedAttempt = attempt;
        break;
    }

    ASSERT_GE(acceptedAttempt, 0);
    net::PacketHeader header;
    ASSERT_EQ(net::readHeader(reply.data(), reply.size(), header), net::HeaderStatus::Ok);
    EXPECT_EQ(header.type, net::MsgType::Accept);
    EXPECT_EQ(handshake.playerCount(), 1u); // lost replies did not duplicate the player
}

TEST(DegradedNetwork, ReliableEventsConvergeUnderLossAndReordering)
{
    constexpr std::uint16_t kEvents = 40;
    constexpr int kPublishEveryMs = 100;
    constexpr int kHorizonMs = 20000;

    net::ReliableQueue queue;
    net::ReliableReceiver receiver;
    FlakyLink link(2026, 0.3);

    struct InFlight {
        std::uint16_t eventSeq = 0;
        Bytes payload;
        int dueMs = 0;
    };

    std::vector<InFlight> air;
    std::vector<std::uint16_t> delivered;
    std::vector<Bytes> ready;
    std::vector<Bytes> due;
    std::uint16_t nextSeq = 1;
    std::uint16_t published = 0;
    std::size_t lost = 0;
    std::size_t retransmissions = 0;
    std::size_t outOfOrder = 0;

    for (int now = 0; now <= kHorizonMs && delivered.size() < kEvents; ++now) {
        if (published < kEvents && now == published * kPublishEveryMs) {
            const std::uint16_t eventSeq = nextSeq++;
            const Bytes payload = payloadOf(eventSeq);
            ASSERT_TRUE(queue.track(eventSeq, payload, at(now)));
            if (link.drops()) {
                ++lost;
            } else {
                air.push_back({eventSeq, payload, now + link.delayMs(250)});
            }
            ++published;
        }

        queue.collect(at(now), due);
        for (const auto &datagram : due) {
            ++retransmissions;
            if (link.drops()) {
                ++lost;
            } else {
                air.push_back({seqOf(datagram), datagram, now + link.delayMs(250)});
            }
        }
        due.clear();

        for (auto it = air.begin(); it != air.end();) {
            if (it->dueMs > now) {
                ++it;
                continue;
            }
            if (it->eventSeq != receiver.nextSeq()) {
                ++outOfOrder;
            }
            ready.clear();
            receiver.receive(it->eventSeq, it->payload, ready);
            for (const auto &payload : ready) {
                delivered.push_back(seqOf(payload));
            }
            it = air.erase(it);
        }

        queue.acknowledge(receiver.acknowledge());
        ASSERT_FALSE(queue.failed()) << "an event gave up at " << now << " ms";
    }

    ASSERT_EQ(delivered.size(), kEvents);
    for (std::size_t i = 0; i < delivered.size(); ++i) {
        EXPECT_EQ(delivered[i], static_cast<std::uint16_t>(i + 1)) << "event " << i;
    }
    EXPECT_EQ(receiver.acknowledge(), kEvents);
    EXPECT_EQ(queue.pending(), 0u);
    // The scenario must really degrade the link, otherwise it proves nothing.
    EXPECT_GT(lost, 0u);
    EXPECT_GT(retransmissions, 0u);
    EXPECT_GT(outOfOrder, 0u);
}
