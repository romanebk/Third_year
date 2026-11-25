#include "TestWorld.hpp"
#include "game/collision.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/movement.hpp"
#include "game/pickups.hpp"
#include "game/player.hpp"
#include "game/shoot.hpp"
#include "game/snapshot.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

Entity armedShip(TestWorld &w, int playerId, float x, float y)
{
    const Entity ship = w.ship(playerId, x, y);
    w.registry.emplaceComponent<Weapon>(ship);
    return ship;
}

std::vector<Entity> pickups(TestWorld &w)
{
    std::vector<Entity> found;
    forEach<Pickup>(w.registry, [&](Entity e, Pickup &) { found.push_back(e); });
    return found;
}

std::vector<Entity> playerBullets(TestWorld &w)
{
    std::vector<Entity> found;
    forEach<EntityType>(w.registry, [&](Entity e, EntityType &t) {
        if (t == EntityType::PlayerBullet) {
            found.push_back(e);
        }
    });
    return found;
}

Weapon &weaponOf(TestWorld &w, Entity ship)
{
    return *w.registry.getComponent<Weapon>(ship);
}

PowerState &powerOf(TestWorld &w, Entity ship)
{
    return *w.registry.getComponent<PowerState>(ship);
}

Player &playerOf(TestWorld &w, Entity ship)
{
    return *w.registry.getComponent<Player>(ship);
}

} // namespace

// --- creating a pickup -------------------------------------------------

TEST(Pickup, SpawnsWithTheComponentsOfACollectible)
{
    TestWorld w;

    const Entity e = spawnPickup(w.registry, PickupKind::Speed, 300.0f, 120.0f);

    EXPECT_EQ(w.registry.getComponent<Pickup>(e)->kind, PickupKind::Speed);
    EXPECT_EQ(*w.registry.getComponent<Team>(e), Team::Pickup);
    EXPECT_EQ(*w.registry.getComponent<EntityType>(e), EntityType::PickupEnt);
    EXPECT_FLOAT_EQ(w.pos(e).x, 300.0f);
    EXPECT_FLOAT_EQ(w.pos(e).y, 120.0f);
    EXPECT_FLOAT_EQ(w.vel(e).vx, -kPickupDriftSpeed); // scrolls with the level
    EXPECT_EQ(w.registry.getComponent<Collider>(e)->layer, kLayerPickup);
    EXPECT_TRUE(w.registry.getComponent<Collider>(e)->solid);
}

// --- collecting --------------------------------------------------------

TEST(Collect, APowerPickupRaisesTheWeaponAndDisappears)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    const Entity pickup = spawnPickup(w.registry, PickupKind::Power, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_EQ(weaponOf(w, ship).level, 1);
    EXPECT_FALSE(w.registry.isAlive(pickup));
}

TEST(Collect, ASpeedPickupRaisesTheSpeedLevel)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    spawnPickup(w.registry, PickupKind::Speed, 105.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_EQ(powerOf(w, ship).speedLevel, 1);
    EXPECT_EQ(weaponOf(w, ship).level, 0);
}

TEST(Collect, AMaxedShipGetsPointsInsteadAndStillConsumesTheItem)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    weaponOf(w, ship).level = kWeaponMaxLevel;
    powerOf(w, ship).speedLevel = static_cast<std::uint8_t>(kPlayerMaxSpeedLevel);
    const Entity power = spawnPickup(w.registry, PickupKind::Power, 100.0f, 100.0f);
    const Entity speed = spawnPickup(w.registry, PickupKind::Speed, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_EQ(weaponOf(w, ship).level, kWeaponMaxLevel);
    EXPECT_EQ(powerOf(w, ship).speedLevel, kPlayerMaxSpeedLevel);
    EXPECT_EQ(playerOf(w, ship).score, 2 * kPickupBonusScore);
    EXPECT_FALSE(w.registry.isAlive(power));
    EXPECT_FALSE(w.registry.isAlive(speed));
}

