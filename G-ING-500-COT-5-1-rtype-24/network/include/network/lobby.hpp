#pragma once

#include "network/bytes.hpp"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace net {

// Wire format of the TCP lobby (docs/rfc-protocol.md §8): every frame is
// u16 length (of type + payload) | u8 type | payload, little-endian, max 1024
// bytes. TCP is a stream, so FrameReader rebuilds frames from the bytes a
// socket happened to deliver.

inline constexpr std::size_t kMaxLobbyFrame = 1024; // maximum length field value
inline constexpr std::size_t kMaxPlayerNameLength = 16;
inline constexpr std::size_t kMaxRoomNameLength = 32;
inline constexpr std::size_t kMaxChatMessageLength = 128;
inline constexpr std::size_t kMaxErrorTextLength = 128;
inline constexpr std::size_t kMaxIpLength = 15; // dotted IPv4, no port

// 0x01-0x7F client -> lobby, 0x80-0xFF lobby -> client.
enum class LobbyMsgType : std::uint8_t {
    Login = 0x01,
    ListRooms = 0x02,
    CreateRoom = 0x03,
    JoinRoom = 0x04,
    LeaveRoom = 0x05,
    SetReady = 0x06,
    Chat = 0x07,
    Start = 0x08,
    Ping = 0x09,
    LoginOk = 0x80,
    RoomList = 0x81,
    RoomUpdate = 0x82,
    ChatMsg = 0x83,
    RoomStart = 0x84,
    RoomClosed = 0x85,
    Error = 0x86,
    Pong = 0x87,
};

// §8 error codes carried by ERROR and some ROOM_CLOSED frames.
enum class LobbyErrorCode : std::uint8_t {
    BadName = 1,
    RoomFull = 2,
    RoomNotFound = 3,
    NotHost = 4,
    NameTaken = 5,
    ShuttingDown = 6,
};

// --- §8, client -> lobby -------------------------------------------------

struct LobbyLogin {
    std::string name; // <= kMaxPlayerNameLength
};

struct LobbyListRooms {}; // empty payload

struct LobbyCreateRoom {
    std::string name; // <= kMaxRoomNameLength
};

struct LobbyJoinRoom {
    std::uint16_t roomId = 0;
};

struct LobbyLeaveRoom {}; // empty payload

struct LobbySetReady {
    std::uint8_t ready = 0;
};

struct LobbyChat {
    std::string text; // <= kMaxChatMessageLength
};

struct LobbyStart {}; // empty payload, host only

struct LobbyPing {
    std::uint32_t clientTimeMs = 0;
};

// --- §8, lobby -> client -------------------------------------------------

struct LobbyLoginOk {
    std::uint32_t clientId = 0;
};

struct LobbyRoomInfo {
    std::uint16_t roomId = 0;
    std::string name; // <= kMaxRoomNameLength
    std::uint8_t players = 0;
    std::uint8_t maxPlayers = 0;
    std::uint8_t state = 0; // 0 waiting, 1 playing, 2 closed
};

struct LobbyRoomList {
    std::vector<LobbyRoomInfo> rooms; // at most 255
};

struct LobbyPlayerInfo {
    std::uint32_t clientId = 0;
    std::string name; // <= kMaxPlayerNameLength
    std::uint8_t ready = 0;
    std::uint8_t isHost = 0;
};

struct LobbyRoomUpdate {
    std::uint16_t roomId = 0;
    std::vector<LobbyPlayerInfo> players; // at most 255
};

struct LobbyChatMsg {
    std::uint32_t fromClientId = 0;
    std::string fromName; // <= kMaxPlayerNameLength
    std::string text;     // <= kMaxChatMessageLength
};

struct LobbyRoomStart {
    std::string ip; // <= kMaxIpLength
    std::uint16_t udpPort = 0;
    std::uint32_t lobbyToken = 0;
    std::uint32_t roomInstance = 0;
};

struct LobbyRoomClosed {
    std::uint8_t reason = 0;
};

struct LobbyErrorMsg {
    std::uint8_t code = 0;
    std::string text; // <= kMaxErrorTextLength
};

struct LobbyPong {
    std::uint32_t clientTimeMs = 0;
};

