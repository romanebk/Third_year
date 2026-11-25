#include "network/lobby.hpp"

#include <cstdint>
#include <gtest/gtest.h>
#include <initializer_list>
#include <string>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;

Bytes bytesOf(std::initializer_list<int> values)
{
    Bytes out;
    for (const int value : values) {
        out.push_back(static_cast<std::uint8_t>(value));
    }
    return out;
}

template <typename Message>
Bytes frameOf(net::LobbyMsgType type, const Message &message)
{
    Bytes out;
    EXPECT_TRUE(net::encodeFrame(type, message, out));
    return out;
}

// Decoding then re-encoding must reproduce the payload byte for byte.
template <typename Message>
void expectRoundTrip(net::LobbyMsgType type, const Message &message)
{
    const Bytes frame = frameOf(type, message);
    ASSERT_FALSE(frame.empty());

    net::FrameReader reader;
    ASSERT_TRUE(reader.feed(frame.data(), frame.size()));
    net::LobbyFrame decoded;
    ASSERT_TRUE(reader.next(decoded));
    EXPECT_EQ(decoded.type, type);
    EXPECT_FALSE(reader.next(decoded)); // exactly one frame

    net::Reader payload(decoded.payload.data(), decoded.payload.size());
    Message again{};
    ASSERT_TRUE(net::decode(payload, again));

    Bytes reencoded;
    net::Writer writer(reencoded, net::kMaxLobbyFrame);
    ASSERT_TRUE(net::encode(again, writer));
    EXPECT_EQ(reencoded, decoded.payload);
}

} // namespace

TEST(Lobby, LoginExactLayout)
{
    net::LobbyLogin login;
    login.name = "Momo";
    const Bytes expected = bytesOf({0x06, 0x00, 0x01, 0x04, 'M', 'o', 'm', 'o'});
    EXPECT_EQ(frameOf(net::LobbyMsgType::Login, login), expected);
}

TEST(Lobby, EmptyMessagesExactLayout)
{
    EXPECT_EQ(frameOf(net::LobbyMsgType::ListRooms, net::LobbyListRooms{}),
              bytesOf({0x01, 0x00, 0x02}));
    EXPECT_EQ(frameOf(net::LobbyMsgType::LeaveRoom, net::LobbyLeaveRoom{}),
              bytesOf({0x01, 0x00, 0x05}));
    EXPECT_EQ(frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), bytesOf({0x01, 0x00, 0x08}));
}

TEST(Lobby, JoinRoomExactLayout)
{
    net::LobbyJoinRoom join;
    join.roomId = 0x1234;
    EXPECT_EQ(frameOf(net::LobbyMsgType::JoinRoom, join), bytesOf({0x03, 0x00, 0x04, 0x34, 0x12}));
}

TEST(Lobby, PingAndLoginOkExactLayout)
{
    net::LobbyPing ping;
    ping.clientTimeMs = 0xAABBCCDDu;
    EXPECT_EQ(frameOf(net::LobbyMsgType::Ping, ping),
              bytesOf({0x05, 0x00, 0x09, 0xDD, 0xCC, 0xBB, 0xAA}));

    net::LobbyLoginOk ok;
    ok.clientId = 42;
    EXPECT_EQ(frameOf(net::LobbyMsgType::LoginOk, ok),
              bytesOf({0x05, 0x00, 0x80, 0x2A, 0x00, 0x00, 0x00}));
}

TEST(Lobby, RoomStartExactLayout)
{
    net::LobbyRoomStart start;
    start.ip = "10.0.0.5";
    start.udpPort = 4300;
    start.lobbyToken = 0x11223344u;
    start.roomInstance = 7;
    const Bytes expected =
        bytesOf({0x14, 0x00, 0x84, 0x08, '1',  '0',  '.',  '0',  '.',  '0',  '.',
                 '5',  0xCC, 0x10, 0x44, 0x33, 0x22, 0x11, 0x07, 0x00, 0x00, 0x00});
    EXPECT_EQ(frameOf(net::LobbyMsgType::RoomStart, start), expected);
}

TEST(Lobby, RoomListExactLayout)
{
    net::LobbyRoomList list;
    net::LobbyRoomInfo room;
    room.roomId = 1;
    room.name = "Room";
    room.players = 2;
    room.maxPlayers = 4;
    room.state = 0;
    list.rooms.push_back(room);
    const Bytes expected =
        bytesOf({0x0C, 0x00, 0x81, 0x01, 0x01, 0x00, 0x04, 'R', 'o', 'o', 'm', 0x02, 0x04, 0x00});
    EXPECT_EQ(frameOf(net::LobbyMsgType::RoomList, list), expected);
}