TEST(Collect, ADeadShipCannotCollect)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    playerOf(w, ship).alive = false;
    const Entity pickup = spawnPickup(w.registry, PickupKind::Power, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(pickup));
    EXPECT_EQ(weaponOf(w, ship).level, 0);
}

TEST(Collect, APickupAwayFromTheShipStaysThere)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    const Entity pickup = spawnPickup(w.registry, PickupKind::Power, 400.0f, 300.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(pickup));
    EXPECT_EQ(weaponOf(w, ship).level, 0);
}

TEST(Collect, TheForceDoesNotCollect)
{
    TestWorld w;
    w.force(0, 100.0f, 100.0f);
    const Entity pickup = spawnPickup(w.registry, PickupKind::Power, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(pickup));
}

TEST(Collect, TwoShipsOnTheSamePickupShareNothing)
{
    TestWorld w;
    const Entity a = armedShip(w, 0, 100.0f, 100.0f);
    const Entity b = armedShip(w, 1, 104.0f, 100.0f);
    spawnPickup(w.registry, PickupKind::Power, 102.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_EQ(weaponOf(w, a).level + weaponOf(w, b).level, 1); // only one of them got it
}

TEST(Collect, ASlowPickupDriftsIntoAStillShipOverSeveralTicks)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    const Position spawn = playerSpawnPosition(0);
    spawnPickup(w.registry, PickupKind::Power, spawn.x + 120.0f, spawn.y);

    for (int i = 0; i < 180 && weaponOf(w, ship).level == 0; ++i) {
        stepGame(w.registry, kTickDt);
    }

    EXPECT_EQ(weaponOf(w, ship).level, 1);
    EXPECT_TRUE(pickups(w).empty());
}

TEST(Collect, APickupThatLeavesTheArenaIsRemoved)
{
    TestWorld w;
    const Entity pickup = spawnPickup(w.registry, PickupKind::Speed, -100.0f, 100.0f);

    cullSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(pickup));
}

// --- weapon levels -----------------------------------------------------

TEST(WeaponLevels, LevelZeroShootsOneStraightBullet)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    w.registry.getComponent<Input>(ship)->fire = true;

    shootSystem(w.registry, kTickDt);

    const auto bullets = playerBullets(w);
    ASSERT_EQ(bullets.size(), 1u);
    EXPECT_FLOAT_EQ(w.pos(bullets[0]).y, 200.0f);
    EXPECT_FLOAT_EQ(w.vel(bullets[0]).vy, 0.0f);
}

TEST(WeaponLevels, LevelOneShootsTwoParallelBullets)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    weaponOf(w, ship).level = 1;
    w.registry.getComponent<Input>(ship)->fire = true;

    shootSystem(w.registry, kTickDt);

    const auto bullets = playerBullets(w);
    ASSERT_EQ(bullets.size(), 2u);
    std::vector<float> ys = {w.pos(bullets[0]).y, w.pos(bullets[1]).y};
    std::sort(ys.begin(), ys.end());
    EXPECT_FLOAT_EQ(ys[0], 200.0f - kTwinShotOffset);
    EXPECT_FLOAT_EQ(ys[1], 200.0f + kTwinShotOffset);
    EXPECT_FLOAT_EQ(w.vel(bullets[0]).vy, 0.0f);
    EXPECT_FLOAT_EQ(w.vel(bullets[1]).vy, 0.0f);
}

