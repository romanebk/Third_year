#include "TestWorld.hpp"
#include "game/movement.hpp"
#include "game/world.hpp"

#include <cmath>
#include <gtest/gtest.h>
#include <numbers>

using namespace game_test;

TEST(PlayerInput, MovesAtBaseSpeed)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    w.registry.getComponent<Input>(ship)->right = true;

    playerInputSystem(w.registry);

    EXPECT_FLOAT_EQ(w.vel(ship).vx, kPlayerBaseSpeed);
    EXPECT_FLOAT_EQ(w.vel(ship).vy, 0.0f);
}

TEST(PlayerInput, NormalizesDiagonals)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    auto *in = w.registry.getComponent<Input>(ship);
    in->up = true;
    in->right = true;

    playerInputSystem(w.registry);

    const float speed = std::hypot(w.vel(ship).vx, w.vel(ship).vy);
    EXPECT_NEAR(speed, kPlayerBaseSpeed, 1e-3f);
    EXPECT_GT(w.vel(ship).vx, 0.0f);
    EXPECT_LT(w.vel(ship).vy, 0.0f); // Y is down: "up" is negative
}

TEST(PlayerInput, OpposedKeysCancel)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    auto *in = w.registry.getComponent<Input>(ship);
    in->left = true;
    in->right = true;

    playerInputSystem(w.registry);

    EXPECT_FLOAT_EQ(w.vel(ship).vx, 0.0f);
}

TEST(PlayerInput, SpeedLevelsAddAndCap)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    w.registry.getComponent<Input>(ship)->right = true;
    auto *power = w.registry.getComponent<PowerState>(ship);

    power->speedLevel = 2;
    playerInputSystem(w.registry);
    EXPECT_FLOAT_EQ(w.vel(ship).vx, kPlayerBaseSpeed + 2.0f * kPlayerSpeedStep);

    power->speedLevel = 200; // corrupted / out of range: capped at level 3
    playerInputSystem(w.registry);
    EXPECT_FLOAT_EQ(w.vel(ship).vx, kPlayerBaseSpeed + 3.0f * kPlayerSpeedStep);
}

TEST(PlayerInput, DeadPlayerDoesNotMove)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    w.registry.getComponent<Input>(ship)->right = true;
    w.registry.getComponent<Player>(ship)->alive = false;
    w.vel(ship).vx = 99.0f;

    playerInputSystem(w.registry);

    EXPECT_FLOAT_EQ(w.vel(ship).vx, 0.0f);
}

TEST(Integration, AppliesVelocityTimesDt)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 270.0f);
    w.vel(ship) = Velocity{60.0f, -30.0f};

    integrationSystem(w.registry, 0.5f);

    EXPECT_FLOAT_EQ(w.pos(ship).x, 130.0f);
    EXPECT_FLOAT_EQ(w.pos(ship).y, 255.0f);
}

TEST(Integration, IgnoresEntitiesWithoutVelocity)
{
    TestWorld w;
    const Entity e = w.registry.spawnEntity();
    w.registry.emplaceComponent<Position>(e, 5.0f, 5.0f);

    integrationSystem(w.registry, 1.0f);

    EXPECT_FLOAT_EQ(w.pos(e).x, 5.0f);
}

TEST(Clamp, KeepsShipInsideArena)
{
    TestWorld w;
    const Entity ship = w.ship(0, -50.0f, 9999.0f);

    clampPlayersSystem(w.registry);

    EXPECT_FLOAT_EQ(w.pos(ship).x, 12.0f);               // half of 24
    EXPECT_FLOAT_EQ(w.pos(ship).y, kArenaHeight - 8.0f); // half of 16

    w.pos(ship) = Position{5000.0f, -5.0f};
    clampPlayersSystem(w.registry);
    EXPECT_FLOAT_EQ(w.pos(ship).x, kArenaWidth - 12.0f);
    EXPECT_FLOAT_EQ(w.pos(ship).y, 8.0f);
}

TEST(Clamp, DoesNotTouchEnemies)
{
    TestWorld w;
    const Entity e = w.enemy(-500.0f, -500.0f);

    clampPlayersSystem(w.registry);

    EXPECT_FLOAT_EQ(w.pos(e).x, -500.0f);
}

namespace {
Entity spawnMover(TestWorld &w, MovementType type, float x, float y, float speed)
{
    const Entity e = w.enemy(x, y);
    Movement m;
    m.type = type;
    m.speed = speed;
    w.registry.addComponent(e, m);
    return e;
}
} // namespace

TEST(Pattern, StraightGoesLeft)
{
    TestWorld w;
    const Entity e = spawnMover(w, MovementType::Straight, 800.0f, 100.0f, 140.0f);

    patternSystem(w.registry, kTickDt);
    integrationSystem(w.registry, kTickDt);

    EXPECT_NEAR(w.pos(e).x, 800.0f - 140.0f * kTickDt, 1e-3f);
    EXPECT_FLOAT_EQ(w.pos(e).y, 100.0f);
}