TEST(Lobby, RoomUpdateExactLayout)
{
    net::LobbyRoomUpdate update;
    update.roomId = 3;
    net::LobbyPlayerInfo player;
    player.clientId = 42;
    player.name = "Mo";
    player.ready = 1;
    player.isHost = 1;
    update.players.push_back(player);
    const Bytes expected = bytesOf(
        {0x0D, 0x00, 0x82, 0x03, 0x00, 0x01, 0x2A, 0x00, 0x00, 0x00, 0x02, 'M', 'o', 0x01, 0x01});
    EXPECT_EQ(frameOf(net::LobbyMsgType::RoomUpdate, update), expected);
}

TEST(Lobby, ChatMsgExactLayout)
{
    net::LobbyChatMsg chat;
    chat.fromClientId = 1;
    chat.fromName = "A";
    chat.text = "hi";
    const Bytes expected =
        bytesOf({0x0A, 0x00, 0x83, 0x01, 0x00, 0x00, 0x00, 0x01, 'A', 0x02, 'h', 'i'});
    EXPECT_EQ(frameOf(net::LobbyMsgType::ChatMsg, chat), expected);
}

TEST(Lobby, ErrorExactLayout)
{
    net::LobbyErrorMsg error;
    error.code = static_cast<std::uint8_t>(net::LobbyErrorCode::RoomFull);
    error.text = "full";
    EXPECT_EQ(frameOf(net::LobbyMsgType::Error, error),
              bytesOf({0x07, 0x00, 0x86, 0x02, 0x04, 'f', 'u', 'l', 'l'}));
}

TEST(Lobby, EveryMessageRoundTrips)
{
    net::LobbyLogin login;
    login.name = "Momo";
    expectRoundTrip(net::LobbyMsgType::Login, login);
    expectRoundTrip(net::LobbyMsgType::ListRooms, net::LobbyListRooms{});

    net::LobbyCreateRoom create;
    create.name = "Salle des boss";
    expectRoundTrip(net::LobbyMsgType::CreateRoom, create);

    net::LobbyJoinRoom join;
    join.roomId = 65535;
    expectRoundTrip(net::LobbyMsgType::JoinRoom, join);
    expectRoundTrip(net::LobbyMsgType::LeaveRoom, net::LobbyLeaveRoom{});

    net::LobbySetReady ready;
    ready.ready = 1;
    expectRoundTrip(net::LobbyMsgType::SetReady, ready);

    net::LobbyChat chat;
    chat.text = "bonjour";
    expectRoundTrip(net::LobbyMsgType::Chat, chat);
    expectRoundTrip(net::LobbyMsgType::Start, net::LobbyStart{});

    net::LobbyPing ping;
    ping.clientTimeMs = 123456;
    expectRoundTrip(net::LobbyMsgType::Ping, ping);

    net::LobbyLoginOk loginOk;
    loginOk.clientId = 0xDEADBEEFu;
    expectRoundTrip(net::LobbyMsgType::LoginOk, loginOk);

    net::LobbyRoomList list;
    net::LobbyRoomInfo room;
    room.roomId = 2;
    room.name = "Alpha";
    room.players = 1;
    room.maxPlayers = 4;
    room.state = 1;
    list.rooms.push_back(room);
    room.roomId = 3;
    room.name = "Beta";
    list.rooms.push_back(room);
    expectRoundTrip(net::LobbyMsgType::RoomList, list);

    net::LobbyRoomUpdate update;
    update.roomId = 2;
    net::LobbyPlayerInfo player;
    player.clientId = 7;
    player.name = "Alexis";
    player.ready = 1;
    update.players.push_back(player);
    player.clientId = 8;
    player.name = "Ariel";
    player.isHost = 1;
    update.players.push_back(player);
    expectRoundTrip(net::LobbyMsgType::RoomUpdate, update);

    net::LobbyChatMsg chatMsg;
    chatMsg.fromClientId = 7;
    chatMsg.fromName = "Alexis";
    chatMsg.text = "pret !";
    expectRoundTrip(net::LobbyMsgType::ChatMsg, chatMsg);

    net::LobbyRoomStart start;
    start.ip = "192.168.1.10";
    start.udpPort = 4302;
    start.lobbyToken = 0xCAFEBABEu;
    start.roomInstance = 0x01020304u;
    expectRoundTrip(net::LobbyMsgType::RoomStart, start);

    net::LobbyRoomClosed closed;
    closed.reason = 6;
    expectRoundTrip(net::LobbyMsgType::RoomClosed, closed);

    net::LobbyErrorMsg error;
    error.code = 3;
    error.text = "salle inconnue";
    expectRoundTrip(net::LobbyMsgType::Error, error);

    net::LobbyPong pong;
    pong.clientTimeMs = 999;
    expectRoundTrip(net::LobbyMsgType::Pong, pong);
}

