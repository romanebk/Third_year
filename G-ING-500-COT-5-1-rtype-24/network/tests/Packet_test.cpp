#include "network/packet.hpp"

#include <cstdint>
#include <gtest/gtest.h>
#include <random>
#include <string>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;

template <typename Msg>
Bytes payloadOf(const Msg &msg)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    EXPECT_TRUE(net::encode(msg, w));
    return out;
}

template <typename Msg>
bool decodePayload(const Bytes &data, Msg &out)
{
    net::Reader r(data.data(), data.size());
    return net::decode(r, out);
}

// Every strict prefix of a payload must be refused: cutting a datagram
// anywhere never decodes into a half-filled message (docs/rfc-protocol.md §2).
template <typename Msg>
void expectEveryPrefixToBeRejected(const Msg &msg)
{
    const Bytes full = payloadOf(msg);
    for (std::size_t length = 0; length < full.size(); ++length) {
        Msg decoded;
        net::Reader r(full.data(), length);
        EXPECT_FALSE(net::decode(r, decoded))
            << "a " << length << "-byte prefix of a " << full.size() << "-byte payload decoded";
    }
}

} // namespace

TEST(PacketHeader, EncodesTheRfcLayout)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Input, 0x01020304u);
    ASSERT_TRUE(w.ok());
    EXPECT_EQ(out, (Bytes{0x52, 0x54, 0x01, 0x02, 0x04, 0x03, 0x02, 0x01}));
}

TEST(PacketHeader, ReadsBackWhatWasWritten)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Snapshot, 0xCAFEBABEu);
    ASSERT_TRUE(w.ok());

    net::PacketHeader header;
    EXPECT_EQ(net::readHeader(out.data(), out.size(), header), net::HeaderStatus::Ok);
    EXPECT_EQ(header.version, net::kVersion);
    EXPECT_EQ(header.type, net::MsgType::Snapshot);
    EXPECT_EQ(header.packetSeq, 0xCAFEBABEu);
}

TEST(PacketHeader, RejectsEveryShortDatagram)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Ping, 1);
    ASSERT_TRUE(w.ok());
    for (std::size_t length = 0; length < net::kHeaderSize; ++length) {
        net::PacketHeader header;
        EXPECT_EQ(net::readHeader(out.data(), length, header), net::HeaderStatus::Truncated)
            << "length " << length;
    }
}

TEST(PacketHeader, RejectsAWrongMagic)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Ping, 1);
    ASSERT_TRUE(w.ok());
    out[0] = 0x58; // 'X'
    net::PacketHeader header;
    EXPECT_EQ(net::readHeader(out.data(), out.size(), header), net::HeaderStatus::BadMagic);
}

TEST(PacketHeader, RejectsAnotherVersion)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    net::writeHeader(w, net::MsgType::Ping, 1);
    ASSERT_TRUE(w.ok());
    out[2] = 2;
    net::PacketHeader header;
    EXPECT_EQ(net::readHeader(out.data(), out.size(), header), net::HeaderStatus::BadVersion);
}

TEST(PacketHeader, KeepsAnUnknownTypeForTheDispatcher)
{
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    const auto unknown = static_cast<net::MsgType>(0x42);
    net::writeHeader(w, unknown, 1);
    ASSERT_TRUE(w.ok());

    net::PacketHeader header;
    EXPECT_EQ(net::readHeader(out.data(), out.size(), header), net::HeaderStatus::Ok);
    EXPECT_EQ(header.type, unknown);
}

TEST(PacketMessages, ConnectRoundTrips)
{
    net::ConnectMsg msg;
    msg.lobbyToken = 0x11223344u;
    msg.roomInstance = 0x55667788u;
    msg.name = "Momo";

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 4u + 4u + 1u + 4u);

    net::ConnectMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.lobbyToken, msg.lobbyToken);
    EXPECT_EQ(out.roomInstance, msg.roomInstance);
    EXPECT_EQ(out.name, msg.name);
}

TEST(PacketMessages, ConnectRejectsAnOverlongName)
{
    net::ConnectMsg msg;
    msg.name = std::string(net::kMaxNameLength + 1, 'a');
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    EXPECT_FALSE(net::encode(msg, w));
}

