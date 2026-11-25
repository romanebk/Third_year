#include "TestWorld.hpp"
#include "game/collision.hpp"
#include "game/ecs_helpers.hpp"
#include "game/world.hpp"

#include <gtest/gtest.h>

using namespace game_test;

namespace {

int countExplosions(TestWorld &w)
{
    int n = 0;
    forEach<EntityType>(w.registry, [&](Entity, EntityType &type) {
        if (type == EntityType::Explosion) {
            ++n;
        }
    });
    return n;
}

Player &playerOf(TestWorld &w, Entity ship)
{
    return *w.registry.getComponent<Player>(ship);
}

} // namespace

// --- detection ---------------------------------------------------------

TEST(Detect, FindsOverlappingPairWithRoleOrder)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 100.0f);
    const Entity shot = w.shot(Team::EnemyShot, 105.0f, 100.0f);

    const auto contacts = detectCollisions(w.registry);

    ASSERT_EQ(contacts.size(), 1u);
    EXPECT_EQ(contacts[0].kind, ContactKind::EnemyShotHitsPlayer);
    EXPECT_EQ(contacts[0].first, shot);
    EXPECT_EQ(contacts[0].second, ship);
}

TEST(Detect, TouchingEdgesDoNotCount)
{
    TestWorld w;
    w.ship(0, 100.0f, 100.0f);                              // half width 12
    w.shot(Team::EnemyShot, 100.0f + 12.0f + 4.0f, 100.0f); // half width 4: edges touch

    EXPECT_TRUE(detectCollisions(w.registry).empty());
}

TEST(Detect, FarApartDoNotCount)
{
    TestWorld w;
    w.ship(0, 100.0f, 100.0f);
    w.enemy(500.0f, 400.0f);

    EXPECT_TRUE(detectCollisions(w.registry).empty());
}

TEST(Detect, NoFriendlyFire)
{
    TestWorld w;
    w.ship(0, 100.0f, 100.0f);
    w.ship(1, 100.0f, 100.0f);
    w.shot(Team::PlayerShot, 100.0f, 100.0f);
    w.enemy(300.0f, 300.0f);
    w.enemy(300.0f, 300.0f);
    w.shot(Team::EnemyShot, 300.0f, 300.0f);

    // Ship/ship, player shot/ship, enemy/enemy, enemy shot/enemy: no rule.
    EXPECT_TRUE(detectCollisions(w.registry).empty());
}

TEST(Detect, IgnoresNonSolidAndDeadPlayers)
{
    TestWorld w;
    const Entity ghost = w.enemy(100.0f, 100.0f);
    w.registry.getComponent<Collider>(ghost)->solid = false;
    const Entity dead = w.ship(0, 100.0f, 100.0f);
    playerOf(w, dead).alive = false;
    w.shot(Team::EnemyShot, 100.0f, 100.0f);

    EXPECT_TRUE(detectCollisions(w.registry).empty());
}

TEST(Detect, FindsAPickupTouchingAShipWithRoleOrder)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 100.0f);
    const Entity pickup = w.registry.spawnEntity();
    w.registry.emplaceComponent<Position>(pickup, 100.0f, 100.0f);
    w.registry.addComponent(pickup, Collider{16.0f, 16.0f, 16, true});
    w.registry.addComponent(pickup, Team::Pickup);

    const auto contacts = detectCollisions(w.registry);

    ASSERT_EQ(contacts.size(), 1u);
    EXPECT_EQ(contacts[0].kind, ContactKind::PlayerCollectsPickup);
    EXPECT_EQ(contacts[0].first, pickup);
    EXPECT_EQ(contacts[0].second, ship);
}

