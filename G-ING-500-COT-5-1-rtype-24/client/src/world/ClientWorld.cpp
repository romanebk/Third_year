#include "world/ClientWorld.hpp"

#include <algorithm>
#include <set>

namespace client {

void ClientWorld::setSnapshotRate(int snapshotRate)
{
    if (snapshotRate > 0) {
        _snapshotInterval = 1.0f / static_cast<float>(snapshotRate);
    }
}

WorldChanges ClientWorld::applySnapshot(const ServerMessage &snapshot)
{
    WorldChanges changes;
    // UDP can deliver old packets late: ignore anything older than what we have.
    if (_hasSnapshot && snapshot.tick <= _lastTick) {
        return changes;
    }
    _hasSnapshot = true;
    _lastTick = snapshot.tick;
    _players = snapshot.players;

    std::set<std::uint32_t> seen;
    for (const EntityInfo &info : snapshot.entities) {
        seen.insert(info.id);
        auto it = _entities.find(info.id);
        if (it == _entities.end()) {
            // New entity: it appears directly at its position.
            ClientEntity entity;
            entity.id = info.id;
            entity.type = info.type;
            entity.playerId = info.playerId;
            entity.x = info.x;
            entity.y = info.y;
            entity.startX = info.x;
            entity.startY = info.y;
            entity.targetX = info.x;
            entity.targetY = info.y;
            entity.hp = info.hp;
            entity.maxHp = info.hp;
            entity.extra = info.extra;
            _entities[info.id] = entity;
            if (info.type == game::EntityType::Boss) {
                changes.bossAppeared = true;
            }
            if (info.type == game::EntityType::PlayerBullet ||
                info.type == game::EntityType::ChargedBeam) {
                changes.newPlayerShots++;
            }
            if (info.type == game::EntityType::Explosion) {
                changes.newExplosions++;
                changes.newExplosion = info.id;
            }
            if (info.type == game::EntityType::Bink || info.type == game::EntityType::Patapata ||
                info.type == game::EntityType::Turret || info.type == game::EntityType::Carrier) {
                changes.newEnemy = info.id;
            }
        } else {
            // Known entity: slide from where it is drawn to the new position.
            ClientEntity &entity = it->second;
            entity.startX = entity.x;
            entity.startY = entity.y;
            entity.targetX = info.x;
            entity.targetY = info.y;
            entity.progress = 0.0f;
            if (entity.type == game::EntityType::Boss && info.hp < entity.hp) {
                changes.bossHit = true;
            }
            if (entity.type == game::EntityType::Boss && info.extra > entity.extra) {
                changes.bossEnraged = true; // phase 1 -> phase 2
            }
            entity.hp = info.hp;
            entity.maxHp = std::max(entity.maxHp, info.hp);
            entity.extra = info.extra;
        }
    }

    // Entities missing from the snapshot were destroyed.
    for (auto it = _entities.begin(); it != _entities.end();) {
        if (seen.count(it->first) == 0) {
            const ClientEntity &gone = it->second;
            if (gone.type == game::EntityType::Ship && gone.playerId == _localPlayer) {
                changes.localShipDestroyed = true;
            }
            if (gone.type == game::EntityType::Boss) {
                changes.bossDestroyed = true;
            }
            // A bonus leaves the game when a ship takes it, or when it leaves
            // the screen on the left: it was taken if it was still on screen.
            if (gone.type == game::EntityType::PickupEnt && gone.targetX > 0.0f) {
                if (gone.extra == static_cast<int>(game::PickupKind::Speed)) {
                    changes.speedPickups++;
                } else {
                    changes.powerPickups++;
                }
            }
            it = _entities.erase(it);
        } else {
            ++it;
        }
    }
    return changes;
}

void ClientWorld::update(float dt)
{
    for (auto &[id, entity] : _entities) {
        entity.age += dt;
        if (entity.progress >= 1.0f) {
            continue;
        }
        const float oldY = entity.y;
        entity.progress = std::min(1.0f, entity.progress + dt / _snapshotInterval);
        entity.x = entity.startX + (entity.targetX - entity.startX) * entity.progress;
        entity.y = entity.startY + (entity.targetY - entity.startY) * entity.progress;
        if (dt > 0.0f) {
            entity.speedY = (entity.y - oldY) / dt;
        }
    }
}

const ClientEntity *ClientWorld::getBoss() const
{
    for (const auto &[id, entity] : _entities) {
        if (entity.type == game::EntityType::Boss) {
            return &entity;
        }
    }
    return nullptr;
}

const ClientEntity *ClientWorld::getLocalShip() const
{
    for (const auto &[id, entity] : _entities) {
        if (entity.type == game::EntityType::Ship && entity.playerId == _localPlayer) {
            return &entity;
        }
    }
    return nullptr;
}

void ClientWorld::clear()
{
    _entities.clear();
    _players.clear();
    _lastTick = 0;
    _hasSnapshot = false;
}

} // namespace client