TEST(PacketMessages, InputPayloadIsTwelveBytes)
{
    net::InputMsg msg;
    msg.inputSeq = 7;
    msg.mask = 0x15;
    msg.prevMask = 0x05;
    msg.ackEvent = 0x0102;
    msg.lastServerTick = 0x03040506u;

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 12u);
    EXPECT_EQ(data,
              (Bytes{0x07, 0x00, 0x00, 0x00, 0x15, 0x05, 0x02, 0x01, 0x06, 0x05, 0x04, 0x03}));

    net::InputMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.inputSeq, msg.inputSeq);
    EXPECT_EQ(out.mask, msg.mask);
    EXPECT_EQ(out.prevMask, msg.prevMask);
    EXPECT_EQ(out.ackEvent, msg.ackEvent);
    EXPECT_EQ(out.lastServerTick, msg.lastServerTick);
}

TEST(PacketMessages, PingRoundTrips)
{
    net::PingMsg msg;
    msg.clientTimeMs = 123456;
    msg.ackEvent = 77;

    net::PingMsg out;
    ASSERT_TRUE(decodePayload(payloadOf(msg), out));
    EXPECT_EQ(out.clientTimeMs, msg.clientTimeMs);
    EXPECT_EQ(out.ackEvent, msg.ackEvent);
}

TEST(PacketMessages, LeaveRoundTrips)
{
    net::LeaveMsg msg;
    msg.reason = 4;

    net::LeaveMsg out;
    ASSERT_TRUE(decodePayload(payloadOf(msg), out));
    EXPECT_EQ(out.reason, msg.reason);
}

TEST(PacketMessages, AcceptRoundTrips)
{
    net::AcceptMsg msg;
    msg.playerId = 2;
    msg.tickRate = 60;
    msg.snapshotRate = 20;
    msg.serverTick = 0xAABBCCDDu;
    msg.roomInstance = 0x01020304u;

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 3u + 4u + 4u);

    net::AcceptMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.playerId, msg.playerId);
    EXPECT_EQ(out.tickRate, msg.tickRate);
    EXPECT_EQ(out.snapshotRate, msg.snapshotRate);
    EXPECT_EQ(out.serverTick, msg.serverTick);
    EXPECT_EQ(out.roomInstance, msg.roomInstance);
}

TEST(PacketMessages, EntityRecordIsSixteenBytes)
{
    net::EntityRecord record;
    record.netId = 42;
    record.type = 3;
    record.team = 1;
    record.x = 120.5f;
    record.y = 270.25f;
    record.hp = 2;
    record.extra = 9;
    record.flags = 0;

    const Bytes data = payloadOf(record);
    ASSERT_EQ(data.size(), net::kEntityRecordSize);

    net::EntityRecord out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.netId, record.netId);
    EXPECT_EQ(out.type, record.type);
    EXPECT_EQ(out.team, record.team);
    EXPECT_FLOAT_EQ(out.x, record.x);
    EXPECT_FLOAT_EQ(out.y, record.y);
    EXPECT_EQ(out.hp, record.hp);
    EXPECT_EQ(out.extra, record.extra);
    EXPECT_EQ(out.flags, record.flags);
}

TEST(PacketMessages, EntityExtraRoundTripsEveryBulletVisual)
{
    for (std::uint8_t visual = 0; visual <= 4; ++visual) {
        net::EntityRecord record;
        record.netId = static_cast<std::uint16_t>(visual + 1);
        record.extra = visual;

        const Bytes data = payloadOf(record);
        net::EntityRecord out;
        ASSERT_TRUE(decodePayload(data, out));
        EXPECT_EQ(out.netId, record.netId);
        EXPECT_EQ(out.extra, visual);
    }
}

