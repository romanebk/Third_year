#include "network/lobby.hpp"

#include <cstddef>
#include <utility>

namespace net {

namespace {

bool encodeRoomInfo(const LobbyRoomInfo &room, Writer &w)
{
    if (room.name.size() > kMaxRoomNameLength) {
        return false;
    }
    w.u16(room.roomId);
    w.str(room.name);
    w.u8(room.players);
    w.u8(room.maxPlayers);
    w.u8(room.state);
    return w.ok();
}

bool decodeRoomInfo(Reader &r, LobbyRoomInfo &room)
{
    room.roomId = r.u16();
    r.str(room.name, kMaxRoomNameLength);
    room.players = r.u8();
    room.maxPlayers = r.u8();
    room.state = r.u8();
    return r.ok();
}

bool encodePlayerInfo(const LobbyPlayerInfo &player, Writer &w)
{
    if (player.name.size() > kMaxPlayerNameLength) {
        return false;
    }
    w.u32(player.clientId);
    w.str(player.name);
    w.u8(player.ready);
    w.u8(player.isHost);
    return w.ok();
}

bool decodePlayerInfo(Reader &r, LobbyPlayerInfo &player)
{
    player.clientId = r.u32();
    r.str(player.name, kMaxPlayerNameLength);
    player.ready = r.u8();
    player.isHost = r.u8();
    return r.ok();
}

} // namespace

// --- client -> lobby -----------------------------------------------------

bool encode(const LobbyLogin &m, Writer &w)
{
    if (m.name.size() > kMaxPlayerNameLength) {
        return false;
    }
    w.str(m.name);
    return w.ok();
}

bool encode(const LobbyListRooms &, Writer &w)
{
    return w.ok();
}

bool encode(const LobbyCreateRoom &m, Writer &w)
{
    if (m.name.size() > kMaxRoomNameLength) {
        return false;
    }
    w.str(m.name);
    return w.ok();
}

bool encode(const LobbyJoinRoom &m, Writer &w)
{
    w.u16(m.roomId);
    return w.ok();
}

bool encode(const LobbyLeaveRoom &, Writer &w)
{
    return w.ok();
}

bool encode(const LobbySetReady &m, Writer &w)
{
    w.u8(m.ready);
    return w.ok();
}

bool encode(const LobbyChat &m, Writer &w)
{
    if (m.text.size() > kMaxChatMessageLength) {
        return false;
    }
    w.str(m.text);
    return w.ok();
}

bool encode(const LobbyStart &, Writer &w)
{
    return w.ok();
}

bool encode(const LobbyPing &m, Writer &w)
{
    w.u32(m.clientTimeMs);
    return w.ok();
}

// --- lobby -> client -----------------------------------------------------

bool encode(const LobbyLoginOk &m, Writer &w)
{
    w.u32(m.clientId);
    return w.ok();
}

bool encode(const LobbyRoomList &m, Writer &w)
{
    if (m.rooms.size() > 0xFFU) {
        return false;
    }
    w.u8(static_cast<std::uint8_t>(m.rooms.size()));
    for (const auto &room : m.rooms) {
        if (!encodeRoomInfo(room, w)) {
            return false;
        }
    }
    return w.ok();
}

bool encode(const LobbyRoomUpdate &m, Writer &w)
{
    if (m.players.size() > 0xFFU) {
        return false;
    }
    w.u16(m.roomId);
    w.u8(static_cast<std::uint8_t>(m.players.size()));
    for (const auto &player : m.players) {
        if (!encodePlayerInfo(player, w)) {
            return false;
        }
    }
    return w.ok();
}

bool encode(const LobbyChatMsg &m, Writer &w)
{
    if (m.fromName.size() > kMaxPlayerNameLength || m.text.size() > kMaxChatMessageLength) {
        return false;
    }
    w.u32(m.fromClientId);
    w.str(m.fromName);
    w.str(m.text);
    return w.ok();
}

bool encode(const LobbyRoomStart &m, Writer &w)
{
    if (m.ip.size() > kMaxIpLength) {
        return false;
    }
    w.str(m.ip);
    w.u16(m.udpPort);
    w.u32(m.lobbyToken);
    w.u32(m.roomInstance);
    return w.ok();
}

bool encode(const LobbyRoomClosed &m, Writer &w)
{
    w.u8(m.reason);
    return w.ok();
}

bool encode(const LobbyErrorMsg &m, Writer &w)
{
    if (m.text.size() > kMaxErrorTextLength) {
        return false;
    }
    w.u8(m.code);
    w.str(m.text);
    return w.ok();
}

bool encode(const LobbyPong &m, Writer &w)
{
    w.u32(m.clientTimeMs);
    return w.ok();
}

// --- decoding ------------------------------------------------------------

bool decode(Reader &r, LobbyLogin &m)
{
    r.str(m.name, kMaxPlayerNameLength);
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyListRooms &)
{
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyCreateRoom &m)
{
    r.str(m.name, kMaxRoomNameLength);
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyJoinRoom &m)
{
    m.roomId = r.u16();
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyLeaveRoom &)
{
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbySetReady &m)
{
    m.ready = r.u8();
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyChat &m)
{
    r.str(m.text, kMaxChatMessageLength);
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyStart &)
{
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyPing &m)
{
    m.clientTimeMs = r.u32();
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyLoginOk &m)
{
    m.clientId = r.u32();
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyRoomList &m)
{
    m.rooms.clear();
    const auto count = r.u8();
    for (std::uint8_t index = 0; index < count && r.ok(); ++index) {
        LobbyRoomInfo room;
        if (!decodeRoomInfo(r, room)) {
            return false;
        }
        m.rooms.push_back(std::move(room));
    }
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyRoomUpdate &m)
{
    m.players.clear();
    m.roomId = r.u16();
    const auto count = r.u8();
    for (std::uint8_t index = 0; index < count && r.ok(); ++index) {
        LobbyPlayerInfo player;
        if (!decodePlayerInfo(r, player)) {
            return false;
        }
        m.players.push_back(std::move(player));
    }
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyChatMsg &m)
{
    m.fromClientId = r.u32();
    r.str(m.fromName, kMaxPlayerNameLength);
    r.str(m.text, kMaxChatMessageLength);
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyRoomStart &m)
{
    r.str(m.ip, kMaxIpLength);
    m.udpPort = r.u16();
    m.lobbyToken = r.u32();
    m.roomInstance = r.u32();
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyRoomClosed &m)
{
    m.reason = r.u8();
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyErrorMsg &m)
{
    m.code = r.u8();
    r.str(m.text, kMaxErrorTextLength);
    return r.ok() && r.remaining() == 0;
}

bool decode(Reader &r, LobbyPong &m)
{
    m.clientTimeMs = r.u32();
    return r.ok() && r.remaining() == 0;
}

bool isKnownLobbyType(LobbyMsgType type)
{
    switch (type) {
    case LobbyMsgType::Login:
    case LobbyMsgType::ListRooms:
    case LobbyMsgType::CreateRoom:
    case LobbyMsgType::JoinRoom:
    case LobbyMsgType::LeaveRoom:
    case LobbyMsgType::SetReady:
    case LobbyMsgType::Chat:
    case LobbyMsgType::Start:
    case LobbyMsgType::Ping:
    case LobbyMsgType::LoginOk:
    case LobbyMsgType::RoomList:
    case LobbyMsgType::RoomUpdate:
    case LobbyMsgType::ChatMsg:
    case LobbyMsgType::RoomStart:
    case LobbyMsgType::RoomClosed:
    case LobbyMsgType::Error:
    case LobbyMsgType::Pong:
        return true;
    }
    return false;
}

// --- framing -------------------------------------------------------------

bool FrameReader::feed(const std::uint8_t *data, std::size_t size)
{
    if (_failed) {
        return false;
    }
    _buffer.insert(_buffer.end(), data, data + size);

    if (_buffer.size() >= 2) {
        const auto length =
            static_cast<std::size_t>(_buffer[0]) | (static_cast<std::size_t>(_buffer[1]) << 8U);
        if (length == 0 || length > kMaxLobbyFrame) {
            _failed = true;
            return false;
        }
    }
    // A peer that pipelines an absurd amount of data without the caller
    // draining frames is either broken or hostile: refuse it instead of
    // growing the buffer forever.
    if (_buffer.size() > kMaxLobbyFrame * 8U) {
        _failed = true;
        return false;
    }
    return true;
}

bool FrameReader::next(LobbyFrame &frame)
{
    if (_failed || _buffer.size() < 2) {
        return false;
    }
    const auto length =
        static_cast<std::size_t>(_buffer[0]) | (static_cast<std::size_t>(_buffer[1]) << 8U);
    if (length == 0 || length > kMaxLobbyFrame) {
        _failed = true;
        return false;
    }
    const std::size_t total = 2 + length;
    if (_buffer.size() < total) {
        return false;
    }
    frame.type = static_cast<LobbyMsgType>(_buffer[2]);
    const auto payloadBegin = _buffer.begin() + 3;
    const auto payloadEnd = _buffer.begin() + static_cast<std::ptrdiff_t>(total);
    frame.payload.assign(payloadBegin, payloadEnd);
    _buffer.erase(_buffer.begin(), _buffer.begin() + static_cast<std::ptrdiff_t>(total));
    return true;
}

} // namespace net
