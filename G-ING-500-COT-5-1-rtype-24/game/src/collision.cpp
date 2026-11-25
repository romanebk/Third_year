#include "game/collision.hpp"

#include "game/components.hpp"
#include "game/ecs_helpers.hpp"
#include "game/pickups.hpp"
#include "game/world.hpp"

#include <cmath>
#include <unordered_set>
#include <vector>

namespace game {

namespace {

enum class Role { None, Ship, Force, Enemy, PlayerShot, EnemyShot, Pickup };

struct Candidate {
    engine::Entity entity;
    Role role;
    float x;
    float y;
    float halfW;
    float halfH;
};

Role roleOf(engine::Registry &registry, engine::Entity e, Team team)
{
    if (registry.hasComponent<ForcePod>(e)) {
        return Role::Force;
    }
    switch (team) {
    case Team::P0:
    case Team::P1:
    case Team::P2:
    case Team::P3:
        return Role::Ship;
    case Team::Enemy:
        return Role::Enemy;
    case Team::PlayerShot:
        return Role::PlayerShot;
    case Team::EnemyShot:
        return Role::EnemyShot;
    case Team::Pickup:
        return Role::Pickup;
    case Team::Neutral:
        return Role::None;
    }
    return Role::None;
}

bool overlaps(const Candidate &a, const Candidate &b)
{
    return std::abs(a.x - b.x) < a.halfW + b.halfW && std::abs(a.y - b.y) < a.halfH + b.halfH;
}

void classify(const Candidate &a, const Candidate &b, std::vector<Contact> &out)
{
    const auto pair = [&](Role first, Role second, ContactKind kind) {
        if (a.role == first && b.role == second) {
            out.push_back({a.entity, b.entity, kind});
            return true;
        }
        if (b.role == first && a.role == second) {
            out.push_back({b.entity, a.entity, kind});
            return true;
        }
        return false;
    };
    // Roles are distinct per pair, so at most one rule matches.
    (void)(pair(Role::PlayerShot, Role::Enemy, ContactKind::PlayerShotHitsEnemy) ||
           pair(Role::EnemyShot, Role::Ship, ContactKind::EnemyShotHitsPlayer) ||
           pair(Role::EnemyShot, Role::Force, ContactKind::EnemyShotAbsorbedByForce) ||
           pair(Role::Enemy, Role::Ship, ContactKind::EnemyRamsPlayer) ||
           pair(Role::Enemy, Role::Force, ContactKind::EnemyRamsForce) ||
           pair(Role::PlayerShot, Role::EnemyShot, ContactKind::ShotsCancel) ||
           pair(Role::Pickup, Role::Ship, ContactKind::PlayerCollectsPickup));
}

// Mutable state of one applyDamage() call.
class DamageResolver {
public:
    explicit DamageResolver(engine::Registry &registry) : _registry(registry) {}

    void resolve(const Contact &c)
    {
        switch (c.kind) {
        case ContactKind::PlayerShotHitsEnemy:
            playerShotHitsEnemy(c.first, c.second);
            break;
        case ContactKind::EnemyShotHitsPlayer:
            enemyShotHitsPlayer(c.first, c.second);
            break;
        case ContactKind::EnemyShotAbsorbedByForce:
            _doomed.insert(c.first);
            break;
        case ContactKind::EnemyRamsPlayer:
            enemyRamsPlayer(c.first, c.second);
            break;
        case ContactKind::EnemyRamsForce:
            enemyRamsForce(c.first, c.second);
            break;
        case ContactKind::ShotsCancel:
            shotsCancel(c.first, c.second);
            break;
        case ContactKind::PlayerCollectsPickup:
            playerCollectsPickup(c.first, c.second);
            break;
        }
    }

    // Applies the deferred kills, then spawns the explosions and the drops.
    void finish()
    {
        for (const engine::Entity e : _doomed) {
            _registry.killEntity(e);
        }
        for (const Position &where : _explosions) {
            const engine::Entity boom = _registry.spawnEntity();
            _registry.addComponent(boom, where);
            _registry.addComponent(boom, EntityType::Explosion);
            _registry.addComponent(boom, Lifetime{kExplosionLifetime});
        }
        for (const Drop &drop : _drops) {
            if (const auto kind = rollDrop(_registry, drop.type)) {
                spawnPickup(_registry, *kind, drop.where.x, drop.where.y);
            }
        }
    }

private:
    void playerShotHitsEnemy(engine::Entity shot, engine::Entity enemy)
    {
        const auto *projectile = _registry.getComponent<Projectile>(shot);
        if (projectile == nullptr || _doomed.contains(shot) || _doomed.contains(enemy)) {
            return;
        }
        const bool killed = damageEnemy(enemy, projectile->damage, projectile->ownerId);
        // A piercing shot survives only if it killed its target.
        if (!(projectile->pierce && killed)) {
            _doomed.insert(shot);
        }
    }

    void enemyShotHitsPlayer(engine::Entity shot, engine::Entity ship)
    {
        const auto *projectile = _registry.getComponent<Projectile>(shot);
        if (projectile == nullptr || _doomed.contains(shot)) {
            return;
        }
        _doomed.insert(shot);
        damagePlayer(ship, projectile->damage);
    }

    void enemyRamsPlayer(engine::Entity enemy, engine::Entity ship)
    {
        if (_doomed.contains(enemy)) {
            return;
        }
        // Both take damage; an invincible player only dodges his own.
        damagePlayer(ship, kRamDamage);
        damageEnemy(enemy, kRamDamage, -1);
    }

    void enemyRamsForce(engine::Entity enemy, engine::Entity force)
    {
        if (_doomed.contains(enemy)) {
            return;
        }
        const auto *pod = _registry.getComponent<ForcePod>(force);
        damageEnemy(enemy, kForceRamDamage, pod != nullptr ? pod->ownerId : -1);
    }

