#include "game/snapshot.hpp"

#include "game/ecs_helpers.hpp"
#include "game/level.hpp"

#include <algorithm>
#include <stdexcept>
#include <unordered_set>

namespace game {

namespace {

std::uint8_t clampByte(int value)
{
    return static_cast<std::uint8_t>(std::clamp(value, 0, 255));
}

// Lower is more important when a snapshot has to be cut.
int priorityOf(EntityType type)
{
    switch (type) {
    case EntityType::Ship:
        return 0;
    case EntityType::Boss:
        return 1;
    case EntityType::Force:
        return 2;
    case EntityType::Bink:
    case EntityType::Patapata:
    case EntityType::Turret:
    case EntityType::Carrier:
        return 3;
    case EntityType::EnemyBullet:
        return 4;
    case EntityType::PickupEnt:
        return 5;
    case EntityType::ChargedBeam:
        return 6;
    case EntityType::PlayerBullet:
    case EntityType::Missile:
        return 7;
    case EntityType::Explosion:
        return 8;
    }
    return 9;
}

std::uint16_t allocateNetId(NetIdAllocator &allocator,
                            const std::unordered_set<std::uint16_t> &used)
{
    for (int attempt = 0; attempt < 65535; ++attempt) {
        const std::uint16_t candidate = allocator.next;
        allocator.next =
            candidate == 65535 ? std::uint16_t{1} : static_cast<std::uint16_t>(candidate + 1);
        if (candidate != 0 && !used.contains(candidate)) {
            return candidate;
        }
    }
    throw std::runtime_error("no free netId left");
}

std::uint8_t extraOf(engine::Registry &registry, engine::Entity e, EntityType type)
{
    switch (type) {
    case EntityType::Ship:
        if (const auto *player = registry.getComponent<Player>(e)) {
            return clampByte(player->lives);
        }
        return 0;
    case EntityType::Force:
        if (const auto *pod = registry.getComponent<ForcePod>(e)) {
            return pod->power;
        }
        return 0;
    case EntityType::Boss:
        if (const auto *boss = registry.getComponent<BossState>(e)) {
            return boss->phase;
        }
        return 0;
    case EntityType::EnemyBullet:
        if (const auto *projectile = registry.getComponent<Projectile>(e)) {
            return static_cast<std::uint8_t>(projectile->visual);
        }
        return 0;
    case EntityType::PickupEnt:
        if (const auto *pickup = registry.getComponent<Pickup>(e)) {
            return static_cast<std::uint8_t>(pickup->kind);
        }
        return 0;
    default:
        return 0;
    }
}

} // namespace

void assignNetIds(engine::Registry &registry)
{
    std::vector<engine::Entity> missing;
    std::unordered_set<std::uint16_t> used;
    forEach<EntityType>(registry, [&](engine::Entity e, EntityType &) {
        if (const auto *id = registry.getComponent<NetId>(e)) {
            used.insert(id->value);
        } else {
            missing.push_back(e);
        }
    });
    if (missing.empty()) {
        return;
    }

    std::vector<engine::Entity> allocators;
    forEach<NetIdAllocator>(registry,
                            [&](engine::Entity e, NetIdAllocator &) { allocators.push_back(e); });
    const engine::Entity holder = allocators.empty() ? registry.spawnEntity() : allocators.front();
    if (allocators.empty()) {
        registry.addComponent(holder, NetIdAllocator{});
    }
    NetIdAllocator &allocator = *registry.getComponent<NetIdAllocator>(holder);

    for (const engine::Entity e : missing) {
        const std::uint16_t id = allocateNetId(allocator, used);
        used.insert(id);
        registry.addComponent(e, NetId{id});
    }
}

Snapshot collectSnapshot(engine::Registry &registry, std::size_t maxEntities)
{
    assignNetIds(registry);

    Snapshot snapshot;
    snapshot.state = roomState(registry);
    snapshot.stage = static_cast<std::uint8_t>(std::clamp(currentStage(registry), 1, 255));

    struct Candidate {
        int priority;
        SnapshotEntity entity;
    };
    std::vector<Candidate> candidates;
    forEach<EntityType, Position, NetId>(
        registry, [&](engine::Entity e, EntityType &type, Position &pos, NetId &id) {
            const auto *player = registry.getComponent<Player>(e);
            if (player != nullptr && !player->alive) {
                return; // not shown until it respawns
            }
            SnapshotEntity entity;
            entity.netId = id.value;
            entity.type = type;
            if (const auto *team = registry.getComponent<Team>(e)) {
                entity.team = *team;
            }
            entity.x = pos.x;
            entity.y = pos.y;
            if (const auto *health = registry.getComponent<Health>(e)) {
                entity.hp = clampByte(health->hp);
            }
            entity.extra = extraOf(registry, e, type);
            candidates.push_back({priorityOf(type), entity});
        });

    if (candidates.size() > maxEntities) {
        std::stable_sort(candidates.begin(), candidates.end(),
                         [](const Candidate &a, const Candidate &b) {
                             if (a.priority != b.priority) {
                                 return a.priority < b.priority;
                             }
                             return a.entity.netId < b.entity.netId;
                         });
        candidates.resize(maxEntities);
    }
    for (const Candidate &candidate : candidates) {
        snapshot.entities.push_back(candidate.entity);
    }
    std::sort(snapshot.entities.begin(), snapshot.entities.end(),
              [](const SnapshotEntity &a, const SnapshotEntity &b) { return a.netId < b.netId; });

    std::unordered_set<int> forceOwners;
    forEach<ForcePod>(registry,
                      [&](engine::Entity, ForcePod &pod) { forceOwners.insert(pod.ownerId); });
    forEach<Player>(registry, [&](engine::Entity e, Player &player) {
        SnapshotPlayer info;
        info.playerId = clampByte(player.playerId);
        info.lives = clampByte(player.lives);
        info.score = player.score;
        info.alive = player.alive;
        info.gameOver = !player.alive && player.lives < 0;
        info.hasForce = forceOwners.contains(player.playerId);
        if (const auto *power = registry.getComponent<PowerState>(e)) {
            info.speedLevel = power->speedLevel;
            info.forcePower = power->forcePower;
            info.hasMissile = power->hasMissile;
        }
        snapshot.players.push_back(info);
    });
    std::sort(
        snapshot.players.begin(), snapshot.players.end(),
        [](const SnapshotPlayer &a, const SnapshotPlayer &b) { return a.playerId < b.playerId; });
    return snapshot;
}

SnapshotDiff diffSnapshots(const Snapshot &previous, const Snapshot &current)
{
    std::unordered_set<std::uint16_t> before;
    for (const SnapshotEntity &entity : previous.entities) {
        before.insert(entity.netId);
    }
    std::unordered_set<std::uint16_t> after;
    SnapshotDiff diff;
    for (const SnapshotEntity &entity : current.entities) {
        after.insert(entity.netId);
        if (!before.contains(entity.netId)) {
            diff.spawned.push_back(entity);
        }
    }
    for (const SnapshotEntity &entity : previous.entities) {
        if (!after.contains(entity.netId)) {
            diff.destroyed.push_back(entity.netId);
        }
    }
    return diff;
}

} // namespace game
