#ifndef GAME_PLAYER_HPP
#define GAME_PLAYER_HPP

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

#include <optional>

namespace game {

// Position of the alive player closest to (x, y); empty if nobody is alive.
// Used by the enemies that chase or aim at a player.
std::optional<Position> nearestAlivePlayer(engine::Registry &registry, float x, float y);

// Where ship `playerId` (0..3) appears at the start and after a respawn.
Position playerSpawnPosition(int playerId);

// Creates the ship of player `playerId` (0..3): Position, Velocity, Health,
// Collider, Team P<playerId>, Input, Player (3 lives, 0 score), PowerState,
// Weapon and EntityType::Ship. Throws std::out_of_range for any other id.
engine::Entity spawnPlayer(engine::Registry &registry, int playerId);

// Player life cycle (§7), run once per tick:
// - an alive ship's invincibility timer counts down;
// - a dead ship with lives left counts its respawn timer down, then comes
//   back at its spawn position with full health and kRespawnInvincibility;
// - a dead ship with no life left (lives < 0) stays dead: game over.
void playerTimersSystem(engine::Registry &registry, float dt);

// True when there is at least one player and every one of them is game over
// (dead with lives < 0). A player waiting to respawn is NOT game over.
bool allPlayersGameOver(engine::Registry &registry);

} // namespace game

#endif // GAME_PLAYER_HPP
