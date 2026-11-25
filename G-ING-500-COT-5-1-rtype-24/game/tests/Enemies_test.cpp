#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/player.hpp"
#include "game/world.hpp"

#include <cmath>
#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

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

// A turret already inside the arena whose timer is over.
Entity readyTurret(TestWorld &w, float x, float y)
{
    const Entity turret = spawnEnemy(w.registry, EnemyType::Turret, x, y);
    w.registry.getComponent<Enemy>(turret)->fireTimer = 0.0f;
    return turret;
}

} // namespace

// --- stats -------------------------------------------------------------

TEST(SpawnEnemy, BinkChasesWithOneHp)
{
    TestWorld w;

    const Entity e = spawnEnemy(w.registry, EnemyType::Bink, 900.0f, 100.0f);

    EXPECT_EQ(w.registry.getComponent<Health>(e)->hp, kBinkHp);
    EXPECT_EQ(w.registry.getComponent<Health>(e)->maxHp, kBinkHp);
    EXPECT_EQ(*w.registry.getComponent<Team>(e), Team::Enemy);
    EXPECT_EQ(*w.registry.getComponent<EntityType>(e), EntityType::Bink);
    EXPECT_EQ(w.registry.getComponent<Enemy>(e)->type, EnemyType::Bink);
    EXPECT_EQ(w.registry.getComponent<Enemy>(e)->scoreValue, kBinkScore);
    EXPECT_EQ(w.registry.getComponent<Movement>(e)->type, MovementType::Chase);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Movement>(e)->speed, kBinkSpeed);
    EXPECT_FLOAT_EQ(w.pos(e).x, 900.0f);
    EXPECT_FLOAT_EQ(w.pos(e).y, 100.0f);
    EXPECT_TRUE(w.registry.hasComponent<Velocity>(e));
    EXPECT_TRUE(w.registry.getComponent<Collider>(e)->solid);
}

TEST(SpawnEnemy, PatapataFollowsASine)
{
    TestWorld w;

    const Entity e = spawnEnemy(w.registry, EnemyType::Patapata, 900.0f, 200.0f);

    const auto *movement = w.registry.getComponent<Movement>(e);
    EXPECT_EQ(movement->type, MovementType::Sine);
    EXPECT_FLOAT_EQ(movement->amp, kPatapataAmplitude);
    EXPECT_FLOAT_EQ(movement->freq, kPatapataFrequency);
    EXPECT_FLOAT_EQ(movement->speed, kPatapataSpeed);
    EXPECT_EQ(w.registry.getComponent<Enemy>(e)->scoreValue, kPatapataScore);
}

TEST(SpawnEnemy, TurretIsStaticAndFires)
{
    TestWorld w;

    const Entity e = spawnEnemy(w.registry, EnemyType::Turret, 900.0f, 60.0f);

    EXPECT_EQ(w.registry.getComponent<Health>(e)->hp, kTurretHp);
    EXPECT_EQ(w.registry.getComponent<Movement>(e)->type, MovementType::Static);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Enemy>(e)->fireCooldown, kTurretFireCooldown);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Enemy>(e)->fireTimer, kTurretFireCooldown);
    EXPECT_EQ(w.registry.getComponent<Enemy>(e)->scoreValue, kTurretScore);
}

TEST(SpawnEnemy, CarrierGoesStraightAndDoesNotFire)
{
    TestWorld w;

    const Entity e = spawnEnemy(w.registry, EnemyType::Carrier, 900.0f, 140.0f);

    EXPECT_EQ(w.registry.getComponent<Health>(e)->hp, kCarrierHp);
    EXPECT_EQ(w.registry.getComponent<Movement>(e)->type, MovementType::Straight);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Movement>(e)->speed, kCarrierSpeed);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Enemy>(e)->fireCooldown, 0.0f);
    EXPECT_EQ(w.registry.getComponent<Enemy>(e)->scoreValue, kCarrierScore);
}

// --- hit points scale with the number of players -----------------------

TEST(ScaledHp, GrowsByAQuarterPerExtraPlayerRoundedUp)
{
    EXPECT_EQ(scaledEnemyHp(1, 1), 1);
    EXPECT_EQ(scaledEnemyHp(1, 2), 2); // 1.25 -> 2
    EXPECT_EQ(scaledEnemyHp(1, 4), 2); // 1.75 -> 2
    EXPECT_EQ(scaledEnemyHp(3, 1), 3);
    EXPECT_EQ(scaledEnemyHp(3, 2), 4); // 3.75 -> 4
    EXPECT_EQ(scaledEnemyHp(3, 4), 6); // 5.25 -> 6
    EXPECT_EQ(scaledEnemyHp(2, 3), 3); // 3.0 -> 3
}