TEST(PacketMessages, SnapshotRoundTripsFiftyEntities)
{
    net::SnapshotMsg msg;
    msg.serverTick = 12345;
    msg.ackInputSeq = 678;
    msg.ackEvent = 9;
    msg.state = 1;
    msg.self.lives = 2;
    msg.self.score = -1500;
    msg.self.alive = 1;
    msg.self.speedLevel = 3;
    msg.self.forcePower = 2;
    msg.self.flags = static_cast<std::uint8_t>(0b1101 | (3 << net::kStageShift));
    for (std::uint8_t i = 0; i < 2; ++i) {
        net::PlayerHud row;
        row.playerId = i;
        row.lives = static_cast<std::uint8_t>(3 - i);
        row.score = static_cast<std::int32_t>(i) * 500;
        row.alive = i;
        row.flags = static_cast<std::uint8_t>(i + 1);
        msg.players.push_back(row);
    }
    for (std::uint16_t i = 0; i < 50; ++i) {
        net::EntityRecord record;
        record.netId = i;
        record.type = static_cast<std::uint8_t>(i % 13u);
        record.team = static_cast<std::uint8_t>(i % 9u);
        record.x = static_cast<float>(i) * 1.5f;
        record.y = 540.0f - static_cast<float>(i);
        record.hp = static_cast<std::uint8_t>(i % 4u);
        record.extra = 7;
        record.flags = 0;
        msg.entities.push_back(record);
    }

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 23u + 2u * net::kPlayerHudSize + 50u * net::kEntityRecordSize);
    ASSERT_LE(data.size(), net::kMaxUdpDatagram);

    net::SnapshotMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.serverTick, msg.serverTick);
    EXPECT_EQ(out.ackInputSeq, msg.ackInputSeq);
    EXPECT_EQ(out.ackEvent, msg.ackEvent);
    EXPECT_EQ(out.state, msg.state);
    EXPECT_EQ(out.self.lives, msg.self.lives);
    EXPECT_EQ(out.self.score, msg.self.score);
    EXPECT_EQ(out.self.alive, msg.self.alive);
    EXPECT_EQ(out.self.speedLevel, msg.self.speedLevel);
    EXPECT_EQ(out.self.forcePower, msg.self.forcePower);
    EXPECT_EQ(out.self.flags, msg.self.flags);
    EXPECT_EQ(net::snapshotStage(out.self), 3u);
    EXPECT_TRUE(net::snapshotEndless(out.self));
    ASSERT_EQ(out.players.size(), msg.players.size());
    for (std::size_t i = 0; i < msg.players.size(); ++i) {
        EXPECT_EQ(out.players[i].playerId, msg.players[i].playerId);
        EXPECT_EQ(out.players[i].lives, msg.players[i].lives);
        EXPECT_EQ(out.players[i].score, msg.players[i].score);
        EXPECT_EQ(out.players[i].alive, msg.players[i].alive);
        EXPECT_EQ(out.players[i].flags, msg.players[i].flags);
    }
    ASSERT_EQ(out.entities.size(), msg.entities.size());
    for (std::size_t i = 0; i < msg.entities.size(); ++i) {
        EXPECT_EQ(out.entities[i].netId, msg.entities[i].netId);
        EXPECT_EQ(out.entities[i].type, msg.entities[i].type);
        EXPECT_EQ(out.entities[i].team, msg.entities[i].team);
        EXPECT_FLOAT_EQ(out.entities[i].x, msg.entities[i].x);
        EXPECT_FLOAT_EQ(out.entities[i].y, msg.entities[i].y);
        EXPECT_EQ(out.entities[i].hp, msg.entities[i].hp);
        EXPECT_EQ(out.entities[i].extra, msg.entities[i].extra);
        EXPECT_EQ(out.entities[i].flags, msg.entities[i].flags);
    }
}

TEST(PacketMessages, SnapshotStageUsesTheUpperSelfFlagBits)
{
    net::SelfBlock self;
    self.flags = static_cast<std::uint8_t>(net::kSelfFlagForce | (2 << net::kStageShift));
    EXPECT_EQ(net::snapshotStage(self), 2u);
    EXPECT_EQ(self.flags & net::kSelfFlagForce, net::kSelfFlagForce);
    EXPECT_EQ(self.flags & net::kSelfFlagGameOver, 0u);
}

TEST(PacketMessages, SnapshotEndlessUsesBitThreeWithoutHidingTheStage)
{
    net::SelfBlock self;
    self.flags = static_cast<std::uint8_t>(net::kSelfFlagEndless | (3 << net::kStageShift));
    EXPECT_TRUE(net::snapshotEndless(self));
    EXPECT_EQ(net::snapshotStage(self), 3u);
    EXPECT_EQ(self.flags & net::kSelfFlagForce, 0u);

    self.flags = net::kSelfFlagEndless;
    EXPECT_TRUE(net::snapshotEndless(self));
    EXPECT_EQ(net::snapshotStage(self), 0u);

    self.flags = static_cast<std::uint8_t>(net::kSelfFlagGameOver | net::kSelfFlagMissile);
    EXPECT_FALSE(net::snapshotEndless(self));
}

TEST(PacketMessages, SnapshotWithNoEntityRoundTrips)
{
    net::SnapshotMsg msg;
    msg.serverTick = 1;

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 23u);

    net::SnapshotMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_TRUE(out.players.empty());
    EXPECT_TRUE(out.entities.empty());
}

