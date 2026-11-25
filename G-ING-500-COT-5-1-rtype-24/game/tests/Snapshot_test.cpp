#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/snapshot.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <gtest/gtest.h>
#include <set>
#include <vector>

using namespace game_test;

namespace {

const SnapshotEntity *find(const Snapshot &snapshot, EntityType type)
{
    for (const SnapshotEntity &entity : snapshot.entities) {
        if (entity.type == type) {
            return &entity;
        }
    }
    return nullptr;
}

std::size_t count(const Snapshot &snapshot, EntityType type)
{
    return static_cast<std::size_t>(
        std::count_if(snapshot.entities.begin(), snapshot.entities.end(),
                      [&](const SnapshotEntity &e) { return e.type == type; }));
}

void addExplosion(TestWorld &w, float x, float y)
{
    const Entity e = w.registry.spawnEntity();
    w.registry.emplaceComponent<Position>(e, x, y);
    w.registry.addComponent(e, EntityType::Explosion);
}

} // namespace

// --- net ids -----------------------------------------------------------

TEST(NetIds, EveryReplicatedEntityGetsAUniqueNonZeroId)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    spawnEnemy(w.registry, EnemyType::Turret, 600.0f, 100.0f);

    const Snapshot snapshot = collectSnapshot(w.registry);

    ASSERT_EQ(snapshot.entities.size(), 3u);
    std::set<std::uint16_t> ids;
    for (const SnapshotEntity &entity : snapshot.entities) {
        EXPECT_NE(entity.netId, 0);
        ids.insert(entity.netId);
    }
    EXPECT_EQ(ids.size(), 3u);
}

TEST(NetIds, AnEntityKeepsItsIdFromOneSnapshotToTheNext)
{
    TestWorld w;
    const Entity enemy = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    const std::uint16_t first = collectSnapshot(w.registry).entities.at(0).netId;

    w.pos(enemy).x = 400.0f;
    spawnEnemy(w.registry, EnemyType::Patapata, 700.0f, 200.0f);
    const Snapshot second = collectSnapshot(w.registry);

    EXPECT_EQ(w.registry.getComponent<NetId>(enemy)->value, first);
    const auto it = std::find_if(second.entities.begin(), second.entities.end(),
                                 [&](const SnapshotEntity &e) { return e.netId == first; });
    ASSERT_NE(it, second.entities.end());
    EXPECT_FLOAT_EQ(it->x, 400.0f);
}

TEST(NetIds, AnIdIsNotReusedAfterItsEntityDies)
{
    TestWorld w;
    const Entity first = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    assignNetIds(w.registry);
    const std::uint16_t oldId = w.registry.getComponent<NetId>(first)->value;
    w.registry.killEntity(first);

    const Entity second = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    assignNetIds(w.registry);

    EXPECT_NE(w.registry.getComponent<NetId>(second)->value, oldId);
}

TEST(NetIds, ACounterThatWrapsSkipsZeroAndTheIdsInUse)
{
    TestWorld w;
    const Entity a = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    assignNetIds(w.registry); // a gets 1
    ASSERT_EQ(w.registry.getComponent<NetId>(a)->value, 1);
    forEach<NetIdAllocator>(w.registry,
                            [](Entity, NetIdAllocator &allocator) { allocator.next = 65535; });

    const Entity b = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    const Entity c = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    assignNetIds(w.registry);

    EXPECT_EQ(w.registry.getComponent<NetId>(b)->value, 65535);
    // wraps to 1, which is in use by `a`, so it goes on to 2
    EXPECT_EQ(w.registry.getComponent<NetId>(c)->value, 2);
}

TEST(NetIds, EntitiesThatAreNotReplicatedDoNotGetOne)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    loadLevel(w.registry, {}); // the level director has no EntityType

    collectSnapshot(w.registry);

    int withNetId = 0;
    int withoutNetId = 0;
    forEach<LevelRun>(w.registry, [&](Entity e, LevelRun &) {
        (w.registry.hasComponent<NetId>(e) ? withNetId : withoutNetId) += 1;
    });
    EXPECT_EQ(withNetId, 0);
    EXPECT_EQ(withoutNetId, 1);
}

TEST(NetIds, AShipKeepsItsIdWhenItDiesAndRespawns)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    const std::uint16_t id = collectSnapshot(w.registry).entities.at(0).netId;

    w.registry.getComponent<Player>(ship)->alive = false;
    EXPECT_TRUE(collectSnapshot(w.registry).entities.empty());
    w.registry.getComponent<Player>(ship)->alive = true;

    EXPECT_EQ(collectSnapshot(w.registry).entities.at(0).netId, id);
}

