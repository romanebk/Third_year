#ifndef GAME_BOSS_HPP
#define GAME_BOSS_HPP

#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

namespace game {

// Boss behaviour (docs/game-design.md §5), run once per tick on the server.
// For every entity with BossState + Position + Velocity + Health:
// - it first scrolls in from the right at kBossEnterSpeed, and does not
//   shoot until it reaches kBossHoverX;
// - then it hovers: a slow drift around that point, on both axes, driven by
//   the velocity so the position follows the sine exactly (no drift away);
// - phase 1: one aimed shot every kBossPhase1Cooldown seconds;
// - phase 2 (hp at half or below): the hover is kBossEnrageSpeedFactor times
//   faster and it fires a 3-way spread (aimed shot, +/- kBossSpreadAngle)
//   every kBossPhase2Cooldown seconds;
// - it waits while nobody is alive.
// Damage, death and the score (kBossScore) go through the collision system
// like for any other enemy.
void bossSystem(engine::Registry &registry, float dt);

// Visual variant carried by every ball the boss fires (SnapshotEntity::extra):
// BulletVisual::Dobkeratops for campaign level 1, Gomander for level 2, and in
// endless one boss per kEndlessBossEvery waves in the same order, then repeat.
// It is only a sprite selection: the balls keep the EnemyShot behaviour.
BulletVisual bossBulletVisual(engine::Registry &registry);

} // namespace game

#endif // GAME_BOSS_HPP
