#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/shoot.hpp"
#include "game/world.hpp"

#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

// Exact in binary, so the charge arithmetic below has no rounding error.
constexpr float kStep = 0.25f;

Entity armedShip(TestWorld &w, int playerId, float x, float y)
{
    const Entity ship = w.ship(playerId, x, y);
    w.registry.emplaceComponent<Weapon>(ship);
    return ship;
}

void setFire(TestWorld &w, Entity ship, bool fire)
{
    w.registry.getComponent<Input>(ship)->fire = fire;
}

std::vector<Entity> entitiesOfType(TestWorld &w, EntityType type)
{
    std::vector<Entity> found;
    forEach<EntityType>(w.registry, [&](Entity e, EntityType &t) {
        if (t == type) {
            found.push_back(e);
        }
    });
    return found;
}

void run(TestWorld &w, int ticks, float dt)
{
    for (int i = 0; i < ticks; ++i) {
        shootSystem(w.registry, dt);
    }
}

// Holds fire for `ticks` steps of kStep, then releases it for one step.
std::vector<Entity> holdThenRelease(TestWorld &w, Entity ship, int ticks)
{
    setFire(w, ship, true);
    run(w, ticks, kStep);
    setFire(w, ship, false);
    run(w, 1, kStep);
    return entitiesOfType(w, EntityType::ChargedBeam);
}

} // namespace

TEST(Shoot, TapSpawnsABulletAtTheNoseOfTheShip)
{
    TestWorld w;
    const Entity ship = armedShip(w, 2, 100.0f, 200.0f);
    setFire(w, ship, true);

    shootSystem(w.registry, kTickDt);

    const auto bullets = entitiesOfType(w, EntityType::PlayerBullet);
    ASSERT_EQ(bullets.size(), 1u);
    const Entity bullet = bullets[0];
    // ship half width 12 + bullet half width 6
    EXPECT_FLOAT_EQ(w.pos(bullet).x, 100.0f + 12.0f + 6.0f);
    EXPECT_FLOAT_EQ(w.pos(bullet).y, 200.0f);
    EXPECT_FLOAT_EQ(w.vel(bullet).vx, kShotSpeed);
    EXPECT_FLOAT_EQ(w.vel(bullet).vy, 0.0f);
    EXPECT_EQ(*w.registry.getComponent<Team>(bullet), Team::PlayerShot);

    const auto *projectile = w.registry.getComponent<Projectile>(bullet);
    ASSERT_NE(projectile, nullptr);
    EXPECT_EQ(projectile->damage, 1);
    EXPECT_EQ(projectile->ownerId, 2);
    EXPECT_FALSE(projectile->pierce);
    EXPECT_FLOAT_EQ(projectile->lifetime, kShotLifetime);

    const auto *collider = w.registry.getComponent<Collider>(bullet);
    ASSERT_NE(collider, nullptr);
    EXPECT_FLOAT_EQ(collider->w, kBulletWidth);
    EXPECT_FLOAT_EQ(collider->h, kBulletHeight);
    EXPECT_TRUE(collider->solid);
}

TEST(Shoot, NothingHappensWithoutFire)
{
    TestWorld w;
    armedShip(w, 0, 100.0f, 200.0f);

    run(w, 30, kTickDt);

    EXPECT_TRUE(entitiesOfType(w, EntityType::PlayerBullet).empty());
}

TEST(Shoot, HoldingFireDoesNotAutoFire)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    setFire(w, ship, true);

    run(w, 60, kTickDt); // 1 s, well past the cooldown

    EXPECT_EQ(entitiesOfType(w, EntityType::PlayerBullet).size(), 1u);
}

TEST(Shoot, CooldownBlocksAQuickSecondTap)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);

    setFire(w, ship, true);
    run(w, 1, kTickDt); // shot 1
    setFire(w, ship, false);
    run(w, 1, kTickDt);
    setFire(w, ship, true);
    run(w, 1, kTickDt); // 2 ticks later: still cooling down
    EXPECT_EQ(entitiesOfType(w, EntityType::PlayerBullet).size(), 1u);

    setFire(w, ship, false);
    run(w, 12, kTickDt); // cooldown (0.15 s = 9 ticks) is over
    setFire(w, ship, true);
    run(w, 1, kTickDt);
    EXPECT_EQ(entitiesOfType(w, EntityType::PlayerBullet).size(), 2u);
}