// --- payload encoding ----------------------------------------------------
// Same contract as network/packet.hpp: encode() appends the payload of one
// message to `w` and returns false on a field limit or a full buffer;
// decode() reads exactly one payload and rejects trailing bytes.

bool encode(const LobbyLogin &m, Writer &w);
bool encode(const LobbyListRooms &m, Writer &w);
bool encode(const LobbyCreateRoom &m, Writer &w);
bool encode(const LobbyJoinRoom &m, Writer &w);
bool encode(const LobbyLeaveRoom &m, Writer &w);
bool encode(const LobbySetReady &m, Writer &w);
bool encode(const LobbyChat &m, Writer &w);
bool encode(const LobbyStart &m, Writer &w);
bool encode(const LobbyPing &m, Writer &w);
bool encode(const LobbyLoginOk &m, Writer &w);
bool encode(const LobbyRoomList &m, Writer &w);
bool encode(const LobbyRoomUpdate &m, Writer &w);
bool encode(const LobbyChatMsg &m, Writer &w);
bool encode(const LobbyRoomStart &m, Writer &w);
bool encode(const LobbyRoomClosed &m, Writer &w);
bool encode(const LobbyErrorMsg &m, Writer &w);
bool encode(const LobbyPong &m, Writer &w);

bool decode(Reader &r, LobbyLogin &m);
bool decode(Reader &r, LobbyListRooms &m);
bool decode(Reader &r, LobbyCreateRoom &m);
bool decode(Reader &r, LobbyJoinRoom &m);
bool decode(Reader &r, LobbyLeaveRoom &m);
bool decode(Reader &r, LobbySetReady &m);
bool decode(Reader &r, LobbyChat &m);
bool decode(Reader &r, LobbyStart &m);
bool decode(Reader &r, LobbyPing &m);
bool decode(Reader &r, LobbyLoginOk &m);
bool decode(Reader &r, LobbyRoomList &m);
bool decode(Reader &r, LobbyRoomUpdate &m);
bool decode(Reader &r, LobbyChatMsg &m);
bool decode(Reader &r, LobbyRoomStart &m);
bool decode(Reader &r, LobbyRoomClosed &m);
bool decode(Reader &r, LobbyErrorMsg &m);
bool decode(Reader &r, LobbyPong &m);

// True for the 17 message types above; anything else must be dropped.
[[nodiscard]] bool isKnownLobbyType(LobbyMsgType type);

// --- framing (TCP stream) ------------------------------------------------

// One complete frame pulled out of the stream.
struct LobbyFrame {
    LobbyMsgType type{};
    std::vector<std::uint8_t> payload;
};

// Appends one complete frame (length, type, payload) to `out`. Fails when the
// payload exceeds kMaxLobbyFrame, in which case `out` is left untouched.
template <typename Message>
bool encodeFrame(LobbyMsgType type, const Message &message, std::vector<std::uint8_t> &out)
{
    std::vector<std::uint8_t> payload;
    Writer writer(payload, kMaxLobbyFrame - 1); // type byte is not payload
    if (!encode(message, writer)) {
        return false;
    }
    const std::size_t length = payload.size() + 1; // type + payload
    out.push_back(static_cast<std::uint8_t>(length & 0xFFu));
    out.push_back(static_cast<std::uint8_t>((length >> 8U) & 0xFFu));
    out.push_back(static_cast<std::uint8_t>(type));
    out.insert(out.end(), payload.begin(), payload.end());
    return true;
}

// Rebuilds frames from a TCP stream: feed() the bytes a read() returned, then
// next() as long as it returns true. A length that cannot be a lobby frame
// makes failed() true; the connection must then be closed.
class FrameReader {
public:
    // Appends received bytes. Returns false if the peer sent a frame bigger
    // than kMaxLobbyFrame; the reader is unusable from then on.
    bool feed(const std::uint8_t *data, std::size_t size);

    // Pops the oldest complete frame. Returns false when more bytes are needed.
    bool next(LobbyFrame &frame);

    [[nodiscard]] bool failed() const { return _failed; }
    [[nodiscard]] std::size_t pending() const { return _buffer.size(); }

private:
    std::vector<std::uint8_t> _buffer;
    bool _failed = false;
};

} // namespace net