// --- entity fields -----------------------------------------------------

TEST(Snapshot, ShipFieldsMatchTheRfcRecord)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 2);
    w.pos(ship) = Position{123.5f, 234.5f};
    w.registry.getComponent<Player>(ship)->lives = 2;

    const Snapshot snapshot = collectSnapshot(w.registry);

    ASSERT_EQ(snapshot.entities.size(), 1u);
    const SnapshotEntity &entity = snapshot.entities[0];
    EXPECT_EQ(entity.type, EntityType::Ship);
    EXPECT_EQ(entity.team, Team::P2);
    EXPECT_FLOAT_EQ(entity.x, 123.5f);
    EXPECT_FLOAT_EQ(entity.y, 234.5f);
    EXPECT_EQ(entity.hp, 1);
    EXPECT_EQ(entity.extra, 2); // lives
}

TEST(Snapshot, EnemyAndShotFields)
{
    TestWorld w;
    spawnEnemy(w.registry, EnemyType::Turret, 500.0f, 60.0f);
    const Entity shot = w.shot(Team::EnemyShot, 300.0f, 100.0f);
    w.registry.addComponent(shot, EntityType::EnemyBullet);

    const Snapshot snapshot = collectSnapshot(w.registry);

    const SnapshotEntity *turret = find(snapshot, EntityType::Turret);
    ASSERT_NE(turret, nullptr);
    EXPECT_EQ(turret->team, Team::Enemy);
    EXPECT_EQ(turret->hp, kTurretHp);
    EXPECT_EQ(turret->extra, 0);
    const SnapshotEntity *bullet = find(snapshot, EntityType::EnemyBullet);
    ASSERT_NE(bullet, nullptr);
    EXPECT_EQ(bullet->team, Team::EnemyShot);
    EXPECT_EQ(bullet->hp, 0); // no Health
}

TEST(Snapshot, EnemyBulletExtraIsItsVisualVariant)
{
    TestWorld w;
    spawnEnemyBullet(w.registry, Position{300.0f, 100.0f}, Velocity{0.0f, 0.0f},
                     BulletVisual::Warship);

    const Snapshot snapshot = collectSnapshot(w.registry);

    const SnapshotEntity *bullet = find(snapshot, EntityType::EnemyBullet);
    ASSERT_NE(bullet, nullptr);
    EXPECT_EQ(bullet->extra, static_cast<std::uint8_t>(BulletVisual::Warship));
}

TEST(Snapshot, BossExtraIsItsPhase)
{
    TestWorld w;
    const Entity boss = spawnEnemy(w.registry, EnemyType::Boss, 800.0f, 270.0f);

    EXPECT_EQ(find(collectSnapshot(w.registry), EntityType::Boss)->extra, 1);
    EXPECT_EQ(find(collectSnapshot(w.registry), EntityType::Boss)->hp, kBossHp);

    w.registry.getComponent<BossState>(boss)->phase = 2;
    EXPECT_EQ(find(collectSnapshot(w.registry), EntityType::Boss)->extra, 2);
}

TEST(Snapshot, ForceExtraIsItsPower)
{
    TestWorld w;
    const Entity force = w.force(0, 100.0f, 100.0f);
    w.registry.addComponent(force, EntityType::Force);
    w.registry.getComponent<ForcePod>(force)->power = 3;

    const Snapshot snapshot = collectSnapshot(w.registry);
    const SnapshotEntity *entity = find(snapshot, EntityType::Force);

    ASSERT_NE(entity, nullptr);
    EXPECT_EQ(entity->extra, 3);
    EXPECT_EQ(entity->team, Team::Neutral);
}

TEST(Snapshot, HealthIsClampedToAByte)
{
    TestWorld w;
    const Entity boss = spawnEnemy(w.registry, EnemyType::Boss, 800.0f, 270.0f);
    w.registry.getComponent<Health>(boss)->hp = 1000;
    EXPECT_EQ(find(collectSnapshot(w.registry), EntityType::Boss)->hp, 255);

    w.registry.getComponent<Health>(boss)->hp = -4;
    EXPECT_EQ(find(collectSnapshot(w.registry), EntityType::Boss)->hp, 0);
}