TEST(WeaponLevels, LevelTwoShootsAThreeWaySpread)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    weaponOf(w, ship).level = 2;
    w.registry.getComponent<Input>(ship)->fire = true;

    shootSystem(w.registry, kTickDt);

    const auto bullets = playerBullets(w);
    ASSERT_EQ(bullets.size(), 3u);
    std::vector<float> speedsY;
    for (const Entity bullet : bullets) {
        speedsY.push_back(w.vel(bullet).vy);
        EXPECT_FLOAT_EQ(w.vel(bullet).vx, kShotSpeed);
        EXPECT_FLOAT_EQ(w.pos(bullet).y, 200.0f);
    }
    std::sort(speedsY.begin(), speedsY.end());
    EXPECT_FLOAT_EQ(speedsY[0], -kSpreadShotVy);
    EXPECT_FLOAT_EQ(speedsY[1], 0.0f);
    EXPECT_FLOAT_EQ(speedsY[2], kSpreadShotVy);
}

TEST(WeaponLevels, EveryExtraShotKeepsTheOwnerAndTheDamage)
{
    TestWorld w;
    const Entity ship = armedShip(w, 2, 100.0f, 200.0f);
    weaponOf(w, ship).level = 2;
    w.registry.getComponent<Input>(ship)->fire = true;

    shootSystem(w.registry, kTickDt);

    for (const Entity bullet : playerBullets(w)) {
        const auto *projectile = w.registry.getComponent<Projectile>(bullet);
        ASSERT_NE(projectile, nullptr);
        EXPECT_EQ(projectile->ownerId, 2);
        EXPECT_EQ(projectile->damage, 1);
        EXPECT_FALSE(projectile->pierce);
    }
}

TEST(WeaponLevels, TheChargedBeamIsNotAffected)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 200.0f);
    weaponOf(w, ship).level = 2;
    Input &input = *w.registry.getComponent<Input>(ship);

    input.fire = true;
    for (int i = 0; i < 4; ++i) {
        shootSystem(w.registry, 0.25f); // holds 1 s
    }
    input.fire = false;
    shootSystem(w.registry, 0.25f);

    int beams = 0;
    forEach<EntityType>(
        w.registry, [&](Entity, EntityType &t) { beams += t == EntityType::ChargedBeam ? 1 : 0; });
    EXPECT_EQ(beams, 1);
}

// --- drops -------------------------------------------------------------

TEST(Drops, ACarrierAlwaysDropsAndTheKindsAlternate)
{
    TestWorld w;

    EXPECT_EQ(rollDrop(w.registry, EnemyType::Carrier), PickupKind::Power);
    EXPECT_EQ(rollDrop(w.registry, EnemyType::Carrier), PickupKind::Speed);
    EXPECT_EQ(rollDrop(w.registry, EnemyType::Carrier), PickupKind::Power);
}

TEST(Drops, ATurretAndTheBossNeverDrop)
{
    TestWorld w;

    for (int i = 0; i < 1000; ++i) {
        EXPECT_FALSE(rollDrop(w.registry, EnemyType::Turret).has_value());
        EXPECT_FALSE(rollDrop(w.registry, EnemyType::Boss).has_value());
    }
}

TEST(Drops, BinksAndPatapatasDropAboutEightPercentOfTheTime)
{
    TestWorld w;
    int drops = 0;
    int power = 0;
    const int rolls = 20000;

    for (int i = 0; i < rolls; ++i) {
        const EnemyType type = i % 2 == 0 ? EnemyType::Bink : EnemyType::Patapata;
        if (const auto kind = rollDrop(w.registry, type)) {
            ++drops;
            power += *kind == PickupKind::Power ? 1 : 0;
        }
    }

    const double rate = static_cast<double>(drops) / rolls;
    EXPECT_GT(rate, 0.06);
    EXPECT_LT(rate, 0.10);
    EXPECT_GT(power, drops / 4); // both kinds show up
    EXPECT_LT(power, drops * 3 / 4);
}

TEST(Drops, TheSameStartGivesTheSameDrops)
{
    std::vector<int> first;
    std::vector<int> second;
    for (std::vector<int> *out : {&first, &second}) {
        TestWorld w;
        for (int i = 0; i < 500; ++i) {
            const auto kind = rollDrop(w.registry, EnemyType::Bink);
            out->push_back(kind ? 1 + static_cast<int>(*kind) : 0);
        }
    }

    EXPECT_EQ(first, second);
}

