#include "network/lobby.hpp"
#include "server/lobby.hpp"

#include <cstdint>
#include <gtest/gtest.h>
#include <string>
#include <vector>

namespace {

template <typename Message>
net::LobbyFrame frameOf(net::LobbyMsgType type, const Message &message)
{
    net::LobbyFrame frame;
    frame.type = type;
    net::Writer writer(frame.payload, net::kMaxLobbyFrame);
    EXPECT_TRUE(net::encode(message, writer));
    return frame;
}

template <typename Message>
bool findOutgoing(const std::vector<server::LobbyOutgoing> &out, std::uint32_t clientId,
                  net::LobbyMsgType type, Message &message)
{
    for (const auto &entry : out) {
        if (entry.clientId != clientId || entry.frame.size() < 3) {
            continue;
        }
        if (static_cast<net::LobbyMsgType>(entry.frame[2]) != type) {
            continue;
        }
        net::Reader reader(entry.frame.data() + 3, entry.frame.size() - 3);
        return net::decode(reader, message);
    }
    return false;
}

std::uint32_t login(server::Lobby &lobby, const std::string &name)
{
    const std::uint32_t clientId = lobby.connect();
    std::vector<server::LobbyOutgoing> out;
    net::LobbyLogin message;
    message.name = name;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::Login, message), out);
    return clientId;
}

std::uint16_t createRoom(server::Lobby &lobby, std::uint32_t clientId, const std::string &name)
{
    std::vector<server::LobbyOutgoing> out;
    net::LobbyCreateRoom message;
    message.name = name;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::CreateRoom, message), out);
    net::LobbyRoomUpdate update;
    EXPECT_TRUE(findOutgoing(out, clientId, net::LobbyMsgType::RoomUpdate, update));
    return update.roomId;
}

void joinRoom(server::Lobby &lobby, std::uint32_t clientId, std::uint16_t roomId)
{
    std::vector<server::LobbyOutgoing> out;
    net::LobbyJoinRoom message;
    message.roomId = roomId;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::JoinRoom, message), out);
}

} // namespace

TEST(LobbySession, LoginAnswersWithTheClientId)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t clientId = lobby.connect();
    std::vector<server::LobbyOutgoing> out;
    net::LobbyLogin loginMessage;
    loginMessage.name = "Momo";
    lobby.handle(clientId, frameOf(net::LobbyMsgType::Login, loginMessage), out);

    net::LobbyLoginOk ok;
    ASSERT_TRUE(findOutgoing(out, clientId, net::LobbyMsgType::LoginOk, ok));
    EXPECT_EQ(ok.clientId, clientId);
    EXPECT_EQ(lobby.loggedInCount(), 1u);
}

TEST(LobbySession, LoginRejectsADuplicateName)
{
    server::Lobby lobby(4300, "127.0.0.1");
    login(lobby, "Momo");

    const std::uint32_t second = lobby.connect();
    std::vector<server::LobbyOutgoing> out;
    net::LobbyLogin loginMessage;
    loginMessage.name = "Momo";
    lobby.handle(second, frameOf(net::LobbyMsgType::Login, loginMessage), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, second, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::NameTaken));
    EXPECT_EQ(lobby.loggedInCount(), 1u);
}

TEST(LobbySession, LoginRejectsAnEmptyName)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t clientId = lobby.connect();
    std::vector<server::LobbyOutgoing> out;
    net::LobbyLogin loginMessage;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::Login, loginMessage), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, clientId, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::BadName));
}

TEST(LobbySession, RequestsRequireLogin)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t clientId = lobby.connect();
    std::vector<server::LobbyOutgoing> out;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::ListRooms, net::LobbyListRooms{}), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, clientId, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::BadName));
}

