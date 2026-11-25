#include "TestWorld.hpp"
#include "game/boss.hpp"
#include "game/collision.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/movement.hpp"
#include "game/player.hpp"
#include "game/rules.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

// One boss tick without the rest of the game: decide, then move.
void step(TestWorld &w, float dt)
{
    bossSystem(w.registry, dt);
    integrationSystem(w.registry, dt);
}

Entity bossAt(TestWorld &w, float x, float y, int playerCount = 1)
{
    return spawnEnemy(w.registry, EnemyType::Boss, x, y, playerCount);
}

BossState &stateOf(TestWorld &w, Entity boss)
{
    return *w.registry.getComponent<BossState>(boss);
}

// Puts a Campaign on the registry so currentStage() follows it: `current` is
// the 0-based level (campaign) or wave (endless) index.
Entity campaignAt(TestWorld &w, int current, bool endless = false)
{
    Rules rules;
    rules.mode = endless ? GameMode::Endless : GameMode::Campaign;
    setRules(w.registry, rules);
    Campaign campaign;
    campaign.current = current;
    campaign.count = levelCount();
    const Entity holder = w.registry.spawnEntity();
    w.registry.addComponent(holder, campaign);
    return holder;
}

void setHp(TestWorld &w, Entity boss, int hp)
{
    w.registry.getComponent<Health>(boss)->hp = hp;
}

std::vector<Entity> bullets(TestWorld &w)
{
    std::vector<Entity> found;
    forEach<EntityType>(w.registry, [&](Entity e, EntityType &t) {
        if (t == EntityType::EnemyBullet) {
            found.push_back(e);
        }
    });
    return found;
}

float angleBetween(const Velocity &a, const Velocity &b)
{
    const float dot = a.vx * b.vx + a.vy * b.vy;
    const float lengths =
        std::sqrt(a.vx * a.vx + a.vy * a.vy) * std::sqrt(b.vx * b.vx + b.vy * b.vy);
    return std::acos(std::clamp(dot / lengths, -1.0f, 1.0f));
}

} // namespace

// --- spawning ----------------------------------------------------------

TEST(Boss, SpawnsWithItsOwnComponentsAndNoPattern)
{
    TestWorld w;

    const Entity boss = bossAt(w, 992.0f, 270.0f);

    EXPECT_EQ(*w.registry.getComponent<EntityType>(boss), EntityType::Boss);
    EXPECT_EQ(*w.registry.getComponent<Team>(boss), Team::Enemy);
    EXPECT_EQ(w.registry.getComponent<Enemy>(boss)->type, EnemyType::Boss);
    EXPECT_EQ(w.registry.getComponent<Enemy>(boss)->scoreValue, kBossScore);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Enemy>(boss)->fireCooldown, 0.0f);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Collider>(boss)->w, kBossWidth);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Collider>(boss)->h, kBossHeight);
    EXPECT_TRUE(w.registry.hasComponent<BossState>(boss));
    // The enemy pattern system must leave the boss alone.
    EXPECT_FALSE(w.registry.hasComponent<Movement>(boss));
    EXPECT_EQ(stateOf(w, boss).phase, 1);
    EXPECT_FALSE(stateOf(w, boss).arrived);
}

TEST(Boss, HealthGrowsByTwentyPerExtraPlayer)
{
    EXPECT_EQ(bossHp(1), 120);
    EXPECT_EQ(bossHp(2), 140);
    EXPECT_EQ(bossHp(4), 180);
    EXPECT_EQ(bossHp(0), 120);

    TestWorld w;
    const Entity boss = bossAt(w, 992.0f, 270.0f, 3);
    EXPECT_EQ(w.registry.getComponent<Health>(boss)->hp, 160);
    EXPECT_EQ(w.registry.getComponent<Health>(boss)->maxHp, 160);
}

TEST(Boss, TheLevelEndsWithTheBoss)
{
    const auto events = level1();

    // level1() lists its groups in writing order; loadLevel sorts them.
    const auto last = std::max_element(
        events.begin(), events.end(), [](const auto &a, const auto &b) { return a.time < b.time; });
    ASSERT_NE(last, events.end());
    EXPECT_EQ(last->type, EnemyType::Boss);
    EXPECT_EQ(std::count_if(events.begin(), events.end(),
                            [](const auto &e) { return e.type == EnemyType::Boss; }),
              1);
}