TEST(Detect, APickupAloneOrTouchingAnEnemyIsNotAContact)
{
    TestWorld w;
    const Entity pickup = w.registry.spawnEntity();
    w.registry.emplaceComponent<Position>(pickup, 100.0f, 100.0f);
    w.registry.addComponent(pickup, Collider{16.0f, 16.0f, 16, true});
    w.registry.addComponent(pickup, Team::Pickup);
    w.enemy(100.0f, 100.0f);

    EXPECT_TRUE(detectCollisions(w.registry).empty());
}

TEST(Detect, ClassifiesEveryRule)
{
    TestWorld w;
    w.shot(Team::PlayerShot, 100.0f, 100.0f);
    w.enemy(100.0f, 100.0f);
    w.ship(0, 300.0f, 300.0f);
    w.enemy(300.0f, 300.0f);
    w.force(0, 500.0f, 100.0f);
    w.shot(Team::EnemyShot, 500.0f, 100.0f);
    w.force(0, 700.0f, 300.0f);
    w.enemy(700.0f, 300.0f);
    w.shot(Team::PlayerShot, 100.0f, 450.0f);
    w.shot(Team::EnemyShot, 100.0f, 450.0f);

    const auto contacts = detectCollisions(w.registry);
    int counts[6] = {};
    for (const auto &c : contacts) {
        ++counts[static_cast<int>(c.kind)];
    }

    EXPECT_EQ(contacts.size(), 5u);
    EXPECT_EQ(counts[static_cast<int>(ContactKind::PlayerShotHitsEnemy)], 1);
    EXPECT_EQ(counts[static_cast<int>(ContactKind::EnemyRamsPlayer)], 1);
    EXPECT_EQ(counts[static_cast<int>(ContactKind::EnemyShotAbsorbedByForce)], 1);
    EXPECT_EQ(counts[static_cast<int>(ContactKind::EnemyRamsForce)], 1);
    EXPECT_EQ(counts[static_cast<int>(ContactKind::ShotsCancel)], 1);
}

// --- damage ------------------------------------------------------------

TEST(Damage, PlayerShotKillsEnemyAndCreditsOwner)
{
    TestWorld w;
    const Entity ship = w.ship(2, 50.0f, 50.0f);
    const Entity enemy = w.enemy(300.0f, 200.0f, 1, 150);
    const Entity shot = w.shot(Team::PlayerShot, 300.0f, 200.0f, 1, 2);

    collisionSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(enemy));
    EXPECT_FALSE(w.registry.isAlive(shot));
    EXPECT_EQ(playerOf(w, ship).score, 150);
    EXPECT_EQ(countExplosions(w), 1);
}

TEST(Damage, ExplosionAppearsWhereTheEnemyDied)
{
    TestWorld w;
    w.enemy(300.0f, 200.0f);
    w.shot(Team::PlayerShot, 300.0f, 200.0f);

    collisionSystem(w.registry);

    forEach<EntityType, Position, Lifetime>(
        w.registry, [&](Entity, EntityType &type, Position &p, Lifetime &life) {
            EXPECT_EQ(type, EntityType::Explosion);
            EXPECT_FLOAT_EQ(p.x, 300.0f);
            EXPECT_FLOAT_EQ(p.y, 200.0f);
            EXPECT_FLOAT_EQ(life.remaining, kExplosionLifetime);
        });
}

TEST(Damage, ToughEnemySurvivesAHit)
{
    TestWorld w;
    const Entity enemy = w.enemy(300.0f, 200.0f, 3);
    const Entity shot = w.shot(Team::PlayerShot, 300.0f, 200.0f, 1);

    collisionSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(enemy));
    EXPECT_EQ(w.registry.getComponent<Health>(enemy)->hp, 2);
    EXPECT_FALSE(w.registry.isAlive(shot));
    EXPECT_EQ(countExplosions(w), 0);
}

TEST(Damage, TwoShotsSameTickBothCountUntilDeath)
{
    TestWorld w;
    const Entity enemy = w.enemy(300.0f, 200.0f, 2);
    const Entity a = w.shot(Team::PlayerShot, 300.0f, 200.0f);
    const Entity b = w.shot(Team::PlayerShot, 302.0f, 200.0f);

    collisionSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(enemy));
    EXPECT_FALSE(w.registry.isAlive(a));
    EXPECT_FALSE(w.registry.isAlive(b));
    EXPECT_EQ(countExplosions(w), 1); // one death, one explosion
}