TEST(LobbySession, CreateRoomBecomesTheHost)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");

    ASSERT_EQ(lobby.rooms().size(), 1u);
    const server::LobbyRoom &room = lobby.rooms().front();
    EXPECT_EQ(room.roomId, roomId);
    EXPECT_EQ(room.name, "Alpha");
    EXPECT_EQ(room.hostId, host);
    ASSERT_EQ(room.players.size(), 1u);
    EXPECT_EQ(room.players.front().name, "Momo");
    EXPECT_FALSE(room.started);
}

TEST(LobbySession, ListRoomsShowsTheWaitingRooms)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    createRoom(lobby, host, "Alpha");

    std::vector<server::LobbyOutgoing> out;
    lobby.handle(host, frameOf(net::LobbyMsgType::ListRooms, net::LobbyListRooms{}), out);
    net::LobbyRoomList list;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::RoomList, list));
    ASSERT_EQ(list.rooms.size(), 1u);
    EXPECT_EQ(list.rooms.front().name, "Alpha");
    EXPECT_EQ(list.rooms.front().players, 1);
    EXPECT_EQ(list.rooms.front().maxPlayers, 4);
    EXPECT_EQ(list.rooms.front().state, 0);
}

TEST(LobbySession, JoinRoomBroadcastsTheNewPlayer)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");

    std::vector<server::LobbyOutgoing> out;
    net::LobbyJoinRoom join;
    join.roomId = roomId;
    lobby.handle(guest, frameOf(net::LobbyMsgType::JoinRoom, join), out);

    net::LobbyRoomUpdate update;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::RoomUpdate, update));
    ASSERT_EQ(update.players.size(), 2u);
    EXPECT_EQ(update.players[0].clientId, host);
    EXPECT_EQ(update.players[0].isHost, 1);
    EXPECT_EQ(update.players[1].clientId, guest);
    EXPECT_EQ(update.players[1].name, "Alexis");
    EXPECT_TRUE(findOutgoing(out, guest, net::LobbyMsgType::RoomUpdate, update));
}

TEST(LobbySession, JoinUnknownRoomFails)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t clientId = login(lobby, "Momo");
    std::vector<server::LobbyOutgoing> out;
    net::LobbyJoinRoom join;
    join.roomId = 99;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::JoinRoom, join), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, clientId, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::RoomNotFound));
}

TEST(LobbySession, AFifthPlayerIsRejected)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "P0");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t p1 = login(lobby, "P1");
    const std::uint32_t p2 = login(lobby, "P2");
    const std::uint32_t p3 = login(lobby, "P3");
    joinRoom(lobby, p1, roomId);
    joinRoom(lobby, p2, roomId);
    joinRoom(lobby, p3, roomId);
    ASSERT_EQ(lobby.rooms().front().players.size(), 4u);

    const std::uint32_t extra = login(lobby, "P4");
    std::vector<server::LobbyOutgoing> out;
    net::LobbyJoinRoom join;
    join.roomId = roomId;
    lobby.handle(extra, frameOf(net::LobbyMsgType::JoinRoom, join), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, extra, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::RoomFull));
    EXPECT_EQ(lobby.rooms().front().players.size(), 4u);
}

TEST(LobbySession, ReadyIsBroadcast)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");
    joinRoom(lobby, guest, roomId);

    std::vector<server::LobbyOutgoing> out;
    net::LobbySetReady ready;
    ready.ready = 1;
    lobby.handle(guest, frameOf(net::LobbyMsgType::SetReady, ready), out);

    net::LobbyRoomUpdate update;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::RoomUpdate, update));
    ASSERT_EQ(update.players.size(), 2u);
    EXPECT_EQ(update.players[1].ready, 1);
}

