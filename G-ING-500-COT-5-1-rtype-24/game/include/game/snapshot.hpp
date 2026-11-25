#ifndef GAME_SNAPSHOT_HPP
#define GAME_SNAPSHOT_HPP

#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

#include <cstddef>
#include <cstdint>
#include <vector>

namespace game {

// What the server replicates, extracted from the registry (docs/game-design.md
// §10, docs/rfc-protocol.md §7). It does not depend on the network library:
// the network layer copies these fields into its own records.

// One replicated entity: the 16-byte entity record of the RFC.
struct SnapshotEntity {
    std::uint16_t netId = 0;
    EntityType type = EntityType::Ship;
    Team team = Team::Neutral;
    float x = 0.0f; // center of the entity, in game units (arena 960 x 540)
    float y = 0.0f;
    std::uint8_t hp = 0; // Health::hp clamped to 0..255, 0 when it has no Health
    // Depends on the type: Ship = lives, Force = power, Boss = phase (1 or 2),
    // PickupEnt = PickupKind (0 power, 1 speed), anything else = 0.
    std::uint8_t extra = 0;

    bool operator==(const SnapshotEntity &) const = default;
};

// The HUD data of one player (the RFC "self" block, for every player: the
// client shows all the scores).
struct SnapshotPlayer {
    std::uint8_t playerId = 0;
    std::uint8_t lives = 0; // lives left, 0 when out of lives
    std::int32_t score = 0;
    bool alive = true;
    std::uint8_t speedLevel = 0;
    std::uint8_t forcePower = 0;
    bool gameOver = false; // dead with no life left: spectating
    bool hasMissile = false;
    bool hasForce = false;

    bool operator==(const SnapshotPlayer &) const = default;
};

struct Snapshot {
    RoomState state = RoomState::Playing;
    std::uint8_t stage = 1;               // the level being played, from 1
    std::vector<SnapshotEntity> entities; // sorted by netId
    std::vector<SnapshotPlayer> players;  // sorted by playerId
};

// Gives a NetId to every entity that has an EntityType and none yet. Ids come
// from a counter (1..65535, wraps and skips the ids in use), so an id is not
// reused while the room runs. A ship keeps its id across deaths and respawns.
// Needs components registered with registerGameComponents().
void assignNetIds(engine::Registry &registry);

// Builds the snapshot of the room: calls assignNetIds(), then lists every
// entity with a Position and an EntityType, except the ships that are dead
// (the client shows them again when they respawn; they stay in `players`).
// If more than `maxEntities` entities qualify, the least important are left
// out: ships, boss, Force, enemies and enemy bullets come first, then pickups,
// then player shots, then explosions. The result is always sorted by netId.
Snapshot collectSnapshot(engine::Registry &registry,
                         std::size_t maxEntities = kMaxSnapshotEntities);

// What changed between two snapshots of the same room, to send reliable
// SPAWN / DESTROY events: the entities present only in `current`, and the
// netIds present only in `previous`.
struct SnapshotDiff {
    std::vector<SnapshotEntity> spawned;
    std::vector<std::uint16_t> destroyed;
};
SnapshotDiff diffSnapshots(const Snapshot &previous, const Snapshot &current);

} // namespace game

#endif // GAME_SNAPSHOT_HPP