// --- entrance ----------------------------------------------------------

TEST(Boss, ScrollsInFromTheRightThenStops)
{
    TestWorld w;
    const Entity boss = bossAt(w, 992.0f, 270.0f);

    step(w, 0.5f);
    EXPECT_FALSE(stateOf(w, boss).arrived);
    EXPECT_FLOAT_EQ(w.vel(boss).vx, -kBossEnterSpeed);
    EXPECT_FLOAT_EQ(w.pos(boss).x, 992.0f - kBossEnterSpeed * 0.5f);

    for (int i = 0; i < 20 && !stateOf(w, boss).arrived; ++i) {
        step(w, 0.5f);
    }

    EXPECT_TRUE(stateOf(w, boss).arrived);
    EXPECT_LE(w.pos(boss).x, kBossHoverX);
    EXPECT_GT(w.pos(boss).x, kBossHoverX - kBossEnterSpeed * 0.5f - 1.0f);
}

TEST(Boss, DoesNotShootBeforeItHasArrived)
{
    TestWorld w;
    w.ship(0, 100.0f, 270.0f);
    bossAt(w, 992.0f, 270.0f);

    for (int i = 0; i < 5; ++i) { // 2.5 s, still scrolling in
        step(w, 0.5f);
    }

    EXPECT_TRUE(bullets(w).empty());
}

// --- hovering ----------------------------------------------------------

TEST(Boss, HoversAroundItsPointWithoutDrifting)
{
    TestWorld w;
    const Entity boss = bossAt(w, kBossHoverX, 270.0f);
    float minX = 1e9f;
    float maxX = -1e9f;
    float minY = 1e9f;
    float maxY = -1e9f;

    for (int i = 0; i < 800; ++i) { // 200 s, many periods
        step(w, 0.25f);
        minX = std::min(minX, w.pos(boss).x);
        maxX = std::max(maxX, w.pos(boss).x);
        minY = std::min(minY, w.pos(boss).y);
        maxY = std::max(maxY, w.pos(boss).y);
    }

    EXPECT_GE(minX, kBossHoverX - kBossDriftAmpX - 0.5f);
    EXPECT_LE(maxX, kBossHoverX + kBossDriftAmpX + 0.5f);
    EXPECT_GE(minY, 270.0f - kBossDriftAmpY - 0.5f);
    EXPECT_LE(maxY, 270.0f + kBossDriftAmpY + 0.5f);
    // it really moves
    EXPECT_GT(maxX - minX, kBossDriftAmpX);
    EXPECT_GT(maxY - minY, kBossDriftAmpY);
}

TEST(Boss, StaysInsideTheArenaWhileHovering)
{
    TestWorld w;
    const Entity boss = bossAt(w, kBossHoverX, 270.0f);

    for (int i = 0; i < 800; ++i) {
        step(w, 0.25f);
        EXPECT_GE(w.pos(boss).x - kBossWidth * 0.5f, 0.0f);
        EXPECT_LE(w.pos(boss).x + kBossWidth * 0.5f, kArenaWidth);
        EXPECT_GE(w.pos(boss).y - kBossHeight * 0.5f, 0.0f);
        EXPECT_LE(w.pos(boss).y + kBossHeight * 0.5f, kArenaHeight);
    }
}

// --- phases ------------------------------------------------------------

TEST(Boss, EntersPhaseTwoAtHalfHealth)
{
    TestWorld w;
    const Entity boss = bossAt(w, kBossHoverX, 270.0f); // maxHp 120
    step(w, 0.5f);                                      // arrives

    setHp(w, boss, 61);
    step(w, 0.5f);
    EXPECT_EQ(stateOf(w, boss).phase, 1);

    setHp(w, boss, 60);
    step(w, 0.5f);
    EXPECT_EQ(stateOf(w, boss).phase, 2);
}

