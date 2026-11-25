#pragma once

#include "network/bytes.hpp"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace net {

// Wire format of docs/rfc-protocol.md v0.1: everything that travels over UDP
// between r-type_server and r-type_client. The sizes and field orders below
// are the normative layout of that RFC; any change bumps kVersion (§10).

inline constexpr std::uint8_t kMagic0 = 0x52; // 'R'
inline constexpr std::uint8_t kMagic1 = 0x54; // 'T'
inline constexpr std::uint8_t kVersion = 1;
inline constexpr std::size_t kHeaderSize = 8;
inline constexpr std::size_t kMaxUdpDatagram = 1200;  // §2: safe under a 1500 MTU
inline constexpr std::size_t kEntityRecordSize = 16;  // §7.1
inline constexpr std::size_t kSelfBlockSize = 9;      // §7
inline constexpr std::size_t kPlayerHudSize = 8;      // §7: one HUD row
inline constexpr std::size_t kMaxSnapshotPlayers = 4; // one per player slot
inline constexpr std::size_t kMaxEntities = 255;      // u8 count of SNAPSHOT

// Payload bytes of a SNAPSHOT before the entity records: fixed fields, the
// self block, the HUD rows and both u8 counts.
inline constexpr std::size_t kSnapshotHeaderSize =
    4 + 4 + 2 + 1 + 1 + kSelfBlockSize + 1 + kMaxSnapshotPlayers * kPlayerHudSize + 1;
// Largest entity count that still fits one datagram with a full player list.
inline constexpr std::size_t kMaxSnapshotEntities =
    (kMaxUdpDatagram - kHeaderSize - kSnapshotHeaderSize) / kEntityRecordSize;
inline constexpr std::size_t kMaxNameLength = 16; // §2: game message strings
inline constexpr std::uint8_t kTickRate = 60;     // INPUT rate, matches kTickDt
inline constexpr std::uint8_t kSnapshotRate = 20; // §10

// §6 (client → server) and §7 (server → client). Any other value does not
// exist on the wire and is dropped by the room loop (§13).
enum class MsgType : std::uint8_t {
    Connect = 0x01,
    Input = 0x02,
    Ping = 0x03,
    Leave = 0x04,
    Accept = 0x80,
    Snapshot = 0x81,
    Spawn = 0x82,
    Destroy = 0x83,
    GameEnd = 0x84,
    Pong = 0x85,
    Bye = 0x86,
};

// Why a datagram was refused before its payload was even looked at (§4, §10).
// The room loop keeps one counter per value and drops the packet in every
// case but Ok.
enum class HeaderStatus : std::uint8_t {
    Ok,
    Truncated, // fewer than kHeaderSize bytes
    BadMagic,  // not "RT"
    BadVersion // not kVersion
};

struct PacketHeader {
    std::uint8_t version = kVersion;
    MsgType type{}; // 0 is not a valid message type
    std::uint32_t packetSeq = 0;
};

// Appends the 8-byte header (§4) to the buffer: magic, version, type, and the
// per-sender little-endian packetSeq counter.
void writeHeader(Writer &w, MsgType type, std::uint32_t packetSeq);

// Parses the header of a datagram; the payload, if any, starts at kHeaderSize.
[[nodiscard]] HeaderStatus readHeader(const std::uint8_t *data, std::size_t size,
                                      PacketHeader &out);

// --- §6, client → server -------------------------------------------------

// 0x01, sent three times until ACCEPT. Name is at most kMaxNameLength bytes.
struct ConnectMsg {
    std::uint32_t lobbyToken = 0;
    std::uint32_t roomInstance = 0;
    std::string name;
};

// 0x02, 12-byte payload at 60 Hz. `mask` uses the bit order of
// game::inputMask (0=up 1=down 2=left 3=right 4=fire 5=detach); `prevMask`
// carries the previous frame so one lost datagram is recovered by the next.
struct InputMsg {
    std::uint32_t inputSeq = 0;
    std::uint8_t mask = 0;
    std::uint8_t prevMask = 0;
    std::uint16_t ackEvent = 0;
    std::uint32_t lastServerTick = 0;
};

// 0x03, RTT probe piggybacking the reliable-event ack.
struct PingMsg {
    std::uint32_t clientTimeMs = 0;
    std::uint16_t ackEvent = 0;
};

// 0x04, best-effort goodbye (the timeout is the fallback, §9).
struct LeaveMsg {
    std::uint8_t reason = 0;
};

// --- §7, server → client -------------------------------------------------

// 0x80, first answer to CONNECT; `roomInstance` must be echoed back by later
// packets so a stale datagram from a previous room instance is rejected.
struct AcceptMsg {
    std::uint8_t playerId = 0;
    std::uint8_t tickRate = 0;
    std::uint8_t snapshotRate = 0;
    std::uint32_t serverTick = 0;
    std::uint32_t roomInstance = 0;
};

// §7.1, exactly kEntityRecordSize bytes on the wire.
// `type` is a game::EntityType and `team` a game::Team, kept as raw bytes so
// that network/ does not depend on game/.
struct EntityRecord {
    std::uint16_t netId = 0;
    std::uint8_t type = 0;
    std::uint8_t team = 0;
    float x = 0.0f;
    float y = 0.0f;
    std::uint8_t hp = 0;
    std::uint8_t extra = 0;
    std::uint16_t flags = 0;
};