TEST(PacketMessages, SnapshotRejectsMoreThanFourPlayers)
{
    net::SnapshotMsg msg;
    msg.players.resize(net::kMaxSnapshotPlayers + 1);
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    EXPECT_FALSE(net::encode(msg, w));
}

TEST(PacketMessages, SnapshotFitsTheDatagramAtTheEntityCap)
{
    net::SnapshotMsg msg;
    msg.players.resize(net::kMaxSnapshotPlayers);
    msg.entities.resize(net::kMaxSnapshotEntities);
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    EXPECT_TRUE(net::encode(msg, w));
    EXPECT_LE(out.size(), net::kMaxUdpDatagram);

    msg.entities.resize(net::kMaxSnapshotEntities + 1);
    Bytes bigger;
    net::Writer over(bigger, net::kMaxUdpDatagram);
    EXPECT_FALSE(net::encode(msg, over));
}

TEST(PacketMessages, SnapshotRejectsMoreEntitiesThanFit)
{
    net::SnapshotMsg msg;
    msg.entities.resize(net::kMaxEntities + 1);
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    EXPECT_FALSE(net::encode(msg, w));
}

TEST(PacketMessages, SnapshotSkipsAFutureSelfBlock)
{
    Bytes data;
    net::Writer w(data, net::kMaxUdpDatagram);
    w.u32(1);   // serverTick
    w.u32(2);   // ackInputSeq
    w.u16(3);   // ackEvent
    w.u8(0);    // state
    w.u8(12);   // selfLen: the v1 block plus 3 unknown bytes
    w.u8(3);    // lives
    w.i32(100); // score
    w.u8(1);    // alive
    w.u8(0);    // speedLevel
    w.u8(0);    // forcePower
    w.u8(0);    // flags
    w.u8(0xAA); // future field
    w.u8(0xBB); // future field
    w.u8(0xCC); // future field
    w.u8(0);    // player count
    w.u8(0);    // entity count
    ASSERT_TRUE(w.ok());

    net::SnapshotMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.serverTick, 1u);
    EXPECT_EQ(out.ackEvent, 3);
    EXPECT_EQ(out.self.lives, 3);
    EXPECT_EQ(out.self.score, 100);
}

TEST(PacketMessages, SnapshotRejectsAShortSelfBlock)
{
    Bytes data;
    net::Writer w(data, net::kMaxUdpDatagram);
    w.u32(1);
    w.u32(2);
    w.u16(3);
    w.u8(0);
    w.u8(static_cast<std::uint8_t>(net::kSelfBlockSize - 1));
    w.u8(0);
    ASSERT_TRUE(w.ok());

    net::SnapshotMsg out;
    EXPECT_FALSE(decodePayload(data, out));
}

TEST(PacketMessages, SpawnRoundTrips)
{
    net::SpawnMsg msg;
    msg.eventSeq = 513;
    msg.serverTick = 999;
    msg.entity.netId = 12;
    msg.entity.type = 4;
    msg.entity.team = 4;
    msg.entity.x = 992.0f;
    msg.entity.y = 111.5f;
    msg.entity.hp = 3;
    msg.entity.extra = 0;
    msg.entity.flags = 0;

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 2u + 4u + net::kEntityRecordSize);

    net::SpawnMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.eventSeq, msg.eventSeq);
    EXPECT_EQ(out.serverTick, msg.serverTick);
    EXPECT_EQ(out.entity.netId, msg.entity.netId);
    EXPECT_EQ(out.entity.type, msg.entity.type);
    EXPECT_EQ(out.entity.team, msg.entity.team);
    EXPECT_FLOAT_EQ(out.entity.x, msg.entity.x);
    EXPECT_FLOAT_EQ(out.entity.y, msg.entity.y);
    EXPECT_EQ(out.entity.hp, msg.entity.hp);
}

TEST(PacketMessages, DestroyRoundTrips)
{
    net::DestroyMsg msg;
    msg.eventSeq = 4;
    msg.serverTick = 1000;
    msg.netId = 77;
    msg.reason = 1;

    const Bytes data = payloadOf(msg);
    ASSERT_EQ(data.size(), 9u);

    net::DestroyMsg out;
    ASSERT_TRUE(decodePayload(data, out));
    EXPECT_EQ(out.eventSeq, msg.eventSeq);
    EXPECT_EQ(out.serverTick, msg.serverTick);
    EXPECT_EQ(out.netId, msg.netId);
    EXPECT_EQ(out.reason, msg.reason);
}