TEST(Damage, PiercingBeamSurvivesAKillButNotATankyEnemy)
{
    TestWorld w;
    const Entity weak = w.enemy(300.0f, 100.0f, 1);
    const Entity beam1 = w.shot(Team::PlayerShot, 300.0f, 100.0f, 7, 0, true);
    const Entity tank = w.enemy(300.0f, 400.0f, 20);
    const Entity beam2 = w.shot(Team::PlayerShot, 300.0f, 400.0f, 7, 0, true);

    collisionSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(weak));
    EXPECT_TRUE(w.registry.isAlive(beam1));
    EXPECT_TRUE(w.registry.isAlive(tank));
    EXPECT_EQ(w.registry.getComponent<Health>(tank)->hp, 13);
    EXPECT_FALSE(w.registry.isAlive(beam2));
}

TEST(Damage, EnemyShotKillsPlayer)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 100.0f);
    w.vel(ship) = Velocity{50.0f, 0.0f};
    const Entity shot = w.shot(Team::EnemyShot, 100.0f, 100.0f);

    collisionSystem(w.registry);

    const Player &p = playerOf(w, ship);
    EXPECT_FALSE(p.alive);
    EXPECT_EQ(p.lives, 2);
    EXPECT_FLOAT_EQ(p.respawnTimer, kRespawnDelay);
    EXPECT_FLOAT_EQ(w.vel(ship).vx, 0.0f);
    EXPECT_TRUE(w.registry.isAlive(ship)); // kept for the respawn system
    EXPECT_FALSE(w.registry.isAlive(shot));
    EXPECT_EQ(countExplosions(w), 1);
}

TEST(Damage, DeadPlayerIsNotHitAgain)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 100.0f);
    w.shot(Team::EnemyShot, 100.0f, 100.0f);
    w.shot(Team::EnemyShot, 101.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_EQ(playerOf(w, ship).lives, 2); // lost one life, not two
    collisionSystem(w.registry);
    EXPECT_EQ(playerOf(w, ship).lives, 2);
}

TEST(Damage, InvinciblePlayerTakesNoDamageButShotIsConsumed)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 100.0f);
    playerOf(w, ship).invincibleTimer = 1.5f;
    const Entity shot = w.shot(Team::EnemyShot, 100.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_EQ(w.registry.getComponent<Health>(ship)->hp, 1);
    EXPECT_FALSE(w.registry.isAlive(shot));
}

TEST(Damage, ForceAbsorbsEnemyShots)
{
    TestWorld w;
    const Entity force = w.force(0, 500.0f, 100.0f);
    const Entity shot = w.shot(Team::EnemyShot, 500.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(w.registry.isAlive(force));
    EXPECT_FALSE(w.registry.isAlive(shot));
}

TEST(Damage, ForceRamKillsEnemyAndCreditsOwner)
{
    TestWorld w;
    const Entity ship = w.ship(1, 50.0f, 50.0f);
    const Entity force = w.force(1, 700.0f, 300.0f);
    const Entity enemy = w.enemy(700.0f, 300.0f, 3, 300);

    collisionSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(enemy));
    EXPECT_TRUE(w.registry.isAlive(force)); // the Force takes no damage
    EXPECT_EQ(playerOf(w, ship).score, 300);
}

TEST(Damage, EnemyRamsPlayerBothTakeOne)
{
    TestWorld w;
    const Entity ship = w.ship(0, 300.0f, 300.0f);
    const Entity enemy = w.enemy(300.0f, 300.0f, 1);

    collisionSystem(w.registry);

    EXPECT_FALSE(playerOf(w, ship).alive);
    EXPECT_FALSE(w.registry.isAlive(enemy));
    EXPECT_EQ(countExplosions(w), 2);
}