// §7, the per-client HUD block, kSelfBlockSize bytes.
struct SelfBlock {
    std::uint8_t lives = 0;
    std::int32_t score = 0;
    std::uint8_t alive = 0;
    std::uint8_t speedLevel = 0;
    std::uint8_t forcePower = 0;
    std::uint8_t flags = 0;
};

// Bits 0-3 of SelfBlock::flags (bits 0-2 are also used in PlayerHud::flags).
inline constexpr std::uint8_t kSelfFlagGameOver = 0x01;
inline constexpr std::uint8_t kSelfFlagMissile = 0x02;
inline constexpr std::uint8_t kSelfFlagForce = 0x04;
// Bit 3 tells the client the room plays endless waves: the stage bits then
// carry the wave number instead of a campaign level. It is global to the
// room, so it is only in self[], not in hud[].
inline constexpr std::uint8_t kSelfFlagEndless = 0x08;
// Bits 4-7 of SelfBlock::flags carry the current campaign stage or endless
// wave (1..15), so the client can switch its background and music without a
// format change.
inline constexpr std::uint8_t kStageShift = 4;
inline constexpr std::uint8_t kStageMask = 0x0F;

[[nodiscard]] constexpr std::uint8_t snapshotStage(const SelfBlock &self)
{
    return static_cast<std::uint8_t>((self.flags >> kStageShift) & kStageMask);
}

[[nodiscard]] constexpr bool snapshotEndless(const SelfBlock &self)
{
    return (self.flags & kSelfFlagEndless) != 0;
}

// §7, one HUD row per player, kPlayerHudSize bytes: every snapshot carries
// all of them, so each client can show the scoreboard of the whole room.
struct PlayerHud {
    std::uint8_t playerId = 0;
    std::uint8_t lives = 0;
    std::int32_t score = 0;
    std::uint8_t alive = 0;
    std::uint8_t flags = 0; // same bits as SelfBlock.flags
};

// 0x81, unreliable full state (§7, §10): applied only when serverTick is
// newer than the last one, which is what makes it self-healing.
// `state` is a game::RoomState: 0 playing, 1 victory, 2 defeat.
struct SnapshotMsg {
    std::uint32_t serverTick = 0;
    std::uint32_t ackInputSeq = 0;
    std::uint16_t ackEvent = 0;
    std::uint8_t state = 0;
    SelfBlock self;
    std::vector<PlayerHud> players;
    std::vector<EntityRecord> entities;
};

// 0x82, reliable (§5): `eventSeq` starts the reliable stream of the sender.
struct SpawnMsg {
    std::uint16_t eventSeq = 0;
    std::uint32_t serverTick = 0;
    EntityRecord entity;
};

// 0x83, reliable (§5).
struct DestroyMsg {
    std::uint16_t eventSeq = 0;
    std::uint32_t serverTick = 0;
    std::uint16_t netId = 0;
    std::uint8_t reason = 0;
};

// 0x84, reliable (§5); `result` is 1 victory, 2 defeat.
struct GameEndMsg {
    std::uint16_t eventSeq = 0;
    std::uint32_t serverTick = 0;
    std::uint8_t result = 0;
    std::string reason;
};

// 0x85, answer to PING: echoes clientTimeMs, adds the server clock.
struct PongMsg {
    std::uint32_t clientTimeMs = 0;
    std::uint32_t serverTimeMs = 0;
};

// 0x86, best-effort goodbye from the server (§9).
struct ByeMsg {
    std::uint8_t reason = 0;
};

// --- encoding ------------------------------------------------------------
// Each encode() appends the payload of its message to `w` (the caller writes
// the header first with writeHeader) and returns false when a field limit or
// the buffer capacity is exceeded; the caller then discards the whole buffer.

bool encode(const ConnectMsg &m, Writer &w);
bool encode(const InputMsg &m, Writer &w);
bool encode(const PingMsg &m, Writer &w);
bool encode(const LeaveMsg &m, Writer &w);
bool encode(const AcceptMsg &m, Writer &w);
bool encode(const EntityRecord &m, Writer &w);
bool encode(const SnapshotMsg &m, Writer &w);
bool encode(const SpawnMsg &m, Writer &w);
bool encode(const DestroyMsg &m, Writer &w);
bool encode(const GameEndMsg &m, Writer &w);
bool encode(const PongMsg &m, Writer &w);
bool encode(const ByeMsg &m, Writer &w);

// --- decoding ------------------------------------------------------------
// Each decode() reads the payload of one message from a Reader over the bytes
// that follow the header. It returns false on truncation, on a violated field
// limit and on trailing bytes the message does not know about: a packet is
// accepted only when it is exactly the message it claims to be (§2). It never
// throws and never reads past the end. EntityRecord is the only nested
// message, so it accepts trailing bytes.

bool decode(Reader &r, ConnectMsg &m);
bool decode(Reader &r, InputMsg &m);
bool decode(Reader &r, PingMsg &m);
bool decode(Reader &r, LeaveMsg &m);
bool decode(Reader &r, AcceptMsg &m);
bool decode(Reader &r, EntityRecord &m);
bool decode(Reader &r, SnapshotMsg &m);
bool decode(Reader &r, SpawnMsg &m);
bool decode(Reader &r, DestroyMsg &m);
bool decode(Reader &r, GameEndMsg &m);
bool decode(Reader &r, PongMsg &m);
bool decode(Reader &r, ByeMsg &m);

} // namespace net
