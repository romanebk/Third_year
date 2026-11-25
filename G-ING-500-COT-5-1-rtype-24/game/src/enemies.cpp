#include "game/enemies.hpp"

#include "game/ecs_helpers.hpp"
#include "game/player.hpp"
#include "game/rules.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <cmath>
#include <optional>
#include <stdexcept>
#include <vector>

namespace game {

namespace {

struct EnemyStats {
    EntityType sprite;
    int hp;
    Collider box;
    std::optional<Movement> movement; // none: driven by its own system (Boss)
    int score;
    float fireCooldown; // 0 = never fires
};

EnemyStats statsOf(EnemyType type)
{
    switch (type) {
    case EnemyType::Bink:
        return {EntityType::Bink,
                kBinkHp,
                Collider{24.0f, 24.0f, kLayerEnemy, true},
                Movement{MovementType::Chase, 0.0f, 0.0f, 0.0f, kBinkSpeed},
                kBinkScore,
                0.0f};
    case EnemyType::Patapata:
        return {EntityType::Patapata,
                kPatapataHp,
                Collider{24.0f, 20.0f, kLayerEnemy, true},
                Movement{MovementType::Sine, 0.0f, kPatapataAmplitude, kPatapataFrequency,
                         kPatapataSpeed},
                kPatapataScore,
                0.0f};
    case EnemyType::Turret:
        return {EntityType::Turret,
                kTurretHp,
                Collider{28.0f, 28.0f, kLayerEnemy, true},
                Movement{MovementType::Static, 0.0f, 0.0f, 0.0f, 0.0f},
                kTurretScore,
                kTurretFireCooldown};
    case EnemyType::Carrier:
        return {EntityType::Carrier,
                kCarrierHp,
                Collider{32.0f, 24.0f, kLayerEnemy, true},
                Movement{MovementType::Straight, 0.0f, 0.0f, 0.0f, kCarrierSpeed},
                kCarrierScore,
                0.0f};
    case EnemyType::Boss:
        return {EntityType::Boss,
                kBossHp,
                Collider{kBossWidth, kBossHeight, kLayerEnemy, true},
                std::nullopt,
                kBossScore,
                0.0f}; // the boss fires from bossSystem, not enemyFireSystem
    }
    throw std::logic_error("unknown enemy type");
}

struct EnemyShot {
    Position from;
    Velocity velocity;
};

bool insideArena(const Position &p)
{
    return p.x >= 0.0f && p.x <= kArenaWidth && p.y >= 0.0f && p.y <= kArenaHeight;
}

} // namespace

Velocity aimedVelocity(const Position &from, const Position &to)
{
    const float dx = to.x - from.x;
    const float dy = to.y - from.y;
    const float length = std::sqrt(dx * dx + dy * dy);
    if (length < 1e-6f) {
        return Velocity{-kEnemyBulletSpeed, 0.0f};
    }
    return Velocity{dx / length * kEnemyBulletSpeed, dy / length * kEnemyBulletSpeed};
}

Velocity scaledVelocity(const Velocity &v, float factor)
{
    return Velocity{v.vx * factor, v.vy * factor};
}

void spawnEnemyBullet(engine::Registry &registry, const Position &from, const Velocity &velocity,
                      BulletVisual visual)
{
    Projectile projectile;
    projectile.damage = kEnemyBulletDamage;
    projectile.lifetime = kEnemyBulletLifetime;
    projectile.ownerId = -1;
    projectile.visual = visual;

    const engine::Entity bullet = registry.spawnEntity();
    registry.addComponent(bullet, from);
    registry.addComponent(bullet, velocity);
    registry.addComponent(bullet,
                          Collider{kEnemyBulletSize, kEnemyBulletSize, kLayerEnemyShot, true});
    registry.addComponent(bullet, Team::EnemyShot);
    registry.addComponent(bullet, EntityType::EnemyBullet);
    registry.addComponent(bullet, projectile);
}

int scaledEnemyHp(int baseHp, int playerCount)
{
    const int players = std::max(1, playerCount);
    const float factor = 1.0f + kEnemyHpPerExtraPlayer * static_cast<float>(players - 1);
    return static_cast<int>(std::ceil(static_cast<float>(baseHp) * factor));
}

int bossHp(int playerCount)
{
    return kBossHp + kBossHpPerExtraPlayer * (std::max(1, playerCount) - 1);
}

engine::Entity spawnEnemy(engine::Registry &registry, EnemyType type, float x, float y,
                          int playerCount)
{
    const EnemyStats stats = statsOf(type);
    const Rules rules = rulesOf(registry);
    const int baseHp =
        type == EnemyType::Boss ? bossHp(playerCount) : scaledEnemyHp(stats.hp, playerCount);
    const int hp =
        std::max(1, static_cast<int>(std::ceil(static_cast<float>(baseHp) * rules.enemyHpScale)));

    Enemy enemy;
    enemy.type = type;
    enemy.scoreValue = stats.score;
    const float fireCooldown = stats.fireCooldown * rules.enemyFireIntervalScale; // 0 stays 0
    enemy.fireCooldown = fireCooldown;
    enemy.fireTimer = fireCooldown;

    const engine::Entity e = registry.spawnEntity();
    registry.addComponent(e, Position{x, y});
    registry.addComponent(e, Velocity{});
    registry.addComponent(e, Health{hp, hp});
    registry.addComponent(e, stats.box);
    registry.addComponent(e, Team::Enemy);
    registry.addComponent(e, stats.sprite);
    registry.addComponent(e, enemy);
    if (stats.movement) {
        registry.addComponent(e, *stats.movement);
    }
    if (type == EnemyType::Boss) {
        registry.addComponent(e, BossState{});
    }
    return e;
}

void enemyFireSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    // Spawning inside forEach could reallocate the storages: collect first.
    std::vector<EnemyShot> shots;
    const Rules rules = rulesOf(registry);
    forEach<Enemy, Position>(registry, [&](engine::Entity, Enemy &enemy, Position &pos) {
        if (enemy.fireCooldown <= 0.0f) {
            return;
        }
        enemy.fireTimer -= dt;
        if (enemy.fireTimer > 0.0f || !insideArena(pos)) {
            return; // not ready, or still off screen
        }
        const auto target = nearestAlivePlayer(registry, pos.x, pos.y);
        if (!target) {
            return; // nobody to shoot at: stays ready
        }
        shots.push_back(
            {pos, scaledVelocity(aimedVelocity(pos, *target), rules.enemyBulletSpeedScale)});
        enemy.fireTimer = enemy.fireCooldown;
    });
    for (const EnemyShot &shot : shots) {
        spawnEnemyBullet(registry, shot.from, shot.velocity);
    }
}

} // namespace game
