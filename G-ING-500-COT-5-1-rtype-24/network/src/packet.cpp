#include "network/packet.hpp"

namespace net {

namespace {

bool complete(const Reader &r)
{
    return r.ok() && r.remaining() == 0;
}

void encodeSelf(const SelfBlock &m, Writer &w)
{
    w.u8(m.lives);
    w.i32(m.score);
    w.u8(m.alive);
    w.u8(m.speedLevel);
    w.u8(m.forcePower);
    w.u8(m.flags);
}

bool decodeSelf(Reader &r, SelfBlock &m)
{
    m.lives = r.u8();
    m.score = r.i32();
    m.alive = r.u8();
    m.speedLevel = r.u8();
    m.forcePower = r.u8();
    m.flags = r.u8();
    return r.ok();
}

void encodeHud(const PlayerHud &m, Writer &w)
{
    w.u8(m.playerId);
    w.u8(m.lives);
    w.i32(m.score);
    w.u8(m.alive);
    w.u8(m.flags);
}

bool decodeHud(Reader &r, PlayerHud &m)
{
    m.playerId = r.u8();
    m.lives = r.u8();
    m.score = r.i32();
    m.alive = r.u8();
    m.flags = r.u8();
    return r.ok();
}

} // namespace

void writeHeader(Writer &w, MsgType type, std::uint32_t packetSeq)
{
    w.u8(kMagic0);
    w.u8(kMagic1);
    w.u8(kVersion);
    w.u8(static_cast<std::uint8_t>(type));
    w.u32(packetSeq);
}

HeaderStatus readHeader(const std::uint8_t *data, std::size_t size, PacketHeader &out)
{
    if (size < kHeaderSize) {
        return HeaderStatus::Truncated;
    }
    if (data[0] != kMagic0 || data[1] != kMagic1) {
        return HeaderStatus::BadMagic;
    }
    if (data[2] != kVersion) {
        return HeaderStatus::BadVersion;
    }
    Reader r(data + 2, size - 2);
    out.version = r.u8();
    out.type = static_cast<MsgType>(r.u8());
    out.packetSeq = r.u32();
    return r.ok() ? HeaderStatus::Ok : HeaderStatus::Truncated;
}

bool encode(const ConnectMsg &m, Writer &w)
{
    if (m.name.size() > kMaxNameLength) {
        return false;
    }
    w.u32(m.lobbyToken);
    w.u32(m.roomInstance);
    w.str(m.name);
    return w.ok();
}

bool encode(const InputMsg &m, Writer &w)
{
    w.u32(m.inputSeq);
    w.u8(m.mask);
    w.u8(m.prevMask);
    w.u16(m.ackEvent);
    w.u32(m.lastServerTick);
    return w.ok();
}

bool encode(const PingMsg &m, Writer &w)
{
    w.u32(m.clientTimeMs);
    w.u16(m.ackEvent);
    return w.ok();
}

bool encode(const LeaveMsg &m, Writer &w)
{
    w.u8(m.reason);
    return w.ok();
}

bool encode(const AcceptMsg &m, Writer &w)
{
    w.u8(m.playerId);
    w.u8(m.tickRate);
    w.u8(m.snapshotRate);
    w.u32(m.serverTick);
    w.u32(m.roomInstance);
    return w.ok();
}

bool encode(const EntityRecord &m, Writer &w)
{
    w.u16(m.netId);
    w.u8(m.type);
    w.u8(m.team);
    w.f32(m.x);
    w.f32(m.y);
    w.u8(m.hp);
    w.u8(m.extra);
    w.u16(m.flags);
    return w.ok();
}

bool encode(const SnapshotMsg &m, Writer &w)
{
    if (m.entities.size() > kMaxSnapshotEntities || m.players.size() > kMaxSnapshotPlayers) {
        return false;
    }
    w.u32(m.serverTick);
    w.u32(m.ackInputSeq);
    w.u16(m.ackEvent);
    w.u8(m.state);
    w.u8(static_cast<std::uint8_t>(kSelfBlockSize));
    encodeSelf(m.self, w);
    w.u8(static_cast<std::uint8_t>(m.players.size()));
    for (const PlayerHud &row : m.players) {
        encodeHud(row, w);
    }
    w.u8(static_cast<std::uint8_t>(m.entities.size()));
    for (const auto &entity : m.entities) {
        if (!encode(entity, w)) {
            return false;
        }
    }
    return w.ok();
}

bool encode(const SpawnMsg &m, Writer &w)
{
    w.u16(m.eventSeq);
    w.u32(m.serverTick);
    if (!encode(m.entity, w)) {
        return false;
    }
    return w.ok();
}

bool encode(const DestroyMsg &m, Writer &w)
{
    w.u16(m.eventSeq);
    w.u32(m.serverTick);
    w.u16(m.netId);
    w.u8(m.reason);
    return w.ok();
}

bool encode(const GameEndMsg &m, Writer &w)
{
    if (m.reason.size() > kMaxNameLength) {
        return false;
    }
    w.u16(m.eventSeq);
    w.u32(m.serverTick);
    w.u8(m.result);
    w.str(m.reason);
    return w.ok();
}

bool encode(const PongMsg &m, Writer &w)
{
    w.u32(m.clientTimeMs);
    w.u32(m.serverTimeMs);
    return w.ok();
}

bool encode(const ByeMsg &m, Writer &w)
{
    w.u8(m.reason);
    return w.ok();
}

bool decode(Reader &r, ConnectMsg &m)
{
    m.lobbyToken = r.u32();
    m.roomInstance = r.u32();
    if (!r.ok()) {
        return false;
    }
    r.str(m.name, kMaxNameLength);
    return complete(r);
}

bool decode(Reader &r, InputMsg &m)
{
    m.inputSeq = r.u32();
    m.mask = r.u8();
    m.prevMask = r.u8();
    m.ackEvent = r.u16();
    m.lastServerTick = r.u32();
    return complete(r);
}

bool decode(Reader &r, PingMsg &m)
{
    m.clientTimeMs = r.u32();
    m.ackEvent = r.u16();
    return complete(r);
}

bool decode(Reader &r, LeaveMsg &m)
{
    m.reason = r.u8();
    return complete(r);
}

bool decode(Reader &r, AcceptMsg &m)
{
    m.playerId = r.u8();
    m.tickRate = r.u8();
    m.snapshotRate = r.u8();
    m.serverTick = r.u32();
    m.roomInstance = r.u32();
    return complete(r);
}

bool decode(Reader &r, EntityRecord &m)
{
    m.netId = r.u16();
    m.type = r.u8();
    m.team = r.u8();
    m.x = r.f32();
    m.y = r.f32();
    m.hp = r.u8();
    m.extra = r.u8();
    m.flags = r.u16();
    return r.ok();
}

bool decode(Reader &r, SnapshotMsg &m)
{
    m.serverTick = r.u32();
    m.ackInputSeq = r.u32();
    m.ackEvent = r.u16();
    m.state = r.u8();
    const auto selfLength = static_cast<std::size_t>(r.u8());
    if (!r.ok() || selfLength < kSelfBlockSize) {
        return false;
    }
    if (!decodeSelf(r, m.self)) {
        return false;
    }
    r.skip(selfLength - kSelfBlockSize);
    const auto playerCount = static_cast<std::size_t>(r.u8());
    if (!r.ok() || playerCount > kMaxSnapshotPlayers) {
        return false;
    }
    m.players.clear();
    m.players.reserve(playerCount);
    for (std::size_t i = 0; i < playerCount; ++i) {
        PlayerHud row;
        if (!decodeHud(r, row)) {
            return false;
        }
        m.players.push_back(row);
    }
    const auto count = static_cast<std::size_t>(r.u8());
    if (!r.ok()) {
        return false;
    }
    m.entities.clear();
    m.entities.reserve(count);
    for (std::size_t i = 0; i < count; ++i) {
        EntityRecord entity;
        if (!decode(r, entity)) {
            return false;
        }
        m.entities.push_back(entity);
    }
    return complete(r);
}

bool decode(Reader &r, SpawnMsg &m)
{
    m.eventSeq = r.u16();
    m.serverTick = r.u32();
    if (!decode(r, m.entity)) {
        return false;
    }
    return complete(r);
}

bool decode(Reader &r, DestroyMsg &m)
{
    m.eventSeq = r.u16();
    m.serverTick = r.u32();
    m.netId = r.u16();
    m.reason = r.u8();
    return complete(r);
}

bool decode(Reader &r, GameEndMsg &m)
{
    m.eventSeq = r.u16();
    m.serverTick = r.u32();
    m.result = r.u8();
    if (!r.ok()) {
        return false;
    }
    r.str(m.reason, kMaxNameLength);
    return complete(r);
}

bool decode(Reader &r, PongMsg &m)
{
    m.clientTimeMs = r.u32();
    m.serverTimeMs = r.u32();
    return complete(r);
}

bool decode(Reader &r, ByeMsg &m)
{
    m.reason = r.u8();
    return complete(r);
}

} // namespace net