TEST(Damage, InvinciblePlayerStillDamagesTheRammingEnemy)
{
    TestWorld w;
    const Entity ship = w.ship(0, 300.0f, 300.0f);
    playerOf(w, ship).invincibleTimer = 1.0f;
    const Entity enemy = w.enemy(300.0f, 300.0f, 2);

    collisionSystem(w.registry);

    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_EQ(w.registry.getComponent<Health>(enemy)->hp, 1);
}

TEST(Damage, ShotsCancelEachOtherButABeamPiercesThrough)
{
    TestWorld w;
    const Entity mine = w.shot(Team::PlayerShot, 100.0f, 100.0f);
    const Entity theirs = w.shot(Team::EnemyShot, 100.0f, 100.0f);
    const Entity beam = w.shot(Team::PlayerShot, 100.0f, 400.0f, 5, 0, true);
    const Entity theirs2 = w.shot(Team::EnemyShot, 100.0f, 400.0f);

    collisionSystem(w.registry);

    EXPECT_FALSE(w.registry.isAlive(mine));
    EXPECT_FALSE(w.registry.isAlive(theirs));
    EXPECT_TRUE(w.registry.isAlive(beam));
    EXPECT_FALSE(w.registry.isAlive(theirs2));
}

TEST(Damage, NothingHappensWithoutContacts)
{
    TestWorld w;
    const Entity ship = w.ship(0, 100.0f, 100.0f);
    const Entity enemy = w.enemy(800.0f, 100.0f);

    collisionSystem(w.registry);

    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_TRUE(w.registry.isAlive(enemy));
    EXPECT_EQ(w.registry.aliveCount(), 2u);
}

// --- lifetime ----------------------------------------------------------

TEST(Lifetime, ExplosionExpires)
{
    TestWorld w;
    w.enemy(300.0f, 200.0f);
    w.shot(Team::PlayerShot, 300.0f, 200.0f);
    collisionSystem(w.registry);
    ASSERT_EQ(countExplosions(w), 1);

    lifetimeSystem(w.registry, 0.3f);
    EXPECT_EQ(countExplosions(w), 1);
    lifetimeSystem(w.registry, 0.2f); // 0.5s total > 0.4s
    EXPECT_EQ(countExplosions(w), 0);
    // The enemy and the shot are gone. (A pickup may have dropped, and the
    // drop state lives on an entity of its own, so the world is not empty.)
    int enemies = 0;
    int projectiles = 0;
    forEach<Enemy>(w.registry, [&](Entity, Enemy &) { ++enemies; });
    forEach<Projectile>(w.registry, [&](Entity, Projectile &) { ++projectiles; });
    EXPECT_EQ(enemies, 0);
    EXPECT_EQ(projectiles, 0);
}

TEST(Lifetime, ProjectilesExpire)
{
    TestWorld w;
    const Entity shot = w.shot(Team::PlayerShot, 100.0f, 100.0f);
    w.registry.getComponent<Projectile>(shot)->lifetime = 1.0f;

    lifetimeSystem(w.registry, 0.9f);
    EXPECT_TRUE(w.registry.isAlive(shot));
    lifetimeSystem(w.registry, 0.2f);
    EXPECT_FALSE(w.registry.isAlive(shot));
}

TEST(Lifetime, EntityWithBothTimersIsKilledOnce)
{
    TestWorld w;
    const Entity shot = w.shot(Team::PlayerShot, 100.0f, 100.0f);
    w.registry.getComponent<Projectile>(shot)->lifetime = 0.1f;
    w.registry.addComponent(shot, Lifetime{0.1f});

    lifetimeSystem(w.registry, 1.0f);

    EXPECT_FALSE(w.registry.isAlive(shot));
    EXPECT_EQ(w.registry.aliveCount(), 0u);
}