    void playerCollectsPickup(engine::Entity pickup, engine::Entity ship)
    {
        const auto *item = _registry.getComponent<Pickup>(pickup);
        if (item == nullptr || _doomed.contains(pickup)) {
            return; // already taken by another ship in this tick
        }
        applyPickup(_registry, ship, item->kind);
        _doomed.insert(pickup);
    }

    void shotsCancel(engine::Entity playerShot, engine::Entity enemyShot)
    {
        if (_doomed.contains(playerShot) || _doomed.contains(enemyShot)) {
            return;
        }
        _doomed.insert(enemyShot);
        const auto *projectile = _registry.getComponent<Projectile>(playerShot);
        if (projectile == nullptr || !projectile->pierce) {
            _doomed.insert(playerShot);
        }
    }

    // Returns true if this hit killed the enemy.
    bool damageEnemy(engine::Entity enemy, int damage, int creditedPlayerId)
    {
        auto *health = _registry.getComponent<Health>(enemy);
        if (health == nullptr || _doomed.contains(enemy)) {
            return false;
        }
        health->hp -= damage;
        if (health->hp > 0) {
            return false;
        }
        _doomed.insert(enemy);
        explodeAt(enemy);
        dropAt(enemy);
        creditKill(enemy, creditedPlayerId);
        return true;
    }

    void damagePlayer(engine::Entity ship, int damage)
    {
        auto *player = _registry.getComponent<Player>(ship);
        auto *health = _registry.getComponent<Health>(ship);
        if (player == nullptr || health == nullptr || !player->alive ||
            player->invincibleTimer > 0.0f) {
            return;
        }
        health->hp -= damage;
        if (health->hp > 0) {
            return;
        }
        // Death (§7). The ship entity stays: the respawn system revives it.
        player->alive = false;
        player->lives -= 1;
        player->respawnTimer = kRespawnDelay;
        if (auto *velocity = _registry.getComponent<Velocity>(ship)) {
            *velocity = Velocity{};
        }
        loseUpgrades(ship);
        explodeAt(ship);
    }

    // A ship that dies loses one speed level and one weapon level (§3).
    void loseUpgrades(engine::Entity ship)
    {
        if (auto *power = _registry.getComponent<PowerState>(ship); power != nullptr) {
            if (power->speedLevel > 0) {
                power->speedLevel -= 1;
            }
        }
        if (auto *weapon = _registry.getComponent<Weapon>(ship); weapon != nullptr) {
            if (weapon->level > 0) {
                weapon->level -= 1;
            }
        }
    }

    // Remembers where an enemy died, to roll its drop in finish().
    void dropAt(engine::Entity enemy)
    {
        const auto *position = _registry.getComponent<Position>(enemy);
        const auto *info = _registry.getComponent<Enemy>(enemy);
        if (position != nullptr && info != nullptr) {
            _drops.push_back({*position, info->type});
        }
    }

    void explodeAt(engine::Entity e)
    {
        if (const auto *position = _registry.getComponent<Position>(e)) {
            _explosions.push_back(*position);
        }
    }

    void creditKill(engine::Entity enemy, int playerId)
    {
        const auto *info = _registry.getComponent<Enemy>(enemy);
        if (playerId < 0 || info == nullptr) {
            return;
        }
        forEach<Player>(_registry, [&](engine::Entity, Player &player) {
            if (player.playerId == playerId) {
                player.score += info->scoreValue;
            }
        });
    }

    engine::Registry &_registry;
    std::unordered_set<engine::Entity> _doomed;
    std::vector<Position> _explosions;
    struct Drop {
        Position where;
        EnemyType type;
    };
    std::vector<Drop> _drops;
};

} // namespace

std::vector<Contact> detectCollisions(engine::Registry &registry)
{
    std::vector<Candidate> candidates;
    forEach<Position, Collider, Team>(
        registry, [&](engine::Entity e, Position &pos, Collider &box, Team &team) {
            if (!box.solid) {
                return;
            }
            const Role role = roleOf(registry, e, team);
            if (role == Role::None) {
                return;
            }
            if (role == Role::Ship) {
                const auto *player = registry.getComponent<Player>(e);
                if (player == nullptr || !player->alive) {
                    return;
                }
            }
            candidates.push_back({e, role, pos.x, pos.y, box.w * 0.5f, box.h * 0.5f});
        });

    std::vector<Contact> contacts;
    for (std::size_t i = 0; i < candidates.size(); ++i) {
        for (std::size_t j = i + 1; j < candidates.size(); ++j) {
            if (overlaps(candidates[i], candidates[j])) {
                classify(candidates[i], candidates[j], contacts);
            }
        }
    }
    return contacts;
}

void applyDamage(engine::Registry &registry, const std::vector<Contact> &contacts)
{
    DamageResolver resolver(registry);
    for (const Contact &contact : contacts) {
        resolver.resolve(contact);
    }
    resolver.finish();
}

void collisionSystem(engine::Registry &registry)
{
    applyDamage(registry, detectCollisions(registry));
}

void lifetimeSystem(engine::Registry &registry, float dt)
{
    std::vector<engine::Entity> expired;
    forEach<Lifetime>(registry, [&](engine::Entity e, Lifetime &life) {
        life.remaining -= dt;
        if (life.remaining <= 0.0f) {
            expired.push_back(e);
        }
    });
    forEach<Projectile>(registry, [&](engine::Entity e, Projectile &projectile) {
        projectile.lifetime -= dt;
        if (projectile.lifetime <= 0.0f) {
            expired.push_back(e);
        }
    });
    for (const engine::Entity e : expired) {
        registry.killEntity(e); // no-op if already dead (listed twice)
    }
}

} // namespace game