TEST(Snapshot, ExplosionsAreReplicated)
{
    TestWorld w;
    addExplosion(w, 50.0f, 60.0f);

    const Snapshot snapshot = collectSnapshot(w.registry);
    const SnapshotEntity *entity = find(snapshot, EntityType::Explosion);

    ASSERT_NE(entity, nullptr);
    EXPECT_FLOAT_EQ(entity->x, 50.0f);
    EXPECT_EQ(entity->team, Team::Neutral); // no Team component
    EXPECT_EQ(entity->hp, 0);
}

TEST(Snapshot, EntitiesAreSortedByNetId)
{
    TestWorld w;
    for (int i = 0; i < 10; ++i) {
        spawnEnemy(w.registry, EnemyType::Bink, 500.0f + static_cast<float>(i), 100.0f);
    }

    const Snapshot snapshot = collectSnapshot(w.registry);

    EXPECT_TRUE(std::is_sorted(
        snapshot.entities.begin(), snapshot.entities.end(),
        [](const SnapshotEntity &a, const SnapshotEntity &b) { return a.netId < b.netId; }));
}

TEST(Snapshot, AnEmptyRoomGivesAnEmptySnapshot)
{
    TestWorld w;

    const Snapshot snapshot = collectSnapshot(w.registry);

    EXPECT_TRUE(snapshot.entities.empty());
    EXPECT_TRUE(snapshot.players.empty());
    EXPECT_EQ(snapshot.state, RoomState::Playing);
}

// --- players -----------------------------------------------------------

TEST(SnapshotPlayers, CarryTheHudOfEveryPlayerSortedById)
{
    TestWorld w;
    const Entity second = spawnPlayer(w.registry, 1);
    const Entity first = spawnPlayer(w.registry, 0);
    w.registry.getComponent<Player>(first)->score = 1200;
    w.registry.getComponent<Player>(second)->score = 300;
    w.registry.getComponent<Player>(second)->lives = 1;
    w.registry.getComponent<PowerState>(second)->speedLevel = 2;
    w.registry.getComponent<PowerState>(second)->hasMissile = true;

    const Snapshot snapshot = collectSnapshot(w.registry);

    ASSERT_EQ(snapshot.players.size(), 2u);
    EXPECT_EQ(snapshot.players[0].playerId, 0);
    EXPECT_EQ(snapshot.players[0].score, 1200);
    EXPECT_EQ(snapshot.players[0].lives, 3);
    EXPECT_TRUE(snapshot.players[0].alive);
    EXPECT_FALSE(snapshot.players[0].gameOver);
    EXPECT_EQ(snapshot.players[1].playerId, 1);
    EXPECT_EQ(snapshot.players[1].score, 300);
    EXPECT_EQ(snapshot.players[1].lives, 1);
    EXPECT_EQ(snapshot.players[1].speedLevel, 2);
    EXPECT_TRUE(snapshot.players[1].hasMissile);
    EXPECT_FALSE(snapshot.players[1].hasForce);
}

TEST(SnapshotPlayers, ADeadShipIsHiddenButItsHudIsKept)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    w.registry.getComponent<Player>(ship)->alive = false;
    w.registry.getComponent<Player>(ship)->lives = 1;

    const Snapshot snapshot = collectSnapshot(w.registry);

    EXPECT_EQ(count(snapshot, EntityType::Ship), 0u);
    ASSERT_EQ(snapshot.players.size(), 1u);
    EXPECT_FALSE(snapshot.players[0].alive);
    EXPECT_FALSE(snapshot.players[0].gameOver); // a respawn is coming
}

TEST(SnapshotPlayers, OutOfLivesMeansGameOverAndZeroLivesOnTheWire)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    w.registry.getComponent<Player>(ship)->alive = false;
    w.registry.getComponent<Player>(ship)->lives = -1;

    const Snapshot snapshot = collectSnapshot(w.registry);

    ASSERT_EQ(snapshot.players.size(), 1u);
    EXPECT_TRUE(snapshot.players[0].gameOver);
    EXPECT_EQ(snapshot.players[0].lives, 0);
}

TEST(SnapshotPlayers, TheForceOfAPlayerIsFlagged)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    spawnPlayer(w.registry, 1);
    w.force(1, 100.0f, 100.0f);

    const Snapshot snapshot = collectSnapshot(w.registry);

    EXPECT_FALSE(snapshot.players[0].hasForce);
    EXPECT_TRUE(snapshot.players[1].hasForce);
}

// --- room state --------------------------------------------------------