TEST(Lobby, FrameReaderRebuildsPipelinedFrames)
{
    net::LobbyLogin login;
    login.name = "Mo";
    net::LobbyPing ping;
    ping.clientTimeMs = 5;
    Bytes stream = frameOf(net::LobbyMsgType::Login, login);
    const Bytes second = frameOf(net::LobbyMsgType::Ping, ping);
    stream.insert(stream.end(), second.begin(), second.end());

    net::FrameReader reader;
    ASSERT_TRUE(reader.feed(stream.data(), stream.size()));
    net::LobbyFrame frame;
    ASSERT_TRUE(reader.next(frame));
    EXPECT_EQ(frame.type, net::LobbyMsgType::Login);
    ASSERT_TRUE(reader.next(frame));
    EXPECT_EQ(frame.type, net::LobbyMsgType::Ping);
    EXPECT_FALSE(reader.next(frame));
    EXPECT_EQ(reader.pending(), 0u);
}

TEST(Lobby, FrameReaderWaitsForSplitFrames)
{
    net::LobbyChat chat;
    chat.text = "hello";
    const Bytes stream = frameOf(net::LobbyMsgType::Chat, chat);

    net::FrameReader reader;
    net::LobbyFrame frame;
    for (std::size_t index = 0; index + 1 < stream.size(); ++index) {
        ASSERT_TRUE(reader.feed(&stream[index], 1));
        EXPECT_FALSE(reader.next(frame));
        EXPECT_FALSE(reader.failed());
    }
    ASSERT_TRUE(reader.feed(&stream.back(), 1));
    ASSERT_TRUE(reader.next(frame));
    EXPECT_EQ(frame.type, net::LobbyMsgType::Chat);
}

TEST(Lobby, FrameReaderRejectsInvalidLengths)
{
    net::FrameReader zero;
    const Bytes zeroLength = bytesOf({0x00, 0x00});
    EXPECT_FALSE(zero.feed(zeroLength.data(), zeroLength.size()));
    EXPECT_TRUE(zero.failed());

    net::FrameReader tooBig;
    const Bytes bigLength = bytesOf({0x01, 0x05}); // 0x0501 > kMaxLobbyFrame
    EXPECT_FALSE(tooBig.feed(bigLength.data(), bigLength.size()));
    EXPECT_TRUE(tooBig.failed());

    net::FrameReader oneByte;
    const Bytes partial = bytesOf({0x02});
    EXPECT_TRUE(oneByte.feed(partial.data(), partial.size()));
    net::LobbyFrame frame;
    EXPECT_FALSE(oneByte.next(frame));
    EXPECT_FALSE(oneByte.failed());
}

TEST(Lobby, DecodersRejectTrailingBytes)
{
    Bytes payload = bytesOf({0x01, 'A', 0x00}); // Login "A" + one extra byte
    net::Reader reader(payload.data(), payload.size());
    net::LobbyLogin login;
    EXPECT_FALSE(net::decode(reader, login));

    Bytes empty = bytesOf({0x00}); // ListRooms has no payload
    net::Reader emptyReader(empty.data(), empty.size());
    net::LobbyListRooms list;
    EXPECT_FALSE(net::decode(emptyReader, list));
}

TEST(Lobby, EncodersRejectOverlongFields)
{
    Bytes out;
    net::LobbyLogin login;
    login.name.assign(net::kMaxPlayerNameLength + 1, 'a');
    EXPECT_FALSE(net::encodeFrame(net::LobbyMsgType::Login, login, out));
    EXPECT_TRUE(out.empty());

    net::LobbyChat chat;
    chat.text.assign(net::kMaxChatMessageLength + 1, 'a');
    EXPECT_FALSE(net::encodeFrame(net::LobbyMsgType::Chat, chat, out));
    EXPECT_TRUE(out.empty());

    net::LobbyRoomStart start;
    start.ip.assign(net::kMaxIpLength + 1, '1');
    EXPECT_FALSE(net::encodeFrame(net::LobbyMsgType::RoomStart, start, out));
    EXPECT_TRUE(out.empty());
}

TEST(Lobby, RoomListRespectsCountAndFrameLimits)
{
    net::LobbyRoomList list;
    list.rooms.resize(100); // 1 + 100 * 6 bytes, fits in one frame
    Bytes out;
    EXPECT_TRUE(net::encodeFrame(net::LobbyMsgType::RoomList, list, out));

    list.rooms.resize(256); // count is a u8
    out.clear();
    EXPECT_FALSE(net::encodeFrame(net::LobbyMsgType::RoomList, list, out));

    list.rooms.resize(200); // 1201 bytes, above the 1024-byte frame cap
    out.clear();
    EXPECT_FALSE(net::encodeFrame(net::LobbyMsgType::RoomList, list, out));
}

TEST(Lobby, UnknownTypesAreNotKnown)
{
    EXPECT_TRUE(net::isKnownLobbyType(net::LobbyMsgType::Login));
    EXPECT_TRUE(net::isKnownLobbyType(net::LobbyMsgType::Pong));
    EXPECT_FALSE(net::isKnownLobbyType(static_cast<net::LobbyMsgType>(0x00)));
    EXPECT_FALSE(net::isKnownLobbyType(static_cast<net::LobbyMsgType>(0x42)));
    EXPECT_FALSE(net::isKnownLobbyType(static_cast<net::LobbyMsgType>(0xFF)));
}
