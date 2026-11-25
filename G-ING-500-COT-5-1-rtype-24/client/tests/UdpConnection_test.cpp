#include "network/UdpConnection.hpp"
#include "network/bytes.hpp"
#include "network/packet.hpp"
#include "network/udp_socket.hpp"

#include <array>
#include <chrono>
#include <gtest/gtest.h>
#include <thread>

using namespace client;

namespace {

// The fake server waits for one packet of the client and returns its type.
net::MsgType receivePacket(net::UdpSocket &server, asio::ip::udp::endpoint &client)
{
    std::array<std::uint8_t, net::kMaxUdpDatagram> buffer{};
    const std::size_t size =
        server.receiveFor(buffer.data(), buffer.size(), client, std::chrono::milliseconds(500));
    net::PacketHeader header;
    if (net::readHeader(buffer.data(), size, header) != net::HeaderStatus::Ok) {
        return net::MsgType{}; // nothing received, or not an R-Type packet
    }
    return header.type;
}

// Calls update() until the connection gives a message of this type.
bool waitForMessage(UdpConnection &connection, MessageType type)
{
    for (int i = 0; i < 100; i++) {
        connection.update(0.0f);
        for (const ServerMessage &message : connection.receive()) {
            if (message.type == type) {
                return true;
            }
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
    }
    return false;
}

} // namespace

TEST(UdpConnection, ConvertsASnapshot)
{
    net::SnapshotMsg snapshot;
    snapshot.serverTick = 42;
    snapshot.self.score = 1200;
    snapshot.self.lives = 2;
    net::EntityRecord ship;
    ship.netId = 7;
    ship.type = static_cast<std::uint8_t>(game::EntityType::Ship);
    ship.team = 1; // player 2
    ship.x = 100.0f;
    ship.hp = 1;
    net::EntityRecord unknown;
    unknown.type = 200; // not a game::EntityType: skipped
    snapshot.entities = {ship, unknown};

    const ServerMessage message = snapshotToMessage(snapshot, 1, "Alexis");
    EXPECT_EQ(message.tick, 42U);
    ASSERT_EQ(message.entities.size(), 1U);
    EXPECT_EQ(message.entities[0].id, 7U);
    EXPECT_EQ(message.entities[0].playerId, 1);
    EXPECT_FLOAT_EQ(message.entities[0].x, 100.0f);
    EXPECT_EQ(message.entities[0].hp, 1);
    ASSERT_EQ(message.players.size(), 1U);
    EXPECT_EQ(message.players[0].score, 1200);
    EXPECT_EQ(message.players[0].lives, 2);
}

TEST(UdpConnection, KeepsTheScoresOfAllThePlayers)
{
    net::SnapshotMsg snapshot;
    snapshot.self.score = 500;
    snapshot.self.speedLevel = 2;
    net::PlayerHud me;
    me.playerId = 0;
    me.score = 500;
    net::PlayerHud other;
    other.playerId = 2;
    other.score = 900;
    other.lives = 1;
    snapshot.players = {me, other};

    const ServerMessage message = snapshotToMessage(snapshot, 0, "Alexis");
    ASSERT_EQ(message.players.size(), 2U); // we are not counted twice
    for (const PlayerInfo &player : message.players) {
        if (player.id == 0) {
            EXPECT_EQ(player.name, "Alexis");
            EXPECT_EQ(player.score, 500);
            EXPECT_EQ(player.speedLevel, 2);
        } else {
            EXPECT_EQ(player.id, 2);
            EXPECT_EQ(player.score, 900);
            EXPECT_EQ(player.lives, 1);
        }
    }
}

TEST(UdpConnection, ReadsAnEndlessWaveFromTheFlags)
{
    net::SnapshotMsg snapshot;
    snapshot.self.flags = static_cast<std::uint8_t>((3 << 4) | 0x08); // wave 3, endless
    const ServerMessage message = snapshotToMessage(snapshot, 0, "Alexis");
    EXPECT_EQ(message.stage, 3);
    EXPECT_TRUE(message.endless);
}

TEST(UdpConnection, ReadsACampaignLevelFromTheFlags)
{
    net::SnapshotMsg snapshot;
    snapshot.self.flags = static_cast<std::uint8_t>(2 << 4); // level 2, campaign
    const ServerMessage message = snapshotToMessage(snapshot, 0, "Alexis");
    EXPECT_EQ(message.stage, 2);
    EXPECT_FALSE(message.endless);
}

// A whole game against a fake server on 127.0.0.1:
// Ready -> CONNECT, ACCEPT -> GameStart, INPUT, GAME_END -> GameOver + LEAVE.
TEST(UdpConnection, JoinsPlaysAndLeavesTheRoom)
{
    net::UdpSocket server(0); // any free port
    asio::ip::udp::endpoint client;
    UdpConnection connection;
    ASSERT_TRUE(connection.connect("127.0.0.1", server.port(), "Alexis"));

    connection.setReady(true);
    ASSERT_EQ(receivePacket(server, client), net::MsgType::Connect);

    std::vector<std::uint8_t> accept;
    net::Writer acceptWriter(accept, net::kMaxUdpDatagram);
    net::writeHeader(acceptWriter, net::MsgType::Accept, 0);
    net::AcceptMsg acceptMessage;
    acceptMessage.roomInstance = kDirectRoomInstance;
    net::encode(acceptMessage, acceptWriter);
    server.send(accept.data(), accept.size(), client);
    EXPECT_TRUE(waitForMessage(connection, MessageType::GameStart));

    game::Input input;
    input.fire = true;
    connection.sendInput(input);
    EXPECT_EQ(receivePacket(server, client), net::MsgType::Input);

    std::vector<std::uint8_t> end;
    net::Writer endWriter(end, net::kMaxUdpDatagram);
    net::writeHeader(endWriter, net::MsgType::GameEnd, 1);
    net::GameEndMsg endMessage;
    endMessage.eventSeq = 3;
    endMessage.result = 1; // victory
    net::encode(endMessage, endWriter);
    server.send(end.data(), end.size(), client);
    EXPECT_TRUE(waitForMessage(connection, MessageType::GameOver));
    EXPECT_EQ(receivePacket(server, client), net::MsgType::Leave);
}

TEST(UdpConnection, ErrorWhenTheServerDoesNotAnswer)
{
    net::UdpSocket server(0); // never answers
    UdpConnection connection;
    ASSERT_TRUE(connection.connect("127.0.0.1", server.port(), "Alexis"));
    connection.setReady(true);
    bool error = false;
    for (int i = 0; i < 12; i++) { // 12 x 0.5 s: more than the 5 s limit
        connection.update(0.5f);
        for (const ServerMessage &message : connection.receive()) {
            if (message.type == MessageType::Error) {
                error = true;
            }
        }
    }
    EXPECT_TRUE(error);
}