TEST(ScaledHp, NoPlayerCountsAsOne)
{
    EXPECT_EQ(scaledEnemyHp(3, 0), 3);
    EXPECT_EQ(scaledEnemyHp(3, -2), 3);
}

TEST(SpawnEnemy, UsesThePlayerCountForItsHealth)
{
    TestWorld w;

    const Entity e = spawnEnemy(w.registry, EnemyType::Turret, 900.0f, 60.0f, 4);

    EXPECT_EQ(w.registry.getComponent<Health>(e)->hp, 6);
    EXPECT_EQ(w.registry.getComponent<Health>(e)->maxHp, 6);
}

// --- enemy fire --------------------------------------------------------

TEST(EnemyFire, TurretShootsAnAimedBulletAtTheNearestPlayer)
{
    TestWorld w;
    w.ship(0, 100.0f, 300.0f);
    readyTurret(w, 400.0f, 100.0f);

    enemyFireSystem(w.registry, kTickDt);

    const auto shots = bullets(w);
    ASSERT_EQ(shots.size(), 1u);
    const Entity bullet = shots[0];
    EXPECT_FLOAT_EQ(w.pos(bullet).x, 400.0f);
    EXPECT_FLOAT_EQ(w.pos(bullet).y, 100.0f);
    // aimed at (100, 300): direction (-300, 200) / 360.55
    const float length = std::sqrt(300.0f * 300.0f + 200.0f * 200.0f);
    EXPECT_NEAR(w.vel(bullet).vx, -300.0f / length * kEnemyBulletSpeed, 1e-3f);
    EXPECT_NEAR(w.vel(bullet).vy, 200.0f / length * kEnemyBulletSpeed, 1e-3f);
    const float speed =
        std::sqrt(w.vel(bullet).vx * w.vel(bullet).vx + w.vel(bullet).vy * w.vel(bullet).vy);
    EXPECT_NEAR(speed, kEnemyBulletSpeed, 1e-3f);
}

TEST(EnemyFire, BulletHasTheEnemyShotRules)
{
    TestWorld w;
    w.ship(0, 100.0f, 100.0f);
    readyTurret(w, 400.0f, 100.0f);

    enemyFireSystem(w.registry, kTickDt);

    const auto shots = bullets(w);
    ASSERT_EQ(shots.size(), 1u);
    const Entity bullet = shots[0];
    EXPECT_EQ(*w.registry.getComponent<Team>(bullet), Team::EnemyShot);
    const auto *projectile = w.registry.getComponent<Projectile>(bullet);
    ASSERT_NE(projectile, nullptr);
    EXPECT_EQ(projectile->damage, kEnemyBulletDamage);
    EXPECT_FLOAT_EQ(projectile->lifetime, kEnemyBulletLifetime);
    EXPECT_EQ(projectile->ownerId, -1);
    EXPECT_FALSE(projectile->pierce);
    const auto *collider = w.registry.getComponent<Collider>(bullet);
    ASSERT_NE(collider, nullptr);
    EXPECT_FLOAT_EQ(collider->w, kEnemyBulletSize);
    EXPECT_FLOAT_EQ(collider->h, kEnemyBulletSize);
    EXPECT_EQ(collider->layer, kLayerEnemyShot);
}

TEST(EnemyFire, ASpecialBulletKeepsTheEnemyShotRulesAndCarriesItsVariant)
{
    TestWorld w;
    spawnEnemyBullet(w.registry, Position{400.0f, 100.0f}, Velocity{-kEnemyBulletSpeed, 0.0f},
                     BulletVisual::Gomander);

    const auto shots = bullets(w);
    ASSERT_EQ(shots.size(), 1u);
    const Entity bullet = shots[0];
    EXPECT_EQ(*w.registry.getComponent<Team>(bullet), Team::EnemyShot);
    const auto *projectile = w.registry.getComponent<Projectile>(bullet);
    ASSERT_NE(projectile, nullptr);
    EXPECT_GT(projectile->damage, 0); // it must hurt the player
    EXPECT_EQ(projectile->damage, kEnemyBulletDamage);
    EXPECT_EQ(projectile->visual, BulletVisual::Gomander);
    const auto *collider = w.registry.getComponent<Collider>(bullet);
    ASSERT_NE(collider, nullptr);
    EXPECT_EQ(collider->layer, kLayerEnemyShot);
}

