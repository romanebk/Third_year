#include "server/lobby.hpp"

#include <algorithm>
#include <string>
#include <string_view>
#include <utility>

namespace server {

namespace {

template <typename Message>
void sendTo(std::vector<LobbyOutgoing> &out, std::uint32_t clientId, net::LobbyMsgType type,
            const Message &message)
{
    LobbyOutgoing outgoing;
    outgoing.clientId = clientId;
    if (net::encodeFrame(type, message, outgoing.frame)) {
        out.push_back(std::move(outgoing));
    }
}

void sendError(std::vector<LobbyOutgoing> &out, std::uint32_t clientId, net::LobbyErrorCode code,
               std::string_view text)
{
    net::LobbyErrorMsg message;
    message.code = static_cast<std::uint8_t>(code);
    message.text = std::string(text);
    sendTo(out, clientId, net::LobbyMsgType::Error, message);
}

net::LobbyRoomUpdate makeRoomUpdate(const LobbyRoom &room)
{
    net::LobbyRoomUpdate update;
    update.roomId = room.roomId;
    update.players.reserve(room.players.size());
    for (const auto &player : room.players) {
        net::LobbyPlayerInfo info;
        info.clientId = player.clientId;
        info.name = player.name;
        info.ready = player.ready ? 1 : 0;
        info.isHost = player.clientId == room.hostId ? 1 : 0;
        update.players.push_back(std::move(info));
    }
    return update;
}

void broadcastRoomUpdate(std::vector<LobbyOutgoing> &out, const LobbyRoom &room)
{
    const net::LobbyRoomUpdate update = makeRoomUpdate(room);
    for (const auto &player : room.players) {
        sendTo(out, player.clientId, net::LobbyMsgType::RoomUpdate, update);
    }
}

} // namespace

Lobby::Lobby(std::uint16_t udpPort, std::string roomHost, std::uint32_t roomInstance)
    : _udpPort(udpPort), _roomInstance(roomInstance), _roomHost(std::move(roomHost))
{
}

std::uint32_t Lobby::connect()
{
    const std::uint32_t clientId = _nextClientId++;
    _sessions.emplace(clientId, Session{});
    return clientId;
}

void Lobby::disconnect(std::uint32_t clientId, std::vector<LobbyOutgoing> &out)
{
    removeFromRoom(clientId, out);
    _sessions.erase(clientId);
}

void Lobby::handle(std::uint32_t clientId, const net::LobbyFrame &frame,
                   std::vector<LobbyOutgoing> &out)
{
    if (!net::isKnownLobbyType(frame.type)) {
        return;
    }
    net::Reader reader(frame.payload.data(), frame.payload.size());
    switch (frame.type) {
    case net::LobbyMsgType::Login: {
        net::LobbyLogin message;
        if (net::decode(reader, message)) {
            login(clientId, message, out);
        }
        break;
    }
    case net::LobbyMsgType::ListRooms: {
        net::LobbyListRooms message;
        if (net::decode(reader, message)) {
            listRooms(clientId, out);
        }
        break;
    }
    case net::LobbyMsgType::CreateRoom: {
        net::LobbyCreateRoom message;
        if (net::decode(reader, message)) {
            createRoom(clientId, message, out);
        }
        break;
    }
    case net::LobbyMsgType::JoinRoom: {
        net::LobbyJoinRoom message;
        if (net::decode(reader, message)) {
            joinRoom(clientId, message, out);
        }
        break;
    }
    case net::LobbyMsgType::LeaveRoom: {
        net::LobbyLeaveRoom message;
        if (net::decode(reader, message)) {
            leaveRoom(clientId, out);
        }
        break;
    }
    case net::LobbyMsgType::SetReady: {
        net::LobbySetReady message;
        if (net::decode(reader, message)) {
            setReady(clientId, message, out);
        }
        break;
    }
    case net::LobbyMsgType::Chat: {
        net::LobbyChat message;
        if (net::decode(reader, message)) {
            chat(clientId, message, out);
        }
        break;
    }
    case net::LobbyMsgType::Start: {
        net::LobbyStart message;
        if (net::decode(reader, message)) {
            start(clientId, out);
        }
        break;
    }
    case net::LobbyMsgType::Ping: {
        net::LobbyPing message;
        if (net::decode(reader, message)) {
            net::LobbyPong pong;
            pong.clientTimeMs = message.clientTimeMs;
            sendTo(out, clientId, net::LobbyMsgType::Pong, pong);
        }
        break;
    }
    default:
        // A client sending a lobby -> client type is ignored.
        break;
    }
}

const LobbyRoom *Lobby::findRoom(std::uint16_t roomId) const
{
    const auto it = std::find_if(_rooms.begin(), _rooms.end(),
                                 [roomId](const LobbyRoom &room) { return room.roomId == roomId; });
    return it == _rooms.end() ? nullptr : &*it;
}

LobbyRoom *Lobby::findRoomMutable(std::uint16_t roomId)
{
    const auto it = std::find_if(_rooms.begin(), _rooms.end(),
                                 [roomId](const LobbyRoom &room) { return room.roomId == roomId; });
    return it == _rooms.end() ? nullptr : &*it;
}

std::size_t Lobby::loggedInCount() const
{
    return static_cast<std::size_t>(
        std::count_if(_sessions.begin(), _sessions.end(),
                      [](const auto &entry) { return entry.second.loggedIn; }));
}

void Lobby::login(std::uint32_t clientId, const net::LobbyLogin &message,
                  std::vector<LobbyOutgoing> &out)
{
    const auto session = _sessions.find(clientId);
    if (session == _sessions.end() || session->second.loggedIn) {
        return; // unknown connection, or LOGIN retried after success
    }
    if (message.name.empty()) {
        sendError(out, clientId, net::LobbyErrorCode::BadName, "name is empty");
        return;
    }
    if (isNameTaken(message.name)) {
        sendError(out, clientId, net::LobbyErrorCode::NameTaken, "name already used");
        return;
    }
    session->second.name = message.name;
    session->second.loggedIn = true;
    net::LobbyLoginOk ok;
    ok.clientId = clientId;
    sendTo(out, clientId, net::LobbyMsgType::LoginOk, ok);
}

void Lobby::listRooms(std::uint32_t clientId, std::vector<LobbyOutgoing> &out)
{
    if (!requireLogin(clientId, out)) {
        return;
    }
    net::LobbyRoomList list;
    for (const auto &room : _rooms) {
        net::LobbyRoomInfo info;
        info.roomId = room.roomId;
        info.name = room.name;
        info.players = static_cast<std::uint8_t>(room.players.size());
        info.maxPlayers = static_cast<std::uint8_t>(kMaxPlayersPerRoom);
        info.state = room.started ? 1 : 0;
        list.rooms.push_back(std::move(info));
    }
    sendTo(out, clientId, net::LobbyMsgType::RoomList, list);
}

void Lobby::createRoom(std::uint32_t clientId, const net::LobbyCreateRoom &message,
                       std::vector<LobbyOutgoing> &out)
{
    if (!requireLogin(clientId, out)) {
        return;
    }
    if (_rooms.size() >= kMaxRooms) {
        sendError(out, clientId, net::LobbyErrorCode::ShuttingDown, "lobby is full");
        return;
    }
    removeFromRoom(clientId, out);

    LobbyRoom room;
    room.roomId = _nextRoomId++;
    room.name = message.name;
    room.hostId = clientId;
    room.players.push_back(LobbyPlayer{clientId, _sessions.at(clientId).name, false});
    _rooms.push_back(std::move(room));
    _sessions.at(clientId).roomId = _rooms.back().roomId;
    broadcastRoomUpdate(out, _rooms.back());
}

void Lobby::joinRoom(std::uint32_t clientId, const net::LobbyJoinRoom &message,
                     std::vector<LobbyOutgoing> &out)
{
    if (!requireLogin(clientId, out)) {
        return;
    }
    const LobbyRoom *target = findRoom(message.roomId);
    if (target == nullptr) {
        sendError(out, clientId, net::LobbyErrorCode::RoomNotFound, "room not found");
        return;
    }
    if (target->started) {
        sendError(out, clientId, net::LobbyErrorCode::RoomNotFound, "room already started");
        return;
    }
    if (target->players.size() >= kMaxPlayersPerRoom) {
        sendError(out, clientId, net::LobbyErrorCode::RoomFull, "room is full");
        return;
    }
    const auto session = _sessions.find(clientId);
    if (session != _sessions.end() && session->second.roomId == message.roomId) {
        broadcastRoomUpdate(out, *target); // already inside: just refresh the view
        return;
    }
    removeFromRoom(clientId, out); // joining another room leaves the current one
    // removeFromRoom() may erase or reorder rooms, so look the room up again.
    LobbyRoom *room = findRoomMutable(message.roomId);
    if (room == nullptr) {
        sendError(out, clientId, net::LobbyErrorCode::RoomNotFound, "room not found");
        return;
    }
    room->players.push_back(LobbyPlayer{clientId, _sessions.at(clientId).name, false});
    _sessions.at(clientId).roomId = room->roomId;
    broadcastRoomUpdate(out, *room);
}

void Lobby::leaveRoom(std::uint32_t clientId, std::vector<LobbyOutgoing> &out)
{
    if (!requireLogin(clientId, out)) {
        return;
    }
    removeFromRoom(clientId, out);
}

void Lobby::setReady(std::uint32_t clientId, const net::LobbySetReady &message,
                     std::vector<LobbyOutgoing> &out)
{
    LobbyRoom *room = roomOf(clientId);
    if (room == nullptr) {
        sendError(out, clientId, net::LobbyErrorCode::RoomNotFound, "not in a room");
        return;
    }
    const auto player = std::find_if(
        room->players.begin(), room->players.end(),
        [clientId](const LobbyPlayer &candidate) { return candidate.clientId == clientId; });
    if (player == room->players.end()) {
        return;
    }
    player->ready = message.ready != 0;
    broadcastRoomUpdate(out, *room);
}

void Lobby::chat(std::uint32_t clientId, const net::LobbyChat &message,
                 std::vector<LobbyOutgoing> &out)
{
    LobbyRoom *room = roomOf(clientId);
    if (room == nullptr) {
        sendError(out, clientId, net::LobbyErrorCode::RoomNotFound, "not in a room");
        return;
    }
    net::LobbyChatMsg chatMessage;
    chatMessage.fromClientId = clientId;
    chatMessage.fromName = _sessions.at(clientId).name;
    chatMessage.text = message.text;
    for (const auto &player : room->players) {
        sendTo(out, player.clientId, net::LobbyMsgType::ChatMsg, chatMessage);
    }
}

void Lobby::start(std::uint32_t clientId, std::vector<LobbyOutgoing> &out)
{
    LobbyRoom *room = roomOf(clientId);
    if (room == nullptr) {
        sendError(out, clientId, net::LobbyErrorCode::RoomNotFound, "not in a room");
        return;
    }
    if (room->hostId != clientId) {
        sendError(out, clientId, net::LobbyErrorCode::NotHost, "only the host can start");
        return;
    }
    if (_startedRoom != 0 && _startedRoom != room->roomId) {
        sendError(out, clientId, net::LobbyErrorCode::ShuttingDown, "another room is running");
        return;
    }
    room->started = true;
    room->udpPort = _udpPort;
    room->roomInstance = _roomInstance;
    _startedRoom = room->roomId;

    net::LobbyRoomStart startMessage;
    startMessage.ip = _roomHost;
    startMessage.udpPort = room->udpPort;
    startMessage.lobbyToken = _nextLobbyToken++;
    startMessage.roomInstance = room->roomInstance;
    for (const auto &player : room->players) {
        sendTo(out, player.clientId, net::LobbyMsgType::RoomStart, startMessage);
    }
}

void Lobby::removeFromRoom(std::uint32_t clientId, std::vector<LobbyOutgoing> &out)
{
    const auto session = _sessions.find(clientId);
    if (session == _sessions.end() || !session->second.roomId) {
        return;
    }
    const std::uint16_t roomId = *session->second.roomId;
    session->second.roomId.reset();

    LobbyRoom *room = findRoomMutable(roomId);
    if (room == nullptr) {
        return;
    }
    const auto player = std::find_if(
        room->players.begin(), room->players.end(),
        [clientId](const LobbyPlayer &candidate) { return candidate.clientId == clientId; });
    if (player != room->players.end()) {
        room->players.erase(player);
    }
    if (room->players.empty()) {
        // Nobody left: a waiting room is deleted, and an empty started room is
        // only remembered through startedRoomId() (one game per lobby run).
        const auto erased =
            std::find_if(_rooms.begin(), _rooms.end(),
                         [roomId](const LobbyRoom &entry) { return entry.roomId == roomId; });
        if (erased != _rooms.end()) {
            if (erased->roomId == _startedRoom) {
                _startedRoom = 0; // the room process is free for the next game
            }
            _rooms.erase(erased);
        }
        return;
    }
    if (room->hostId == clientId) {
        room->hostId = room->players.front().clientId;
    }
    broadcastRoomUpdate(out, *room);
}

LobbyRoom *Lobby::roomOf(std::uint32_t clientId)
{
    const auto session = _sessions.find(clientId);
    if (session == _sessions.end() || !session->second.roomId) {
        return nullptr;
    }
    return findRoomMutable(*session->second.roomId);
}

bool Lobby::isNameTaken(const std::string &name) const
{
    return std::any_of(_sessions.begin(), _sessions.end(), [&name](const auto &entry) {
        return entry.second.loggedIn && entry.second.name == name;
    });
}

bool Lobby::requireLogin(std::uint32_t clientId, std::vector<LobbyOutgoing> &out)
{
    const auto session = _sessions.find(clientId);
    if (session != _sessions.end() && session->second.loggedIn) {
        return true;
    }
    sendError(out, clientId, net::LobbyErrorCode::BadName, "login first");
    return false;
}

} // namespace server