TEST(Boss, DoesNotGoBackToPhaseOne)
{
    TestWorld w;
    const Entity boss = bossAt(w, kBossHoverX, 270.0f);
    step(w, 0.5f);
    setHp(w, boss, 10);
    step(w, 0.5f);
    ASSERT_EQ(stateOf(w, boss).phase, 2);

    setHp(w, boss, 120); // e.g. a future heal
    step(w, 0.5f);

    EXPECT_EQ(stateOf(w, boss).phase, 2);
}

TEST(Boss, HoversFasterWhenEnraged)
{
    TestWorld w;
    const Entity calm = bossAt(w, kBossHoverX, 270.0f);
    const Entity angry = bossAt(w, kBossHoverX, 270.0f);
    bossSystem(w.registry, 0.01f); // both arrive
    setHp(w, angry, 60);

    bossSystem(w.registry, 0.01f); // first hover step, clock still at zero

    const float ratio = w.vel(angry).vy / w.vel(calm).vy;
    EXPECT_NEAR(ratio, kBossEnrageSpeedFactor, 0.01f);
}

// --- fire --------------------------------------------------------------

TEST(Boss, PhaseOneFiresOneAimedShotPerCooldown)
{
    TestWorld w;
    w.ship(0, 100.0f, 270.0f);
    bossAt(w, kBossHoverX, 270.0f);

    for (int i = 0; i < 4; ++i) { // arrival, then 1.5 s of cooldown
        step(w, 0.5f);
    }
    ASSERT_EQ(bullets(w).size(), 1u);
    const Entity bullet = bullets(w)[0];
    EXPECT_LT(w.vel(bullet).vx, 0.0f); // toward the player on the left
    EXPECT_NEAR(
        std::sqrt(w.vel(bullet).vx * w.vel(bullet).vx + w.vel(bullet).vy * w.vel(bullet).vy),
        kEnemyBulletSpeed, 1e-3f);

    for (int i = 0; i < 3; ++i) { // 1.5 s later: the second shot
        step(w, 0.5f);
    }
    EXPECT_EQ(bullets(w).size(), 2u);
}

TEST(Boss, TheBulletVisualFollowsTheCampaignLevel)
{
    TestWorld w;
    const Entity holder = campaignAt(w, 0);
    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Dobkeratops);

    w.registry.getComponent<Campaign>(holder)->current = 1;
    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Gomander);
}

TEST(Boss, TheBulletVisualFollowsTheEndlessBoss)
{
    TestWorld w;
    const Entity holder = campaignAt(w, 4, true); // stage 5: first boss

    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Dobkeratops);
    w.registry.getComponent<Campaign>(holder)->current = 9; // stage 10
    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Gomander);
    w.registry.getComponent<Campaign>(holder)->current = 14; // stage 15
    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Warship);
    w.registry.getComponent<Campaign>(holder)->current = 19; // stage 20
    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Compiler);
    w.registry.getComponent<Campaign>(holder)->current = 24; // stage 25: repeat
    EXPECT_EQ(bossBulletVisual(w.registry), BulletVisual::Dobkeratops);
}

TEST(Boss, ItsBallsCarryTheBossVisualAndDamageThePlayer)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    bossAt(w, kBossHoverX, 270.0f);

    for (int i = 0; i < 10 && bullets(w).empty(); ++i) {
        step(w, 0.5f);
    }
    const auto shots = bullets(w);
    ASSERT_FALSE(shots.empty());
    for (const Entity bullet : shots) {
        const auto *projectile = w.registry.getComponent<Projectile>(bullet);
        ASSERT_NE(projectile, nullptr);
        EXPECT_EQ(*w.registry.getComponent<Team>(bullet), Team::EnemyShot);
        EXPECT_GT(projectile->damage, 0);
        EXPECT_EQ(projectile->visual, BulletVisual::Dobkeratops); // campaign level 1
        EXPECT_NE(w.registry.getComponent<Collider>(bullet), nullptr);
    }

    // The special ball is dangerous: put one on the ship and run the collisions.
    w.pos(shots.front()) = w.pos(ship);
    collisionSystem(w.registry);
    EXPECT_FALSE(w.registry.getComponent<Player>(ship)->alive);
}

