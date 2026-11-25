#include "server/room.hpp"

#include "game/components.hpp"
#include "game/ecs_helpers.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/setup.hpp"
#include "game/snapshot.hpp"

#include <algorithm>
#include <exception>
#include <utility>

namespace server {

namespace {

// DESTROY reason when an entity simply left the replicated view (death,
// despawn, level reset): v1 has no finer reason.
constexpr std::uint8_t kDestroyReasonGone = 0;

net::EntityRecord toRecord(const game::SnapshotEntity &entity)
{
    net::EntityRecord record;
    record.netId = entity.netId;
    record.type = static_cast<std::uint8_t>(entity.type);
    record.team = static_cast<std::uint8_t>(entity.team);
    record.x = entity.x;
    record.y = entity.y;
    record.hp = entity.hp;
    record.extra = entity.extra;
    return record;
}

} // namespace

Room::Room(std::uint32_t roomInstance, game::Difficulty difficulty, game::GameMode mode)
    : _roomInstance(roomInstance), _difficulty(difficulty), _mode(mode)
{
    game::registerGameComponents(_registry);
    applyRules();
}

void Room::applyRules()
{
    // Before the first join: loadLevel() and spawnPlayer() read them.
    game::Rules rules = game::rulesFor(_difficulty);
    rules.mode = _mode;
    game::setRules(_registry, rules);
}

void Room::join(std::uint8_t playerId)
{
    // A player id is the ship's slot for the whole room lifetime. Re-joining
    // an existing player must not spawn a second ship, and an out-of-range id
    // must never reach spawnPlayer(), which throws.
    if (playerId >= game::kMaxPlayers || _players.contains(playerId)) {
        return;
    }
    if (!_levelLoaded) {
        game::startCampaign(_registry); // level 1, then level 2
        _levelLoaded = true;
    }
    Player player;
    player.ship = game::spawnPlayer(_registry, playerId);
    player.lastInputSeq = 0;
    player.gotInput = false;
    _players[playerId] = std::move(player);
}

void Room::leave(std::uint8_t playerId)
{
    const auto it = _players.find(playerId);
    if (it == _players.end()) {
        return;
    }
    if (_registry.isAlive(it->second.ship)) {
        _registry.killEntity(it->second.ship);
    }
    // A Force pod survives its owner's ship. Since a freed player id can be
    // reused by the next client, remove the pod too: otherwise the new player
    // would inherit the previous player's Force.
    std::vector<engine::Entity> orphanForces;
    game::forEach<game::ForcePod>(_registry, [&](engine::Entity entity, game::ForcePod &pod) {
        if (pod.ownerId == playerId) {
            orphanForces.push_back(entity);
        }
    });
    for (const auto entity : orphanForces) {
        _registry.killEntity(entity);
    }
    _players.erase(it);
}

bool Room::applyInput(std::uint8_t playerId, const net::InputMsg &input)
{
    const auto it = _players.find(playerId);
    if (it == _players.end()) {
        return false;
    }
    if (it->second.gotInput && input.inputSeq <= it->second.lastInputSeq) {
        return false;
    }
    auto *component = _registry.getComponent<game::Input>(it->second.ship);
    if (component == nullptr) {
        return false;
    }
    *component = game::inputFromMask(input.mask, input.inputSeq);
    it->second.lastInputSeq = input.inputSeq;
    it->second.gotInput = true;
    return true;
}

void Room::reset()
{
    _registry = engine::Registry{};
    game::registerGameComponents(_registry);
    applyRules();
    _tick = 0;
    _packetSeq = 0;
    _levelLoaded = false;
    _players.clear();
    _previousSnapshot = game::Snapshot{};
    _events.clear();
}

void Room::step()
{
    game::stepGame(_registry, game::kTickDt);
    ++_tick;
    collectEvents();
}

bool Room::hasPlayer(std::uint8_t playerId) const
{
    return _players.contains(playerId);
}

std::vector<std::uint8_t> Room::snapshot(std::uint8_t playerId)
{
    std::vector<std::uint8_t> datagram;
    net::Writer writer(datagram, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::Snapshot, _packetSeq++);

    // The game layer owns the replication rules (dead ships hidden, netIds,
    // boss phase, Force flag, entity cap). The room only converts them to the
    // wire records and adds the input acknowledgement. The cap is the one the
    // network layer can fit in a datagram next to the HUD rows.
    game::Snapshot full;
    try {
        full = game::collectSnapshot(_registry, net::kMaxSnapshotEntities);
    } catch (const std::exception &) {
        // Replication failure must not take the whole room down: returning an
        // empty datagram makes the caller skip this snapshot and try again.
        return {};
    }

    net::SnapshotMsg message;
    message.serverTick = _tick;
    message.state = static_cast<std::uint8_t>(full.state);
    message.players.reserve(full.players.size());
    for (const auto &player : full.players) {
        net::PlayerHud row;
        row.playerId = player.playerId;
        row.lives = player.lives;
        row.score = player.score;
        row.alive = player.alive ? 1 : 0;
        if (player.gameOver) {
            row.flags |= net::kSelfFlagGameOver;
        }
        if (player.hasMissile) {
            row.flags |= net::kSelfFlagMissile;
        }
        if (player.hasForce) {
            row.flags |= net::kSelfFlagForce;
        }
        message.players.push_back(row);

        if (player.playerId != playerId) {
            continue;
        }
        message.self.lives = player.lives;
        message.self.score = player.score;
        message.self.alive = player.alive ? 1 : 0;
        message.self.speedLevel = player.speedLevel;
        message.self.forcePower = player.forcePower;
        message.self.flags = row.flags;
    }
    // §7: the four stage bits cap the wire value at 15. Campaign levels fit;
    // endless wave 16+ is sent as 15 until a dedicated field exists.
    const auto stage = static_cast<std::uint8_t>(
        std::clamp<int>(full.stage, 1, static_cast<int>(net::kStageMask)));
    message.self.flags |= static_cast<std::uint8_t>(stage << net::kStageShift);
    if (_mode == game::GameMode::Endless) {
        message.self.flags |= net::kSelfFlagEndless;
    }

    const auto it = _players.find(playerId);
    message.ackInputSeq = it != _players.end() ? it->second.lastInputSeq : 0;
    message.entities.reserve(full.entities.size());
    for (const auto &entity : full.entities) {
        message.entities.push_back(toRecord(entity));
    }

    if (!net::encode(message, writer)) {
        datagram.clear();
    }
    return datagram;
}

void Room::collectEvents()
{
    game::Snapshot current;
    try {
        current = game::collectSnapshot(_registry, net::kMaxSnapshotEntities);
    } catch (const std::exception &) {
        // Replication failure: keep the previous snapshot and retry next tick.
        return;
    }
    const game::SnapshotDiff diff = game::diffSnapshots(_previousSnapshot, current);
    _previousSnapshot = std::move(current);
    for (const auto &entity : diff.spawned) {
        _events.push_back(makeSpawn(entity));
    }
    for (const std::uint16_t netId : diff.destroyed) {
        _events.push_back(makeDestroy(netId));
    }
}

std::vector<ReliableEvent> Room::takeEvents()
{
    std::vector<ReliableEvent> events = std::move(_events);
    _events.clear();
    return events;
}

ReliableEvent Room::makeSpawn(const game::SnapshotEntity &entity)
{
    ReliableEvent event;
    event.eventSeq = _nextEventSeq++;
    net::SpawnMsg message;
    message.eventSeq = event.eventSeq;
    message.serverTick = _tick;
    message.entity = toRecord(entity);
    net::Writer writer(event.datagram, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::Spawn, _packetSeq++);
    if (!net::encode(message, writer)) {
        event.datagram.clear();
    }
    return event;
}

ReliableEvent Room::makeDestroy(std::uint16_t netId)
{
    ReliableEvent event;
    event.eventSeq = _nextEventSeq++;
    net::DestroyMsg message;
    message.eventSeq = event.eventSeq;
    message.serverTick = _tick;
    message.netId = netId;
    message.reason = kDestroyReasonGone;
    net::Writer writer(event.datagram, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::Destroy, _packetSeq++);
    if (!net::encode(message, writer)) {
        event.datagram.clear();
    }
    return event;
}

ReliableEvent Room::gameEnd()
{
    ReliableEvent event;
    event.eventSeq = _nextEventSeq++;
    net::Writer writer(event.datagram, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::GameEnd, _packetSeq++);

    const bool victory = state() == game::RoomState::Victory;
    net::GameEndMsg message;
    message.eventSeq = event.eventSeq;
    message.serverTick = _tick;
    message.result = victory ? 1 : 2;
    message.reason = victory ? "level cleared" : "all players out";

    if (!net::encode(message, writer)) {
        event.datagram.clear();
    }
    return event;
}

} // namespace server
