#ifndef GAME_PICKUPS_HPP
#define GAME_PICKUPS_HPP

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

#include <optional>

namespace game {

// Pickups (docs/game-design.md §8): bonuses dropped by enemies that a ship
// collects by touching them. Needs components registered with
// registerGameComponents().

// Creates a pickup at (x, y): Position, Velocity (drifts left with the level
// scroll), Collider (layer Pickup), Team::Pickup, EntityType::PickupEnt and
// Pickup. The collision system lets the ships collect it and the cull system
// removes it when it leaves the arena.
engine::Entity spawnPickup(engine::Registry &registry, PickupKind kind, float x, float y);

// What an enemy drops when it dies, if anything:
// - a Carrier always drops one, alternating Power and Speed;
// - a Bink or a Patapata drops one with a chance of kRandomDropChance;
// - a Turret and the boss never do.
// The "random" choice is a deterministic sequence kept in the registry
// (DropState), so a room replays the same drops from the same start.
std::optional<PickupKind> rollDrop(engine::Registry &registry, EnemyType type);

// Gives the pickup to a ship:
// - Power: the weapon goes up one level (1 -> 2 parallel shots -> 3-way
//   spread), up to kWeaponMaxLevel;
// - Speed: the ship goes up one speed level, up to kPlayerMaxSpeedLevel.
// A ship that is already at the maximum gets kPickupBonusScore points instead.
void applyPickup(engine::Registry &registry, engine::Entity ship, PickupKind kind);

} // namespace game

#endif // GAME_PICKUPS_HPP
