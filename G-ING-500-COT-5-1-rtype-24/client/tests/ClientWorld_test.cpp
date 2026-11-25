#include "world/ClientWorld.hpp"

#include <gtest/gtest.h>

using namespace client;

namespace {

EntityInfo makeEntity(std::uint32_t id, game::EntityType type, float x, float y, int playerId = -1)
{
    EntityInfo entity;
    entity.id = id;
    entity.type = type;
    entity.x = x;
    entity.y = y;
    entity.playerId = playerId;
    return entity;
}

ServerMessage makeSnapshot(std::uint32_t tick, const std::vector<EntityInfo> &entities)
{
    ServerMessage snapshot;
    snapshot.type = MessageType::Snapshot;
    snapshot.tick = tick;
    snapshot.entities = entities;
    return snapshot;
}

} // namespace

TEST(ClientWorld, AddsAndRemovesEntities)
{
    ClientWorld world;
    world.applySnapshot(makeSnapshot(1, {makeEntity(1, game::EntityType::Bink, 100, 100),
                                         makeEntity(2, game::EntityType::EnemyBullet, 50, 50)}));
    EXPECT_EQ(world.getEntities().size(), 2U);

    world.applySnapshot(makeSnapshot(2, {makeEntity(1, game::EntityType::Bink, 90, 100)}));
    EXPECT_EQ(world.getEntities().size(), 1U);
}

TEST(ClientWorld, IgnoresOldSnapshots)
{
    ClientWorld world;
    world.applySnapshot(makeSnapshot(5, {makeEntity(1, game::EntityType::Bink, 0, 0)}));
    world.applySnapshot(makeSnapshot(3, {})); // arrived late: ignored
    EXPECT_EQ(world.getEntities().size(), 1U);
}

TEST(ClientWorld, InterpolatesBetweenTwoSnapshots)
{
    ClientWorld world;
    world.applySnapshot(makeSnapshot(1, {makeEntity(1, game::EntityType::Bink, 0, 0)}));
    world.applySnapshot(makeSnapshot(2, {makeEntity(1, game::EntityType::Bink, 100, 0)}));
    // Half of the time between two snapshots: half of the way.
    world.update(1.0f / 60.0f);
    EXPECT_NEAR(world.getEntities().at(1).x, 50.0f, 0.01f);
    world.update(1.0f / 60.0f);
    EXPECT_NEAR(world.getEntities().at(1).x, 100.0f, 0.01f);
}

TEST(ClientWorld, OurShipIsInterpolatedLikeTheOthers)
{
    ClientWorld world;
    world.setLocalPlayer(0);
    world.applySnapshot(makeSnapshot(1, {makeEntity(7, game::EntityType::Ship, 100, 100, 0)}));
    world.applySnapshot(makeSnapshot(2, {makeEntity(7, game::EntityType::Ship, 200, 100, 0)}));
    world.update(1.0f / 60.0f);
    EXPECT_NEAR(world.getEntities().at(7).x, 150.0f, 0.01f);
}

TEST(ClientWorld, DetectsWhenOurShipIsDestroyed)
{
    ClientWorld world;
    world.setLocalPlayer(1);
    world.applySnapshot(makeSnapshot(1, {makeEntity(3, game::EntityType::Ship, 10, 10, 1),
                                         makeEntity(4, game::EntityType::Ship, 50, 50, 0)}));
    const WorldChanges changes =
        world.applySnapshot(makeSnapshot(2, {makeEntity(4, game::EntityType::Ship, 50, 50, 0)}));
    EXPECT_TRUE(changes.localShipDestroyed);
}

TEST(ClientWorld, CountsNewShotsAndExplosionsForTheSounds)
{
    ClientWorld world;
    const WorldChanges changes =
        world.applySnapshot(makeSnapshot(1, {makeEntity(1, game::EntityType::PlayerBullet, 0, 0),
                                             makeEntity(2, game::EntityType::Explosion, 0, 0)}));
    EXPECT_EQ(changes.newPlayerShots, 1);
    EXPECT_EQ(changes.newExplosions, 1);
}

