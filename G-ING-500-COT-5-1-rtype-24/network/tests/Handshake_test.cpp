#include "network/handshake.hpp"

#include <asio/ip/address_v4.hpp>
#include <asio/ip/udp.hpp>
#include <cstdint>
#include <gtest/gtest.h>
#include <string>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;
using Endpoint = asio::ip::udp::endpoint;

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
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Connect, 1);
    EXPECT_TRUE(net::encode(message, w));
    return out;
}

Bytes pingPacket(std::uint32_t clientTimeMs)
{
    net::PingMsg message;
    message.clientTimeMs = clientTimeMs;
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Ping, 1);
    EXPECT_TRUE(net::encode(message, w));
    return out;
}

Bytes inputPacket()
{
    net::InputMsg message;
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Input, 1);
    EXPECT_TRUE(net::encode(message, w));
    return out;
}

template <typename Msg>
bool decodeReply(const Bytes &reply, net::MsgType expected, Msg &out)
{
    net::PacketHeader header;
    if (net::readHeader(reply.data(), reply.size(), header) != net::HeaderStatus::Ok) {
        return false;
    }
    if (header.type != expected) {
        return false;
    }
    net::Reader r(reply.data() + net::kHeaderSize, reply.size() - net::kHeaderSize);
    return net::decode(r, out);
}

} // namespace

TEST(Handshake, AcceptsTheFirstClient)
{
    net::Handshake handshake(7);
    const Bytes packet = connectPacket(7, "Momo");
    Bytes reply;

    ASSERT_TRUE(handshake.handle(packet.data(), packet.size(), endpoint(5000), reply));
    ASSERT_EQ(handshake.playerCount(), 1u);
    EXPECT_EQ(handshake.clients()[0].name, "Momo");
    EXPECT_EQ(handshake.clients()[0].playerId, 0);

    net::AcceptMsg accept;
    ASSERT_TRUE(decodeReply(reply, net::MsgType::Accept, accept));
    EXPECT_EQ(accept.playerId, 0);
    EXPECT_EQ(accept.tickRate, net::kTickRate);
    EXPECT_EQ(accept.snapshotRate, net::kSnapshotRate);
    EXPECT_EQ(accept.roomInstance, 7u);
}

TEST(Handshake, RepeatedConnectKeepsTheSamePlayer)
{
    net::Handshake handshake(1);
    const Endpoint from = endpoint(5000);
    Bytes reply;

    const Bytes first = connectPacket(1, "Momo");
    ASSERT_TRUE(handshake.handle(first.data(), first.size(), from, reply));
    net::AcceptMsg firstAccept;
    ASSERT_TRUE(decodeReply(reply, net::MsgType::Accept, firstAccept));

    const Bytes retry = connectPacket(1, "Momo");
    ASSERT_TRUE(handshake.handle(retry.data(), retry.size(), from, reply));
    net::AcceptMsg retryAccept;
    ASSERT_TRUE(decodeReply(reply, net::MsgType::Accept, retryAccept));

    EXPECT_EQ(retryAccept.playerId, firstAccept.playerId);
    EXPECT_EQ(handshake.playerCount(), 1u);
}

TEST(Handshake, GivesEveryPlayerADistinctId)
{
    net::Handshake handshake(1);
    Bytes reply;

    for (std::uint8_t index = 0; index < net::Handshake::kMaxPlayers; ++index) {
        const Bytes packet = connectPacket(1, "player");
        ASSERT_TRUE(handshake.handle(packet.data(), packet.size(),
                                     endpoint(static_cast<std::uint16_t>(5000 + index)), reply));
        net::AcceptMsg accept;
        ASSERT_TRUE(decodeReply(reply, net::MsgType::Accept, accept));
        EXPECT_EQ(accept.playerId, index);
    }
    EXPECT_EQ(handshake.playerCount(), net::Handshake::kMaxPlayers);
}

TEST(Handshake, RejectsAFifthPlayerWithBye)
{
    net::Handshake handshake(1);
    Bytes reply;

    for (std::uint8_t index = 0; index < net::Handshake::kMaxPlayers; ++index) {
        const Bytes packet = connectPacket(1, "player");
        ASSERT_TRUE(handshake.handle(packet.data(), packet.size(),
                                     endpoint(static_cast<std::uint16_t>(5000 + index)), reply));
    }

    const Bytes late = connectPacket(1, "late");
    ASSERT_TRUE(handshake.handle(late.data(), late.size(), endpoint(6000), reply));

    net::ByeMsg bye;
    ASSERT_TRUE(decodeReply(reply, net::MsgType::Bye, bye));
    EXPECT_EQ(bye.reason, net::Handshake::kByeRoomFull);
    EXPECT_EQ(handshake.playerCount(), net::Handshake::kMaxPlayers);
}

