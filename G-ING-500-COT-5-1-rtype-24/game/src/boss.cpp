#include "game/boss.hpp"

#include "game/components.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/rules.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <cmath>
#include <numbers>
#include <vector>

namespace game {

namespace {

constexpr float kTwoPi = 2.0f * std::numbers::pi_v<float>;
constexpr std::uint8_t kEnragedPhase = 2;

struct BossShot {
    Position from;
    Velocity velocity;
    BulletVisual visual;
};

Velocity rotated(const Velocity &v, float angle)
{
    const float c = std::cos(angle);
    const float s = std::sin(angle);
    return Velocity{v.vx * c - v.vy * s, v.vx * s + v.vy * c};
}

// Speed of a point following amp * sin(2*pi*freq*t) between t and t + step,
// taken from the exact difference so the integrated path has no drift.
float sineVelocity(float amp, float freq, float t, float step, float dt)
{
    const float w = kTwoPi * freq;
    return amp * (std::sin(w * (t + step)) - std::sin(w * t)) / dt;
}

} // namespace

BulletVisual bossBulletVisual(engine::Registry &registry)
{
    const int index = std::max(currentStage(registry) - 1, 0);
    const bool endless = rulesOf(registry).mode == GameMode::Endless;
    const int kind =
        endless ? (index / kEndlessBossEvery) % kBossVisualCount : index % kCampaignBossVisualCount;
    return static_cast<BulletVisual>(static_cast<std::uint8_t>(BulletVisual::Dobkeratops) + kind);
}

void bossSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    // Spawning inside forEach could reallocate the storages: collect first.
    std::vector<BossShot> shots;
    const Rules rules = rulesOf(registry);
    const BulletVisual visual = bossBulletVisual(registry);
    const float phase1Cooldown = kBossPhase1Cooldown * rules.enemyFireIntervalScale;
    const float phase2Cooldown = kBossPhase2Cooldown * rules.enemyFireIntervalScale;
    forEach<BossState, Position, Velocity, Health>(
        registry,
        [&](engine::Entity, BossState &boss, Position &pos, Velocity &vel, Health &health) {
            if (!boss.arrived) {
                vel = Velocity{-kBossEnterSpeed, 0.0f};
                if (pos.x <= kBossHoverX) {
                    boss.arrived = true;
                    boss.t = 0.0f;
                    boss.fireTimer = phase1Cooldown;
                    vel = Velocity{};
                }
                return;
            }

            if (boss.phase < kEnragedPhase && health.hp * 2 <= health.maxHp) {
                boss.phase = kEnragedPhase;
                boss.fireTimer = std::min(boss.fireTimer, phase2Cooldown);
            }
            const bool enraged = boss.phase >= kEnragedPhase;

            // The hover clock runs faster when enraged, so the path stays
            // continuous at the phase change.
            const float step = dt * (enraged ? kBossEnrageSpeedFactor : 1.0f);
            vel.vx = sineVelocity(kBossDriftAmpX, kBossDriftFreqX, boss.t, step, dt);
            vel.vy = sineVelocity(kBossDriftAmpY, kBossDriftFreqY, boss.t, step, dt);
            boss.t += step;

            boss.fireTimer -= dt;
            if (boss.fireTimer > 0.0f) {
                return;
            }
            const auto target = nearestAlivePlayer(registry, pos.x, pos.y);
            if (!target) {
                return; // nobody to shoot at: stays ready
            }
            const Velocity aimed =
                scaledVelocity(aimedVelocity(pos, *target), rules.enemyBulletSpeedScale);
            shots.push_back({pos, aimed, visual});
            if (enraged) {
                shots.push_back({pos, rotated(aimed, -kBossSpreadAngle), visual});
                shots.push_back({pos, rotated(aimed, kBossSpreadAngle), visual});
            }
            boss.fireTimer = enraged ? phase2Cooldown : phase1Cooldown;
        });
    for (const BossShot &shot : shots) {
        spawnEnemyBullet(registry, shot.from, shot.velocity, shot.visual);
    }
}

} // namespace game