TEST(ClientWorld, InterpolatesAtTheSnapshotRateOfTheServer)
{
    ClientWorld world;
    world.setSnapshotRate(20); // r-type_server sends 20 snapshots per second
    world.applySnapshot(makeSnapshot(1, {makeEntity(1, game::EntityType::Bink, 0, 0)}));
    world.applySnapshot(makeSnapshot(2, {makeEntity(1, game::EntityType::Bink, 90, 0)}));
    // 1/60 s is a third of the 1/20 s between two snapshots: a third of the way.
    world.update(1.0f / 60.0f);
    EXPECT_NEAR(world.getEntities().at(1).x, 30.0f, 0.01f);
}

namespace {

EntityInfo makeBoss(int hp, int phase)
{
    EntityInfo boss = makeEntity(50, game::EntityType::Boss, 800, 270);
    boss.hp = hp;
    boss.extra = phase;
    return boss;
}

EntityInfo makePickup(std::uint32_t id, game::PickupKind kind, float x)
{
    EntityInfo pickup = makeEntity(id, game::EntityType::PickupEnt, x, 100);
    pickup.extra = static_cast<int>(kind);
    return pickup;
}

} // namespace

TEST(ClientWorld, FollowsTheLifeOfTheBoss)
{
    ClientWorld world;
    EXPECT_EQ(world.getBoss(), nullptr);

    WorldChanges changes = world.applySnapshot(makeSnapshot(1, {makeBoss(120, 1)}));
    EXPECT_TRUE(changes.bossAppeared);
    ASSERT_NE(world.getBoss(), nullptr);
    EXPECT_EQ(world.getBoss()->maxHp, 120);

    changes = world.applySnapshot(makeSnapshot(2, {makeBoss(100, 1)}));
    EXPECT_TRUE(changes.bossHit);
    EXPECT_FALSE(changes.bossEnraged);
    EXPECT_EQ(world.getBoss()->hp, 100);
    EXPECT_EQ(world.getBoss()->maxHp, 120); // the bar is 100 / 120

    changes = world.applySnapshot(makeSnapshot(3, {makeBoss(60, 2)}));
    EXPECT_TRUE(changes.bossEnraged);

    changes = world.applySnapshot(makeSnapshot(4, {}));
    EXPECT_TRUE(changes.bossDestroyed);
    EXPECT_EQ(world.getBoss(), nullptr);
}

TEST(ClientWorld, CountsTheBonusesTakenNotTheOnesThatLeaveTheScreen)
{
    ClientWorld world;
    world.applySnapshot(makeSnapshot(1, {makePickup(1, game::PickupKind::Power, 300),
                                         makePickup(2, game::PickupKind::Speed, 400),
                                         makePickup(3, game::PickupKind::Speed, -70)}));
    const WorldChanges changes = world.applySnapshot(makeSnapshot(2, {}));
    EXPECT_EQ(changes.powerPickups, 1);
    EXPECT_EQ(changes.speedPickups, 1); // number 3 left the screen on the left
}

TEST(ClientWorld, GivesANewEnemyAndExplosionToPlaceTheirSounds)
{
    ClientWorld world;
    WorldChanges changes = world.applySnapshot(makeSnapshot(1, {}));
    EXPECT_EQ(changes.newEnemy, 0U);
    changes = world.applySnapshot(
        makeSnapshot(2, {makeEntity(4, game::EntityType::Bink, 900.0f, 100.0f),
                         makeEntity(5, game::EntityType::Explosion, 300.0f, 200.0f)}));
    EXPECT_EQ(changes.newEnemy, 4U);
    EXPECT_EQ(changes.newExplosion, 5U);
    // Already known: no new sound.
    changes = world.applySnapshot(
        makeSnapshot(3, {makeEntity(4, game::EntityType::Bink, 890.0f, 100.0f)}));
    EXPECT_EQ(changes.newEnemy, 0U);
}