TEST(Shoot, ShortHoldFiresNoBeam)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);

    // one step of 0.25 s is below kBeamMinCharge (0.4 s)
    EXPECT_TRUE(holdThenRelease(w, ship, 1).empty());
}

TEST(Shoot, LongHoldFiresAPiercingBeamOnRelease)
{
    TestWorld w;
    const Entity ship = armedShip(w, 3, 100.0f, 200.0f);

    const auto beams = holdThenRelease(w, ship, 4); // charge = 1.0 s

    ASSERT_EQ(beams.size(), 1u);
    const Entity beam = beams[0];
    const auto *projectile = w.registry.getComponent<Projectile>(beam);
    ASSERT_NE(projectile, nullptr);
    EXPECT_EQ(projectile->damage, 4); // 1 + 1.0 * 3
    EXPECT_TRUE(projectile->pierce);
    EXPECT_EQ(projectile->ownerId, 3);
    EXPECT_FLOAT_EQ(w.vel(beam).vx, kBeamSpeed);
    EXPECT_FLOAT_EQ(w.pos(beam).x, 100.0f + 12.0f + kBeamWidth * 0.5f);
    EXPECT_EQ(*w.registry.getComponent<Team>(beam), Team::PlayerShot);

    const auto *collider = w.registry.getComponent<Collider>(beam);
    ASSERT_NE(collider, nullptr);
    EXPECT_FLOAT_EQ(collider->w, kBeamWidth);
    EXPECT_FLOAT_EQ(collider->h, kBeamHeight);
}

TEST(Shoot, BeamDamageIsCappedAtMaxCharge)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);

    const auto beams = holdThenRelease(w, ship, 12); // 3 s held, capped at 2 s

    ASSERT_EQ(beams.size(), 1u);
    EXPECT_EQ(w.registry.getComponent<Projectile>(beams[0])->damage, 7); // 1 + 2.0 * 3
}

TEST(Shoot, ReleasingResetsTheCharge)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);

    holdThenRelease(w, ship, 4);

    EXPECT_FLOAT_EQ(w.registry.getComponent<Weapon>(ship)->charge, 0.0f);
}

TEST(Shoot, DeadShipDoesNotShootAndLosesItsCharge)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    setFire(w, ship, true);
    run(w, 4, kStep); // charging
    w.registry.getComponent<Player>(ship)->alive = false;

    run(w, 4, kStep);
    setFire(w, ship, false);
    run(w, 1, kStep);

    EXPECT_FLOAT_EQ(w.registry.getComponent<Weapon>(ship)->charge, 0.0f);
    EXPECT_EQ(entitiesOfType(w, EntityType::PlayerBullet).size(), 1u); // only the first tap
    EXPECT_TRUE(entitiesOfType(w, EntityType::ChargedBeam).empty());
}

TEST(Shoot, ShipWithoutWeaponIsIgnored)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 200.0f); // no Weapon
    setFire(w, ship, true);

    run(w, 10, kTickDt);

    EXPECT_TRUE(entitiesOfType(w, EntityType::PlayerBullet).empty());
}

TEST(Shoot, ZeroOrNegativeDtDoesNothing)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    setFire(w, ship, true);

    shootSystem(w.registry, 0.0f);
    shootSystem(w.registry, -1.0f);

    EXPECT_TRUE(entitiesOfType(w, EntityType::PlayerBullet).empty());
}

TEST(Shoot, EachPlayerCreditsItsOwnShots)
{
    TestWorld w;
    const Entity a = armedShip(w, 0, 100.0f, 100.0f);
    const Entity b = armedShip(w, 1, 100.0f, 300.0f);
    setFire(w, a, true);
    setFire(w, b, true);

    shootSystem(w.registry, kTickDt);

    const auto bullets = entitiesOfType(w, EntityType::PlayerBullet);
    ASSERT_EQ(bullets.size(), 2u);
    int owners = 0;
    for (const Entity bullet : bullets) {
        owners += 1 << w.registry.getComponent<Projectile>(bullet)->ownerId;
    }
    EXPECT_EQ(owners, 0b11); // one bullet owned by player 0, one by player 1
}