TEST(LobbySession, ChatIsBroadcastToTheRoom)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");
    joinRoom(lobby, guest, roomId);

    std::vector<server::LobbyOutgoing> out;
    net::LobbyChat chat;
    chat.text = "pret ?";
    lobby.handle(guest, frameOf(net::LobbyMsgType::Chat, chat), out);

    net::LobbyChatMsg message;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::ChatMsg, message));
    EXPECT_EQ(message.fromClientId, guest);
    EXPECT_EQ(message.fromName, "Alexis");
    EXPECT_EQ(message.text, "pret ?");
    EXPECT_TRUE(findOutgoing(out, guest, net::LobbyMsgType::ChatMsg, message));
}

TEST(LobbySession, OnlyTheHostCanStart)
{
    server::Lobby lobby(4300, "10.0.0.5");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");
    joinRoom(lobby, guest, roomId);

    std::vector<server::LobbyOutgoing> out;
    lobby.handle(guest, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);
    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, guest, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::NotHost));

    out.clear();
    lobby.handle(host, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);
    net::LobbyRoomStart start;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::RoomStart, start));
    EXPECT_EQ(start.ip, "10.0.0.5");
    EXPECT_EQ(start.udpPort, 4300);
    EXPECT_EQ(start.roomInstance, 1u);
    EXPECT_EQ(start.lobbyToken, 1u);
    EXPECT_TRUE(findOutgoing(out, guest, net::LobbyMsgType::RoomStart, start));
    EXPECT_EQ(lobby.startedRoomId(), roomId);
    EXPECT_TRUE(lobby.rooms().front().started);
}

TEST(LobbySession, AStartedRoomCannotBeJoined)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    std::vector<server::LobbyOutgoing> started;
    lobby.handle(host, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), started);

    const std::uint32_t late = login(lobby, "Alexis");
    std::vector<server::LobbyOutgoing> out;
    net::LobbyJoinRoom join;
    join.roomId = roomId;
    lobby.handle(late, frameOf(net::LobbyMsgType::JoinRoom, join), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, late, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::RoomNotFound));
}

TEST(LobbySession, ASecondRoomCannotStart)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t firstHost = login(lobby, "Momo");
    createRoom(lobby, firstHost, "Alpha");
    std::vector<server::LobbyOutgoing> started;
    lobby.handle(firstHost, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), started);

    const std::uint32_t secondHost = login(lobby, "Ariel");
    createRoom(lobby, secondHost, "Beta");
    std::vector<server::LobbyOutgoing> out;
    lobby.handle(secondHost, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);

    net::LobbyErrorMsg error;
    ASSERT_TRUE(findOutgoing(out, secondHost, net::LobbyMsgType::Error, error));
    EXPECT_EQ(error.code, static_cast<std::uint8_t>(net::LobbyErrorCode::ShuttingDown));
}

TEST(LobbySession, LeavingHandsTheHostRoleOver)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");
    joinRoom(lobby, guest, roomId);

    std::vector<server::LobbyOutgoing> out;
    lobby.handle(host, frameOf(net::LobbyMsgType::LeaveRoom, net::LobbyLeaveRoom{}), out);

    net::LobbyRoomUpdate update;
    ASSERT_TRUE(findOutgoing(out, guest, net::LobbyMsgType::RoomUpdate, update));
    ASSERT_EQ(update.players.size(), 1u);
    EXPECT_EQ(update.players.front().clientId, guest);
    EXPECT_EQ(update.players.front().isHost, 1);
    EXPECT_EQ(lobby.rooms().front().hostId, guest);
}

TEST(LobbySession, DisconnectRemovesThePlayer)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");
    joinRoom(lobby, guest, roomId);

    std::vector<server::LobbyOutgoing> out;
    lobby.disconnect(guest, out);
    net::LobbyRoomUpdate update;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::RoomUpdate, update));
    EXPECT_EQ(update.players.size(), 1u);
    EXPECT_EQ(lobby.loggedInCount(), 1u);
}

TEST(LobbySession, EmptyWaitingRoomIsErased)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    createRoom(lobby, host, "Alpha");
    std::vector<server::LobbyOutgoing> out;
    lobby.disconnect(host, out);
    EXPECT_TRUE(lobby.rooms().empty());
}

