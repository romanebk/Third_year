#pragma once

// World constants shared by the gameplay systems. Values come from
// docs/game-design.md and are provisional until playtested.

#include <cstddef>
#include <cstdint>

namespace game {

// Arena (docs/game-design.md §1). Position is the CENTER of an entity.
inline constexpr float kArenaWidth = 960.0f;
inline constexpr float kArenaHeight = 540.0f;
inline constexpr float kTickDt = 1.0f / 60.0f;
inline constexpr float kScrollSpeed = 60.0f;

// An entity that is outside the arena by more than this margin AND still
// moving outward is removed (spawning just outside is therefore safe).
inline constexpr float kCullMargin = 64.0f;

// Player ship (§3).
inline constexpr float kPlayerBaseSpeed = 220.0f;
inline constexpr float kPlayerSpeedStep = 40.0f;
inline constexpr unsigned kPlayerMaxSpeedLevel = 3;

// Bink "slight chase" on Y (§5).
inline constexpr float kChaseSpeedY = 50.0f;

// Damage rules (§5, §6).
inline constexpr int kRamDamage = 1;
inline constexpr int kForceRamDamage = 3;

// Death / effects (§4, §7).
inline constexpr float kExplosionLifetime = 0.4f;
inline constexpr float kRespawnDelay = 2.0f;
inline constexpr float kRespawnInvincibility = 2.0f;

// Player spawn (§1): x in the spawn zone, y spread by playerId around the
// middle of the arena.
inline constexpr float kPlayerSpawnX = 60.0f;
inline constexpr float kPlayerSpawnY = 270.0f;
inline constexpr float kPlayerSpawnSpacing = 48.0f;
inline constexpr int kMaxPlayers = 4;
inline constexpr float kPlayerWidth = 24.0f;
inline constexpr float kPlayerHeight = 16.0f;

// Player weapon (§3). Colliders layer: PlayerShot = 4 (§6).
inline constexpr std::uint8_t kLayerPlayerShot = 4;
inline constexpr float kShotCooldown = 0.15f;
inline constexpr float kShotSpeed = 500.0f;
inline constexpr float kShotLifetime = 2.0f;
inline constexpr float kBulletWidth = 12.0f;
inline constexpr float kBulletHeight = 4.0f;

// Charged beam (§3): hold fire, release after kBeamMinCharge seconds.
// damage = 1 + charge * kBeamDamagePerSecond, charge capped at kBeamMaxCharge.
inline constexpr float kBeamMinCharge = 0.4f;
inline constexpr float kBeamMaxCharge = 2.0f;
inline constexpr float kBeamDamagePerSecond = 3.0f;
inline constexpr float kBeamSpeed = 600.0f;
inline constexpr float kBeamWidth = 40.0f;
inline constexpr float kBeamHeight = 12.0f;

// Bydos (§5). Enemies appear this far right of the arena (must stay below
// kCullMargin) and scroll in. HP grows with the number of players.
inline constexpr float kEnemySpawnMargin = 32.0f;
inline constexpr float kEnemyHpPerExtraPlayer = 0.25f;

inline constexpr int kBinkHp = 1;
inline constexpr float kBinkSpeed = 140.0f;
inline constexpr int kBinkScore = 100;

inline constexpr int kPatapataHp = 1;
inline constexpr float kPatapataSpeed = 120.0f;
inline constexpr float kPatapataAmplitude = 60.0f;
inline constexpr float kPatapataFrequency = 2.0f; // Hz
inline constexpr int kPatapataScore = 150;

inline constexpr int kTurretHp = 3;
inline constexpr float kTurretFireCooldown = 2.0f;
inline constexpr int kTurretScore = 300;

inline constexpr int kCarrierHp = 2;
inline constexpr float kCarrierSpeed = 80.0f;
inline constexpr int kCarrierScore = 200;

// Enemy bullets (§5): 8x8, 200 u/s, damage 1, 4 s. Colliders layer: EnemyShot = 8.
inline constexpr std::uint8_t kLayerEnemy = 2;
inline constexpr std::uint8_t kLayerEnemyShot = 8;
inline constexpr float kEnemyBulletSize = 8.0f;
inline constexpr float kEnemyBulletSpeed = 200.0f;
inline constexpr float kEnemyBulletLifetime = 4.0f;
inline constexpr int kEnemyBulletDamage = 1;

// Boss "Dobkeratops" (§5). HP = 120 + 20 per extra player. Phase 2 starts at
// half health: faster hover and a 3-way spread instead of one aimed shot.
inline constexpr int kBossHp = 120;
inline constexpr int kBossHpPerExtraPlayer = 20;
inline constexpr int kBossScore = 5000;
inline constexpr float kBossWidth = 96.0f;
inline constexpr float kBossHeight = 96.0f;
inline constexpr float kBossEnterSpeed = 80.0f;
inline constexpr float kBossHoverX = 780.0f;
inline constexpr float kBossDriftAmpX = 40.0f;
inline constexpr float kBossDriftFreqX = 0.15f; // Hz
inline constexpr float kBossDriftAmpY = 120.0f;
inline constexpr float kBossDriftFreqY = 0.2f; // Hz
inline constexpr float kBossPhase1Cooldown = 1.5f;
inline constexpr float kBossPhase2Cooldown = 1.2f;
inline constexpr float kBossEnrageSpeedFactor = 1.5f;
inline constexpr float kBossSpreadAngle = 0.35f; // radians, about 20 degrees

// Visual variants of the boss balls (BulletVisual, sent in SnapshotEntity::extra):
// one per boss sprite. A campaign cycles through the first three (only two
// levels exist); endless uses all four, since it meets a boss every
// kEndlessBossEvery waves.
inline constexpr int kBossVisualCount = 4;
inline constexpr int kCampaignBossVisualCount = 3;

// Pickups and weapon levels (§3, §8). Colliders layer: Pickup = 16 (§6).
inline constexpr std::uint8_t kLayerPickup = 16;
inline constexpr float kPickupWidth = 16.0f;
inline constexpr float kPickupHeight = 16.0f;
inline constexpr float kPickupDriftSpeed = kScrollSpeed; // drifts left with the level
inline constexpr float kRandomDropChance = 0.08f;        // Bink and Patapata
inline constexpr int kPickupBonusScore = 300;            // a pickup the ship cannot use
inline constexpr std::uint8_t kWeaponMaxLevel = 2;
inline constexpr float kTwinShotOffset = 7.0f; // level 1: two parallel shots, +/- this on Y
inline constexpr float kSpreadShotVy = 90.0f;  // level 2: the two outer shots go up and down

// Campaign (docs/game-design.md §13): pause between two levels, once the boss
// of the first one is dead.
inline constexpr float kStageClearDelay = 4.0f;

// Endless mode (docs/game-design.md §14): a pause between two waves, a boss every
// fifth wave, and the hit points grow by 10 % per wave up to 4 times the base.
inline constexpr float kEndlessWaveDelay = 3.0f;
inline constexpr int kEndlessBossEvery = 5;
inline constexpr float kEndlessHpPerWave = 0.1f;
inline constexpr float kEndlessMaxHpScale = 4.0f;
inline constexpr int kEndlessMaxGroup = 12;

// Snapshot (docs/rfc-protocol.md §2, §7): a datagram is at most 1200 bytes, the
// snapshot header takes at most 63 (8 + the 55 bytes of fixed part, with the HUD of 4
// players) and each entity record 16, so 71 entities fit. The room passes the
// cap of the network library (net::kMaxSnapshotEntities, the same number); this
// is the default of collectSnapshot().
inline constexpr std::size_t kMaxSnapshotEntities = 71;

} // namespace game
