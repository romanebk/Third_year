#pragma once

#include "engine/ecs/Registry.hpp"

namespace game {

// All movement systems run on the room server (authoritative) and, for
// player prediction, on the client. They need components registered with
// registerGameComponents(). dt is in seconds (fixed step: kTickDt).

// Input + Player + Velocity: turns the pressed keys into a ship velocity.
// Speed = base + step * PowerState::speedLevel. Diagonals are normalized.
// A dead player (Player::alive == false) does not move.
void playerInputSystem(engine::Registry &registry);

// Movement + Velocity + Position: sets the enemy velocity from its pattern
// (Straight, Sine, Static, Chase) and advances Movement::t.
void patternSystem(engine::Registry &registry, float dt);

// Position += Velocity * dt for every entity that has both.
void integrationSystem(engine::Registry &registry, float dt);

// Keeps player ships fully inside the arena.
void clampPlayersSystem(engine::Registry &registry);

// Removes enemies, shots and pickups that left the arena moving outward.
void cullSystem(engine::Registry &registry);

// One movement step in the right order:
// input -> pattern -> integration -> clamp -> cull.
void stepMovement(engine::Registry &registry, float dt);

} // namespace game