TEST(LobbySession, PingIsAnswered)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t clientId = lobby.connect();
    std::vector<server::LobbyOutgoing> out;
    net::LobbyPing ping;
    ping.clientTimeMs = 4242;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::Ping, ping), out);

    net::LobbyPong pong;
    ASSERT_TRUE(findOutgoing(out, clientId, net::LobbyMsgType::Pong, pong));
    EXPECT_EQ(pong.clientTimeMs, 4242u);
}

TEST(LobbySession, ServerToClientMessagesAreIgnored)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t clientId = login(lobby, "Momo");
    std::vector<server::LobbyOutgoing> out;
    lobby.handle(clientId, frameOf(net::LobbyMsgType::RoomList, net::LobbyRoomList{}), out);
    EXPECT_TRUE(out.empty());
}

TEST(LobbySession, EmptyStartedRoomIsErased)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    createRoom(lobby, host, "Alpha");
    std::vector<server::LobbyOutgoing> started;
    lobby.handle(host, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), started);

    std::vector<server::LobbyOutgoing> out;
    lobby.disconnect(host, out);
    EXPECT_TRUE(lobby.rooms().empty());
    EXPECT_EQ(lobby.startedRoomId(), 0u);
}

TEST(LobbySession, HostCanStartTheSameRoomAgain)
{
    server::Lobby lobby(4300, "10.0.0.5", 7);
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    std::vector<server::LobbyOutgoing> out;
    lobby.handle(host, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);
    out.clear();

    lobby.handle(host, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);
    net::LobbyRoomStart start;
    ASSERT_TRUE(findOutgoing(out, host, net::LobbyMsgType::RoomStart, start));
    EXPECT_EQ(start.roomInstance, 7u);
    EXPECT_EQ(start.lobbyToken, 2u); // a new game gets a new token
    EXPECT_EQ(lobby.startedRoomId(), roomId);
    EXPECT_EQ(lobby.rooms().size(), 1u);
}

TEST(LobbySession, ANewRoomCanStartOnceTheRunningOneIsEmpty)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t firstHost = login(lobby, "Momo");
    createRoom(lobby, firstHost, "Alpha");
    std::vector<server::LobbyOutgoing> out;
    lobby.handle(firstHost, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);
    lobby.disconnect(firstHost, out);
    ASSERT_EQ(lobby.startedRoomId(), 0u);

    const std::uint32_t secondHost = login(lobby, "Ariel");
    createRoom(lobby, secondHost, "Beta");
    out.clear();
    lobby.handle(secondHost, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), out);
    net::LobbyRoomStart start;
    ASSERT_TRUE(findOutgoing(out, secondHost, net::LobbyMsgType::RoomStart, start));
    EXPECT_EQ(start.roomInstance, 1u);
    EXPECT_EQ(lobby.startedRoomId(), lobby.rooms().front().roomId);
}

TEST(LobbySession, ReadyStillWorksInAStartedRoom)
{
    server::Lobby lobby(4300, "127.0.0.1");
    const std::uint32_t host = login(lobby, "Momo");
    const std::uint16_t roomId = createRoom(lobby, host, "Alpha");
    const std::uint32_t guest = login(lobby, "Alexis");
    joinRoom(lobby, guest, roomId);
    std::vector<server::LobbyOutgoing> started;
    lobby.handle(host, frameOf(net::LobbyMsgType::Start, net::LobbyStart{}), started);

    std::vector<server::LobbyOutgoing> out;
    net::LobbySetReady ready;
    ready.ready = 1;
    lobby.handle(guest, frameOf(net::LobbyMsgType::SetReady, ready), out);
    net::LobbyRoomUpdate update;
    ASSERT_TRUE(findOutgoing(out, guest, net::LobbyMsgType::RoomUpdate, update));
    EXPECT_EQ(update.players.back().ready, 1);
}