TEST(Snapshot, StateFollowsTheRoom)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    EXPECT_EQ(collectSnapshot(w.registry).state, RoomState::Playing);

    loadLevel(w.registry, {}); // nothing to spawn: cleared
    EXPECT_EQ(collectSnapshot(w.registry).state, RoomState::Victory);

    w.registry.getComponent<Player>(ship)->alive = false;
    w.registry.getComponent<Player>(ship)->lives = -1;
    EXPECT_EQ(collectSnapshot(w.registry).state, RoomState::Defeat);
}

// --- size limit --------------------------------------------------------

TEST(SnapshotLimit, TheDefaultCapKeepsADatagramUnderTheRfcLimit)
{
    // header 8 + fixed part 55 (HUD of 4 players) + 16 per entity must stay <= 1200 bytes
    EXPECT_LE(8 + 55 + 16 * kMaxSnapshotEntities, 1200u);
    EXPECT_GT(8 + 55 + 16 * (kMaxSnapshotEntities + 1), 1200u);
}

TEST(SnapshotLimit, TheMostImportantEntitiesSurviveTheCut)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    spawnEnemy(w.registry, EnemyType::Boss, 800.0f, 270.0f);
    for (int i = 0; i < 100; ++i) { // spawned after, so they get higher ids
        const Entity shot = w.shot(Team::PlayerShot, 100.0f + static_cast<float>(i), 50.0f);
        w.registry.addComponent(shot, EntityType::PlayerBullet);
    }
    addExplosion(w, 10.0f, 10.0f);

    const Snapshot snapshot = collectSnapshot(w.registry, 10);

    EXPECT_EQ(snapshot.entities.size(), 10u);
    EXPECT_EQ(count(snapshot, EntityType::Ship), 1u);
    EXPECT_EQ(count(snapshot, EntityType::Boss), 1u);
    EXPECT_EQ(count(snapshot, EntityType::PlayerBullet), 8u);
    EXPECT_EQ(count(snapshot, EntityType::Explosion), 0u); // least important
    EXPECT_TRUE(std::is_sorted(
        snapshot.entities.begin(), snapshot.entities.end(),
        [](const SnapshotEntity &a, const SnapshotEntity &b) { return a.netId < b.netId; }));
}

TEST(SnapshotLimit, NothingIsCutBelowTheCap)
{
    TestWorld w;
    for (int i = 0; i < 30; ++i) {
        spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    }

    EXPECT_EQ(collectSnapshot(w.registry).entities.size(), 30u);
}

TEST(SnapshotLimit, AZeroCapGivesNoEntityButStillTheState)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);

    const Snapshot snapshot = collectSnapshot(w.registry, 0);

    EXPECT_TRUE(snapshot.entities.empty());
    EXPECT_EQ(snapshot.players.size(), 1u);
}

// --- diff --------------------------------------------------------------

TEST(SnapshotDiff, ListsSpawnedAndDestroyedEntities)
{
    TestWorld w;
    const Entity stays = spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    const Entity dies = spawnEnemy(w.registry, EnemyType::Bink, 600.0f, 100.0f);
    const Snapshot before = collectSnapshot(w.registry);
    const std::uint16_t diesId = w.registry.getComponent<NetId>(dies)->value;

    w.registry.killEntity(dies);
    const Entity born = spawnEnemy(w.registry, EnemyType::Turret, 700.0f, 100.0f);
    const Snapshot after = collectSnapshot(w.registry);

    const SnapshotDiff diff = diffSnapshots(before, after);
    ASSERT_EQ(diff.spawned.size(), 1u);
    EXPECT_EQ(diff.spawned[0].netId, w.registry.getComponent<NetId>(born)->value);
    EXPECT_EQ(diff.spawned[0].type, EntityType::Turret);
    ASSERT_EQ(diff.destroyed.size(), 1u);
    EXPECT_EQ(diff.destroyed[0], diesId);
    EXPECT_TRUE(w.registry.isAlive(stays));
}

TEST(SnapshotDiff, TwoIdenticalSnapshotsHaveNoDifference)
{
    TestWorld w;
    spawnEnemy(w.registry, EnemyType::Bink, 500.0f, 100.0f);
    const Snapshot snapshot = collectSnapshot(w.registry);

    const SnapshotDiff diff = diffSnapshots(snapshot, collectSnapshot(w.registry));

    EXPECT_TRUE(diff.spawned.empty());
    EXPECT_TRUE(diff.destroyed.empty());
}
