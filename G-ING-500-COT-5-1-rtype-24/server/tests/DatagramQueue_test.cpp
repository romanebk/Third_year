#include "server/datagram_queues.hpp"

#include <asio/ip/address_v4.hpp>
#include <asio/ip/udp.hpp>
#include <chrono>
#include <cstdint>
#include <gtest/gtest.h>
#include <thread>
#include <vector>

namespace {

using Endpoint = asio::ip::udp::endpoint;

server::IncomingDatagram incoming(std::uint8_t value, std::uint16_t port = 4300)
{
    server::IncomingDatagram datagram;
    datagram.bytes = {value, static_cast<std::uint8_t>(value + 1)};
    datagram.from = Endpoint(asio::ip::make_address_v4("127.0.0.1"), port);
    return datagram;
}

server::OutgoingDatagram outgoing(std::uint8_t value, std::uint16_t port = 4300)
{
    server::OutgoingDatagram datagram;
    datagram.bytes = {value};
    datagram.to = Endpoint(asio::ip::make_address_v4("127.0.0.1"), port);
    return datagram;
}

} // namespace

TEST(DatagramQueues, IncomingKeepsArrivalOrder)
{
    server::DatagramQueues queues;
    queues.pushIncoming(incoming(1));
    queues.pushIncoming(incoming(2));
    queues.pushIncoming(incoming(3));

    const auto datagrams = queues.takeIncoming();
    ASSERT_EQ(datagrams.size(), 3u);
    EXPECT_EQ(datagrams[0].bytes[0], 1u);
    EXPECT_EQ(datagrams[1].bytes[0], 2u);
    EXPECT_EQ(datagrams[2].bytes[0], 3u);
    EXPECT_TRUE(queues.takeIncoming().empty());
}

TEST(DatagramQueues, OutgoingKeepsArrivalOrder)
{
    server::DatagramQueues queues;
    queues.pushOutgoing(outgoing(10, 4301));
    queues.pushOutgoing(outgoing(20, 4302));

    const auto datagrams = queues.takeOutgoing();
    ASSERT_EQ(datagrams.size(), 2u);
    EXPECT_EQ(datagrams[0].bytes[0], 10u);
    EXPECT_EQ(datagrams[0].to.port(), 4301);
    EXPECT_EQ(datagrams[1].bytes[0], 20u);
    EXPECT_EQ(datagrams[1].to.port(), 4302);
    EXPECT_TRUE(queues.takeOutgoing().empty());
}

TEST(DatagramQueues, IncomingQueueIsBoundedAndDropsTheOldest)
{
    server::DatagramQueues queues;
    for (std::size_t i = 0; i < server::DatagramQueues::kMaxIncoming; ++i) {
        EXPECT_TRUE(queues.pushIncoming(incoming(static_cast<std::uint8_t>(i))));
    }
    // One more datagram fits by dropping the oldest one.
    EXPECT_FALSE(queues.pushIncoming(incoming(200)));

    const auto datagrams = queues.takeIncoming();
    ASSERT_EQ(datagrams.size(), server::DatagramQueues::kMaxIncoming);
    EXPECT_EQ(datagrams.front().bytes[0], 1u);
    EXPECT_EQ(datagrams.back().bytes[0], 200u);
}

TEST(DatagramQueues, OutgoingQueueIsBoundedAndDropsTheOldest)
{
    server::DatagramQueues queues;
    for (std::size_t i = 0; i < server::DatagramQueues::kMaxOutgoing; ++i) {
        EXPECT_TRUE(queues.pushOutgoing(outgoing(static_cast<std::uint8_t>(i % 200))));
    }
    EXPECT_FALSE(queues.pushOutgoing(outgoing(201)));

    const auto datagrams = queues.takeOutgoing();
    ASSERT_EQ(datagrams.size(), server::DatagramQueues::kMaxOutgoing);
    EXPECT_EQ(datagrams.front().bytes[0], 1u);
    EXPECT_EQ(datagrams.back().bytes[0], 201u);
}

TEST(DatagramQueues, TwoThreadsCanExchangeDatagrams)
{
    server::DatagramQueues queues;
    constexpr std::size_t count = 500;

    std::thread producer([&queues] {
        for (std::size_t i = 0; i < count; ++i) {
            queues.pushIncoming(incoming(static_cast<std::uint8_t>(i % 250)));
        }
    });

    std::vector<std::uint8_t> received;
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
    while (received.size() < count && std::chrono::steady_clock::now() < deadline) {
        for (const auto &datagram : queues.takeIncoming()) {
            received.push_back(datagram.bytes[0]);
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    producer.join();

    EXPECT_EQ(received.size(), count);
}
