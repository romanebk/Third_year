#ifndef GAME_ENEMIES_HPP
#define GAME_ENEMIES_HPP

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

namespace game {

// Hit points of an enemy for a room with `playerCount` players (§5):
// base * (1 + 0.25 * (players - 1)), rounded up. playerCount < 1 counts as 1.
int scaledEnemyHp(int baseHp, int playerCount);

// Hit points of the boss: 120 + 20 per extra player. playerCount < 1 counts as 1.
int bossHp(int playerCount);

// Velocity of a bullet (kEnemyBulletSpeed) leaving `from` toward `to`;
// straight left if they are on the same spot.
Velocity aimedVelocity(const Position &from, const Position &to);

// `v` with its speed multiplied by `factor` (the direction does not change).
Velocity scaledVelocity(const Velocity &v, float factor);

// Spawns one EnemyBullet at `from` with the given velocity (8x8, damage 1,
// lifetime kEnemyBulletLifetime, ownerId -1). It always carries the components
// that make it dangerous: Team::EnemyShot, Projectile{damage > 0} and a
// Collider on the EnemyShot layer. `visual` is replicated in the snapshot
// `extra` byte and only selects the sprite (BulletVisual::Normal by default).
void spawnEnemyBullet(engine::Registry &registry, const Position &from, const Velocity &velocity,
                      BulletVisual visual = BulletVisual::Normal);

// Creates a Bydos at (x, y) with the stats of docs/game-design.md §5:
// Position, Velocity, Health, Collider, Team::Enemy, EntityType, Enemy and
// the Movement pattern of its type (Bink chases, Patapata waves, Turret is
// static, Carrier goes straight). The Boss has no Movement: it gets a
// BossState and is driven by bossSystem (boss.hpp). Its hp use bossHp(). Enemies are driven by
// components exactly like the ships: the movement systems treat both the same way.
engine::Entity spawnEnemy(engine::Registry &registry, EnemyType type, float x, float y,
                          int playerCount = 1);

// Enemy fire (§5), run once per tick on the server. An Enemy with a
// fireCooldown > 0 counts fireTimer down; when it is over AND the enemy is
// inside the arena, it shoots one EnemyBullet aimed at the closest alive
// player (nobody alive: it waits). The shot is spawned at the enemy center,
// moves at kEnemyBulletSpeed and lives kEnemyBulletLifetime seconds.
void enemyFireSystem(engine::Registry &registry, float dt);

} // namespace game

#endif // GAME_ENEMIES_HPP
