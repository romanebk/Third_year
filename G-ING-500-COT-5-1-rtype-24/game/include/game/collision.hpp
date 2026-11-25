#pragma once

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/Registry.hpp"

#include <vector>

namespace game {

// Which rule a detected overlap triggers (docs/game-design.md §6).
// `first` / `second` of a Contact follow the order written here.
enum class ContactKind {
    PlayerShotHitsEnemy,      // (shot, enemy)
    EnemyShotHitsPlayer,      // (shot, player ship)
    EnemyShotAbsorbedByForce, // (shot, force)
    EnemyRamsPlayer,          // (enemy, player ship)
    EnemyRamsForce,           // (enemy, force)
    ShotsCancel,              // (player shot, enemy shot)
    PlayerCollectsPickup      // (pickup, player ship)
};

struct Contact {
    engine::Entity first;
    engine::Entity second;
    ContactKind kind;
};

// AABB overlap test over every entity with Position + Collider + Team.
// Position is the CENTER of the box. Pure: does not modify the registry.
// Ignored: colliders with solid == false, dead players (Player::alive ==
// false), and teams without a rule (Pickup, Neutral without ForcePod).
// Linear O(n^2) scan, fine under ~200 entities (§6).
std::vector<Contact> detectCollisions(engine::Registry &registry);

// Resolves the contacts: applies damage, destroys shots, kills dead enemies,
// credits kill scores, handles player death (lives--, alive = false,
// respawnTimer) and spawns an Explosion (Lifetime kExplosionLifetime) where
// an enemy or a player died. Kills are applied at the end, so several shots
// landing on the same enemy in one tick all count.
void applyDamage(engine::Registry &registry, const std::vector<Contact> &contacts);

// detectCollisions + applyDamage.
void collisionSystem(engine::Registry &registry);

// Counts down Lifetime and Projectile::lifetime; removes the entities that
// reach zero (explosions, expired shots).
void lifetimeSystem(engine::Registry &registry, float dt);

} // namespace game