TEST(Boss, PhaseTwoFiresAThreeWaySpread)
{
    TestWorld w;
    w.ship(0, 100.0f, 100.0f);
    const Entity boss = bossAt(w, kBossHoverX, 270.0f);
    setHp(w, boss, 60); // enraged from the start

    for (int i = 0; i < 4; ++i) { // arrival, then 1.2 s of cooldown
        step(w, 0.5f);
    }

    const auto shots = bullets(w);
    ASSERT_EQ(shots.size(), 3u);
    std::array<float, 3> angles = {angleBetween(w.vel(shots[0]), w.vel(shots[1])),
                                   angleBetween(w.vel(shots[0]), w.vel(shots[2])),
                                   angleBetween(w.vel(shots[1]), w.vel(shots[2]))};
    std::sort(angles.begin(), angles.end());
    // aimed shot in the middle, one on each side: 0.35, 0.35 and 0.70 apart
    EXPECT_NEAR(angles[0], kBossSpreadAngle, 1e-3f);
    EXPECT_NEAR(angles[1], kBossSpreadAngle, 1e-3f);
    EXPECT_NEAR(angles[2], 2.0f * kBossSpreadAngle, 1e-3f);
}

TEST(Boss, WaitsWhenNobodyIsAliveThenFiresAtOnce)
{
    TestWorld w;
    bossAt(w, kBossHoverX, 270.0f);
    for (int i = 0; i < 10; ++i) {
        step(w, 0.5f);
    }
    EXPECT_TRUE(bullets(w).empty());

    w.ship(0, 100.0f, 270.0f);
    step(w, 0.5f);

    EXPECT_EQ(bullets(w).size(), 1u);
}

TEST(Boss, ZeroDtDoesNothing)
{
    TestWorld w;
    w.ship(0, 100.0f, 270.0f);
    const Entity boss = bossAt(w, 992.0f, 270.0f);

    bossSystem(w.registry, 0.0f);

    EXPECT_FLOAT_EQ(w.vel(boss).vx, 0.0f);
    EXPECT_FALSE(stateOf(w, boss).arrived);
}

// --- room state --------------------------------------------------------

TEST(RoomState, PlayingWithoutALevelAndAnAlivePlayer)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);

    EXPECT_EQ(roomState(w.registry), RoomState::Playing);
}

TEST(RoomState, VictoryWhenTheLevelIsCleared)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    loadLevel(w.registry, {});

    EXPECT_EQ(roomState(w.registry), RoomState::Victory);
}

TEST(RoomState, DefeatWhenEveryoneIsGameOver)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    w.registry.getComponent<Player>(ship)->alive = false;
    w.registry.getComponent<Player>(ship)->lives = -1;

    EXPECT_EQ(roomState(w.registry), RoomState::Defeat);
}

TEST(RoomState, DefeatWinsOverVictory)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    w.registry.getComponent<Player>(ship)->alive = false;
    w.registry.getComponent<Player>(ship)->lives = -1;
    loadLevel(w.registry, {}); // already cleared

    EXPECT_EQ(roomState(w.registry), RoomState::Defeat);
}

// --- the whole fight ---------------------------------------------------

TEST(StepGame, KillingTheBossWinsTheLevel)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 1); // y = 246, inside the boss row
    loadLevel(w.registry, {{0.0f, EnemyType::Boss, 270.0f}});
    Input &input = *w.registry.getComponent<Input>(ship);

    stepGame(w.registry, kTickDt); // the boss is spawned
    EXPECT_EQ(roomState(w.registry), RoomState::Playing);
    forEach<BossState, Health>(w.registry, [&](Entity, BossState &, Health &health) {
        health.hp = 1; // one hit is enough for this test
        health.maxHp = 1;
    });

    for (int tick = 0; tick < 60 * 15 && roomState(w.registry) == RoomState::Playing; ++tick) {
        input.fire = (tick % 15) < 2;
        stepGame(w.registry, kTickDt);
    }

    EXPECT_EQ(roomState(w.registry), RoomState::Victory);
    EXPECT_EQ(w.registry.getComponent<Player>(ship)->score, kBossScore);
}