TEST(Handshake, ReusesTheIdOfARemovedClient)
{
    net::Handshake handshake(1);
    Bytes reply;

    const Bytes packet = connectPacket(1, "player");
    ASSERT_TRUE(handshake.handle(packet.data(), packet.size(), endpoint(5000), reply));
    ASSERT_TRUE(handshake.handle(packet.data(), packet.size(), endpoint(5001), reply));
    ASSERT_EQ(handshake.playerCount(), 2u);

    const auto removed = handshake.remove(endpoint(5000));
    ASSERT_TRUE(removed.has_value());
    EXPECT_EQ(*removed, 0);
    EXPECT_EQ(handshake.playerCount(), 1u);
    EXPECT_FALSE(handshake.remove(endpoint(9999)).has_value());

    ASSERT_TRUE(handshake.handle(packet.data(), packet.size(), endpoint(5002), reply));
    net::AcceptMsg accept;
    ASSERT_TRUE(decodeReply(reply, net::MsgType::Accept, accept));
    EXPECT_EQ(accept.playerId, 0);
    EXPECT_EQ(handshake.playerCount(), 2u);
}

TEST(Handshake, RejectsAConnectForAnotherRoomInstance)
{
    net::Handshake handshake(1);
    Bytes reply;

    const Bytes packet = connectPacket(2, "player");
    EXPECT_FALSE(handshake.handle(packet.data(), packet.size(), endpoint(5000), reply));
    EXPECT_EQ(handshake.playerCount(), 0u);
    EXPECT_EQ(handshake.rejectedCount(), 1u);
}

TEST(Handshake, AnswersAPingFromAKnownClient)
{
    net::Handshake handshake(1);
    const Endpoint from = endpoint(5000);
    Bytes reply;

    const Bytes connect = connectPacket(1, "Momo");
    ASSERT_TRUE(handshake.handle(connect.data(), connect.size(), from, reply));

    const Bytes ping = pingPacket(123456);
    ASSERT_TRUE(handshake.handle(ping.data(), ping.size(), from, reply));

    net::PongMsg pong;
    ASSERT_TRUE(decodeReply(reply, net::MsgType::Pong, pong));
    EXPECT_EQ(pong.clientTimeMs, 123456u);
}

TEST(Handshake, IgnoresAPingFromAnUnknownClient)
{
    net::Handshake handshake(1);
    Bytes reply;

    const Bytes ping = pingPacket(1);
    EXPECT_FALSE(handshake.handle(ping.data(), ping.size(), endpoint(5000), reply));
    EXPECT_EQ(handshake.playerCount(), 0u);
    EXPECT_EQ(handshake.rejectedCount(), 1u);
}

TEST(Handshake, IgnoresInputFromAKnownClient)
{
    net::Handshake handshake(1);
    const Endpoint from = endpoint(5000);
    Bytes reply;

    const Bytes connect = connectPacket(1, "Momo");
    ASSERT_TRUE(handshake.handle(connect.data(), connect.size(), from, reply));

    const Bytes input = inputPacket();
    EXPECT_FALSE(handshake.handle(input.data(), input.size(), from, reply));
    EXPECT_EQ(handshake.rejectedCount(), 0u);
}

TEST(Handshake, RejectsMalformedDatagrams)
{
    net::Handshake handshake(1);
    const Endpoint from = endpoint(5000);
    Bytes reply;

    const Bytes empty;
    EXPECT_FALSE(handshake.handle(empty.data(), empty.size(), from, reply));

    Bytes badMagic = connectPacket(1, "x");
    badMagic[0] = 0x00;
    EXPECT_FALSE(handshake.handle(badMagic.data(), badMagic.size(), from, reply));

    Bytes badVersion = connectPacket(1, "x");
    badVersion[2] = 9;
    EXPECT_FALSE(handshake.handle(badVersion.data(), badVersion.size(), from, reply));

    const Bytes truncated = connectPacket(1, "x");
    EXPECT_FALSE(handshake.handle(truncated.data(), net::kHeaderSize + 1, from, reply));

    EXPECT_EQ(handshake.playerCount(), 0u);
    EXPECT_EQ(handshake.rejectedCount(), 4u);
}

TEST(Handshake, RejectsUnknownMessageTypes)
{
    net::Handshake handshake(1);
    Bytes packet;
    net::Writer w(packet, net::kMaxUdpDatagram);
    net::writeHeader(w, static_cast<net::MsgType>(0x42), 1);
    ASSERT_TRUE(w.ok());

    Bytes reply;
    EXPECT_FALSE(handshake.handle(packet.data(), packet.size(), endpoint(5000), reply));
    EXPECT_EQ(handshake.rejectedCount(), 1u);
}