TEST(EnemyFire, TargetsTheClosestAlivePlayer)
{
    TestWorld w;
    const Entity near1 = w.ship(0, 380.0f, 300.0f); // closest, but dead
    w.registry.getComponent<Player>(near1)->alive = false;
    w.ship(1, 100.0f, 100.0f);
    readyTurret(w, 400.0f, 100.0f);

    enemyFireSystem(w.registry, kTickDt);

    const auto shots = bullets(w);
    ASSERT_EQ(shots.size(), 1u);
    EXPECT_FLOAT_EQ(w.vel(shots[0]).vx, -kEnemyBulletSpeed); // straight left at player 1
    EXPECT_NEAR(w.vel(shots[0]).vy, 0.0f, 1e-3f);
}

TEST(EnemyFire, WaitsWhileOffScreen)
{
    TestWorld w;
    w.ship(0, 100.0f, 300.0f);
    readyTurret(w, kArenaWidth + kEnemySpawnMargin, 100.0f);

    enemyFireSystem(w.registry, kTickDt);

    EXPECT_TRUE(bullets(w).empty());
}

TEST(EnemyFire, FiresAsSoonAsItEntersTheArena)
{
    TestWorld w;
    w.ship(0, 100.0f, 300.0f);
    const Entity turret = readyTurret(w, kArenaWidth + kEnemySpawnMargin, 100.0f);
    enemyFireSystem(w.registry, kTickDt);
    ASSERT_TRUE(bullets(w).empty());

    w.pos(turret).x = kArenaWidth - 10.0f;
    enemyFireSystem(w.registry, kTickDt);

    EXPECT_EQ(bullets(w).size(), 1u);
}

TEST(EnemyFire, WaitsWhenNobodyIsAlive)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 300.0f);
    w.registry.getComponent<Player>(ship)->alive = false;
    readyTurret(w, 400.0f, 100.0f);

    enemyFireSystem(w.registry, kTickDt);

    EXPECT_TRUE(bullets(w).empty());
}

TEST(EnemyFire, FiresAgainOnlyAfterTheCooldown)
{
    TestWorld w;
    w.ship(0, 100.0f, 300.0f);
    readyTurret(w, 400.0f, 100.0f);

    enemyFireSystem(w.registry, 0.5f); // shot 1, timer reset to 2.0
    EXPECT_EQ(bullets(w).size(), 1u);

    for (int i = 0; i < 3; ++i) {
        enemyFireSystem(w.registry, 0.5f); // 1.5 s elapsed
    }
    EXPECT_EQ(bullets(w).size(), 1u);

    enemyFireSystem(w.registry, 0.5f); // 2.0 s elapsed
    EXPECT_EQ(bullets(w).size(), 2u);
}

TEST(EnemyFire, EnemiesWithoutACooldownNeverFire)
{
    TestWorld w;
    w.ship(0, 100.0f, 300.0f);
    spawnEnemy(w.registry, EnemyType::Bink, 400.0f, 100.0f);
    spawnEnemy(w.registry, EnemyType::Patapata, 400.0f, 200.0f);
    spawnEnemy(w.registry, EnemyType::Carrier, 400.0f, 400.0f);

    for (int i = 0; i < 300; ++i) {
        enemyFireSystem(w.registry, kTickDt);
    }

    EXPECT_TRUE(bullets(w).empty());
}

TEST(EnemyFire, ZeroDtDoesNothing)
{
    TestWorld w;
    w.ship(0, 100.0f, 300.0f);
    readyTurret(w, 400.0f, 100.0f);

    enemyFireSystem(w.registry, 0.0f);

    EXPECT_TRUE(bullets(w).empty());
}

TEST(NearestAlivePlayer, ReturnsTheClosestAliveOne)
{
    TestWorld w;
    EXPECT_FALSE(nearestAlivePlayer(w.registry, 0.0f, 0.0f).has_value());

    w.ship(0, 500.0f, 100.0f);
    w.ship(1, 200.0f, 100.0f);
    const auto best = nearestAlivePlayer(w.registry, 220.0f, 120.0f);

    ASSERT_TRUE(best.has_value());
    EXPECT_FLOAT_EQ(best->x, 200.0f);
    EXPECT_FLOAT_EQ(best->y, 100.0f);
}