TEST(PacketMessages, GameEndRoundTrips)
{
    net::GameEndMsg msg;
    msg.eventSeq = 9;
    msg.serverTick = 4242;
    msg.result = 1;
    msg.reason = "boss defeated";

    net::GameEndMsg out;
    ASSERT_TRUE(decodePayload(payloadOf(msg), out));
    EXPECT_EQ(out.eventSeq, msg.eventSeq);
    EXPECT_EQ(out.serverTick, msg.serverTick);
    EXPECT_EQ(out.result, msg.result);
    EXPECT_EQ(out.reason, msg.reason);
}

TEST(PacketMessages, GameEndRejectsAnOverlongReason)
{
    net::GameEndMsg msg;
    msg.reason = std::string(net::kMaxNameLength + 1, 'x');
    Bytes out;
    net::Writer w(out, net::kMaxUdpDatagram);
    EXPECT_FALSE(net::encode(msg, w));
}

TEST(PacketMessages, PongRoundTrips)
{
    net::PongMsg msg;
    msg.clientTimeMs = 111;
    msg.serverTimeMs = 222;

    net::PongMsg out;
    ASSERT_TRUE(decodePayload(payloadOf(msg), out));
    EXPECT_EQ(out.clientTimeMs, msg.clientTimeMs);
    EXPECT_EQ(out.serverTimeMs, msg.serverTimeMs);
}

TEST(PacketMessages, ByeRoundTrips)
{
    net::ByeMsg msg;
    msg.reason = 6;

    net::ByeMsg out;
    ASSERT_TRUE(decodePayload(payloadOf(msg), out));
    EXPECT_EQ(out.reason, msg.reason);
}

TEST(PacketMessages, RejectsTrailingBytes)
{
    net::LeaveMsg msg;
    Bytes data = payloadOf(msg);
    data.push_back(0xFF);

    net::LeaveMsg out;
    EXPECT_FALSE(decodePayload(data, out));
}

TEST(PacketMessages, EveryTruncatedPayloadIsRejected)
{
    net::ConnectMsg connect;
    connect.name = "Momo";
    expectEveryPrefixToBeRejected(connect);

    net::InputMsg input;
    input.inputSeq = 1;
    input.lastServerTick = 2;
    expectEveryPrefixToBeRejected(input);

    net::PingMsg ping;
    ping.clientTimeMs = 1;
    expectEveryPrefixToBeRejected(ping);

    net::LeaveMsg leave;
    expectEveryPrefixToBeRejected(leave);

    net::AcceptMsg accept;
    accept.playerId = 1;
    expectEveryPrefixToBeRejected(accept);

    net::SnapshotMsg snapshot;
    snapshot.self.lives = 3;
    snapshot.entities.resize(3);
    expectEveryPrefixToBeRejected(snapshot);

    net::SpawnMsg spawn;
    spawn.entity.netId = 1;
    expectEveryPrefixToBeRejected(spawn);

    net::DestroyMsg destroy;
    expectEveryPrefixToBeRejected(destroy);

    net::GameEndMsg gameEnd;
    gameEnd.reason = "defeat";
    expectEveryPrefixToBeRejected(gameEnd);

    net::PongMsg pong;
    expectEveryPrefixToBeRejected(pong);

    net::ByeMsg bye;
    expectEveryPrefixToBeRejected(bye);
}

TEST(PacketMessages, SurvivesGarbageDatagrams)
{
    std::mt19937 rng(0x5254u);
    std::uniform_int_distribution<int> byte(0, 255);
    std::uniform_int_distribution<int> length(0x00, static_cast<int>(net::kMaxUdpDatagram));

    for (int iteration = 0; iteration < 2000; ++iteration) {
        const auto size = static_cast<std::size_t>(length(rng));
        Bytes data(size);
        for (auto &value : data) {
            value = static_cast<std::uint8_t>(byte(rng));
        }

        net::PacketHeader header;
        const auto status = net::readHeader(data.data(), data.size(), header);
        if (status != net::HeaderStatus::Ok) {
            continue;
        }
        net::Reader r(data.data() + net::kHeaderSize, data.size() - net::kHeaderSize);
        net::SnapshotMsg snapshot;
        // Any outcome is fine: the decoder must never throw nor read out of
        // bounds on a well-formed header carrying a garbage payload.
        net::decode(r, snapshot);
    }
}
