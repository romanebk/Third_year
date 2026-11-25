#ifndef GAME_SHOOT_HPP
#define GAME_SHOOT_HPP

#include "engine/ecs/Registry.hpp"

namespace game {

// Player firing (docs/game-design.md §3). Runs on the room server only.
// Needs components registered with registerGameComponents().
//
// For every alive ship with Input + Player + Weapon + Position:
// - the Weapon cooldown timer counts down;
// - pressing `fire` spawns one PlayerBullet at the nose of the ship if the
//   cooldown allows it (no auto-fire: tap again to shoot again);
// - holding `fire` charges the Weapon (up to kBeamMaxCharge);
// - releasing `fire` after at least kBeamMinCharge spawns a piercing
//   ChargedBeam with damage 1 + charge * kBeamDamagePerSecond.
// A dead ship loses its charge. Shots carry Projectile::ownerId = playerId so
// kills are credited to the shooter.
void shootSystem(engine::Registry &registry, float dt);

} // namespace game

#endif // GAME_SHOOT_HPP