TEST(Pattern, StaticScrollsWithTheLevel)
{
    TestWorld w;
    const Entity e = spawnMover(w, MovementType::Static, 800.0f, 100.0f, 0.0f);

    patternSystem(w.registry, 1.0f);
    integrationSystem(w.registry, 1.0f);

    EXPECT_FLOAT_EQ(w.pos(e).x, 800.0f - kScrollSpeed);
}

TEST(Pattern, SineFollowsTheAnalyticCurveWithoutDrift)
{
    TestWorld w;
    const Entity e = spawnMover(w, MovementType::Sine, 900.0f, 200.0f, 120.0f);
    auto *m = w.registry.getComponent<Movement>(e);
    m->amp = 60.0f;
    m->freq = 2.0f;

    constexpr int steps = 90; // 1.5 s
    for (int i = 0; i < steps; ++i) {
        patternSystem(w.registry, kTickDt);
        integrationSystem(w.registry, kTickDt);
    }

    const float t = steps * kTickDt;
    const float expectedY = 200.0f + 60.0f * std::sin(2.0f * std::numbers::pi_v<float> * 2.0f * t);
    EXPECT_NEAR(w.pos(e).y, expectedY, 0.05f);
    EXPECT_NEAR(w.pos(e).x, 900.0f - 120.0f * t, 0.05f);
    EXPECT_NEAR(m->t, t, 1e-4f);
}

TEST(Pattern, ChaseMovesTowardNearestAlivePlayerAtLimitedSpeed)
{
    TestWorld w;
    w.ship(0, 100.0f, 400.0f);
    const Entity bink = spawnMover(w, MovementType::Chase, 700.0f, 100.0f, 140.0f);

    patternSystem(w.registry, 1.0f);

    EXPECT_FLOAT_EQ(w.vel(bink).vx, -140.0f);
    EXPECT_FLOAT_EQ(w.vel(bink).vy, kChaseSpeedY); // player is below: +Y
}

TEST(Pattern, ChaseDoesNotOvershootAndIgnoresDeadPlayers)
{
    TestWorld w;
    const Entity target = w.ship(0, 100.0f, 110.0f);
    const Entity bink = spawnMover(w, MovementType::Chase, 700.0f, 100.0f, 140.0f);

    patternSystem(w.registry, 1.0f); // 10 units away < 50 units step
    EXPECT_FLOAT_EQ(w.vel(bink).vy, 10.0f);

    w.registry.getComponent<Player>(target)->alive = false;
    patternSystem(w.registry, 1.0f);
    EXPECT_FLOAT_EQ(w.vel(bink).vy, 0.0f); // nobody to chase
}

TEST(Pattern, ZeroDtIsANoOp)
{
    TestWorld w;
    const Entity e = spawnMover(w, MovementType::Straight, 800.0f, 100.0f, 140.0f);

    patternSystem(w.registry, 0.0f);

    EXPECT_FLOAT_EQ(w.vel(e).vx, 0.0f);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Movement>(e)->t, 0.0f);
}

TEST(Cull, RemovesEntitiesLeavingTheArena)
{
    TestWorld w;
    const Entity gone = w.enemy(-100.0f, 100.0f);
    w.vel(gone) = Velocity{-140.0f, 0.0f};
    const Entity shot = w.shot(Team::PlayerShot, kArenaWidth + 100.0f, 100.0f);
    w.vel(shot) = Velocity{500.0f, 0.0f};

    cullSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(gone));
    EXPECT_FALSE(w.registry.isAlive(shot));
}

TEST(Cull, KeepsEntitiesEnteringFromOutside)
{
    TestWorld w;
    const Entity entering = w.enemy(kArenaWidth + 100.0f, 100.0f); // spawned off-screen
    w.vel(entering) = Velocity{-140.0f, 0.0f};                     // heading in

    cullSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(entering));
}

TEST(Cull, NeverRemovesPlayers)
{
    TestWorld w;
    const Entity ship = w.ship(0, -500.0f, -500.0f);
    w.vel(ship) = Velocity{-100.0f, -100.0f};

    cullSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(ship));
}

TEST(StepMovement, RunsAllStagesInOrder)
{
    TestWorld w;
    const Entity ship = w.ship(0, 12.0f, 270.0f);
    auto *in = w.registry.getComponent<Input>(ship);
    in->left = true; // pushes against the left wall

    const Entity bink = spawnMover(w, MovementType::Straight, 100.0f, 100.0f, 6000.0f);

    stepMovement(w.registry, 1.0f);

    EXPECT_FLOAT_EQ(w.pos(ship).x, 12.0f);  // moved, then clamped back
    EXPECT_FALSE(w.registry.isAlive(bink)); // flew out of the arena: culled
}