TEST(Drops, ACarrierKilledByAShotLeavesAPickupWhereItDied)
{
    TestWorld w;
    const Entity carrier = spawnEnemy(w.registry, EnemyType::Carrier, 500.0f, 200.0f);
    w.registry.getComponent<Health>(carrier)->hp = 1;
    w.shot(Team::PlayerShot, 500.0f, 200.0f, 5, 0);

    collisionSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(carrier));
    const auto found = pickups(w);
    ASSERT_EQ(found.size(), 1u);
    EXPECT_EQ(w.registry.getComponent<Pickup>(found[0])->kind, PickupKind::Power);
    EXPECT_FLOAT_EQ(w.pos(found[0]).x, 500.0f);
    EXPECT_FLOAT_EQ(w.pos(found[0]).y, 200.0f);
}

TEST(Drops, ATurretKilledLeavesNothing)
{
    TestWorld w;
    const Entity turret = spawnEnemy(w.registry, EnemyType::Turret, 500.0f, 200.0f);
    w.registry.getComponent<Health>(turret)->hp = 1;
    w.shot(Team::PlayerShot, 500.0f, 200.0f, 5, 0);

    collisionSystem(w.registry);

    EXPECT_TRUE(pickups(w).empty());
}

TEST(Drops, AnEnemyThatSurvivesLeavesNothing)
{
    TestWorld w;
    spawnEnemy(w.registry, EnemyType::Carrier, 500.0f, 200.0f); // 2 hp
    w.shot(Team::PlayerShot, 500.0f, 200.0f, 1, 0);

    collisionSystem(w.registry);

    EXPECT_TRUE(pickups(w).empty());
}

// --- losing upgrades on death ------------------------------------------

TEST(Death, ALostShipLosesOneSpeedLevelAndOneWeaponLevel)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    powerOf(w, ship).speedLevel = 2;
    weaponOf(w, ship).level = 2;
    w.shot(Team::EnemyShot, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_FALSE(playerOf(w, ship).alive);
    EXPECT_EQ(powerOf(w, ship).speedLevel, 1);
    EXPECT_EQ(weaponOf(w, ship).level, 1);
}

TEST(Death, UpgradesNeverGoBelowZero)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    w.shot(Team::EnemyShot, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_EQ(powerOf(w, ship).speedLevel, 0);
    EXPECT_EQ(weaponOf(w, ship).level, 0);
}

TEST(Death, AnInvincibleShipKeepsItsUpgrades)
{
    TestWorld w;
    const Entity ship = armedShip(w, 0, 100.0f, 100.0f);
    playerOf(w, ship).invincibleTimer = 1.0f;
    weaponOf(w, ship).level = 2;
    w.shot(Team::EnemyShot, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_EQ(weaponOf(w, ship).level, 2);
}

// --- network -----------------------------------------------------------

TEST(PickupSnapshot, ExtraIsThePickupKind)
{
    TestWorld w;
    spawnPickup(w.registry, PickupKind::Power, 300.0f, 100.0f);
    spawnPickup(w.registry, PickupKind::Speed, 400.0f, 100.0f);

    const Snapshot snapshot = collectSnapshot(w.registry);

    ASSERT_EQ(snapshot.entities.size(), 2u);
    int power = 0;
    int speed = 0;
    for (const SnapshotEntity &entity : snapshot.entities) {
        EXPECT_EQ(entity.type, EntityType::PickupEnt);
        EXPECT_EQ(entity.team, Team::Pickup);
        power += entity.extra == static_cast<std::uint8_t>(PickupKind::Power) ? 1 : 0;
        speed += entity.extra == static_cast<std::uint8_t>(PickupKind::Speed) ? 1 : 0;
    }
    EXPECT_EQ(power, 1);
    EXPECT_EQ(speed, 1);
}
