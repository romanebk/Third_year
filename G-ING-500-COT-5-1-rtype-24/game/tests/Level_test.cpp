#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

int countEnemies(TestWorld &w)
{
    int n = 0;
    forEach<Enemy>(w.registry, [&](Entity, Enemy &) { ++n; });
    return n;
}

std::vector<Entity> enemiesOfType(TestWorld &w, EnemyType type)
{
    std::vector<Entity> found;
    forEach<Enemy>(w.registry, [&](Entity e, Enemy &enemy) {
        if (enemy.type == type) {
            found.push_back(e);
        }
    });
    return found;
}

} // namespace

// --- timeline helpers --------------------------------------------------

TEST(AddGroup, SpacesTheEnemiesByTheInterval)
{
    std::vector<SpawnEvent> events;

    addGroup(events, 2.0f, EnemyType::Bink, 270.0f, 3, 0.5f);

    ASSERT_EQ(events.size(), 3u);
    EXPECT_FLOAT_EQ(events[0].time, 2.0f);
    EXPECT_FLOAT_EQ(events[1].time, 2.5f);
    EXPECT_FLOAT_EQ(events[2].time, 3.0f);
    for (const SpawnEvent &event : events) {
        EXPECT_EQ(event.type, EnemyType::Bink);
        EXPECT_FLOAT_EQ(event.y, 270.0f);
    }
}

TEST(Level1, IsASaneTimeline)
{
    const auto events = level1();

    ASSERT_FALSE(events.empty());
    bool hasTurret = false;
    for (const SpawnEvent &event : events) {
        EXPECT_GE(event.time, 0.0f);
        // a Patapata swings 60 units around its row: keep it inside the arena
        EXPECT_GE(event.y, 60.0f);
        EXPECT_LE(event.y, kArenaHeight - 60.0f);
        hasTurret = hasTurret || event.type == EnemyType::Turret;
    }
    EXPECT_TRUE(hasTurret);
}

// --- loading -----------------------------------------------------------

TEST(LoadLevel, SortsTheEventsByTime)
{
    TestWorld w;
    std::vector<SpawnEvent> events = {{5.0f, EnemyType::Carrier, 100.0f},
                                      {1.0f, EnemyType::Bink, 200.0f},
                                      {3.0f, EnemyType::Turret, 300.0f}};

    const Entity director = loadLevel(w.registry, events);

    const auto *run = w.registry.getComponent<LevelRun>(director);
    ASSERT_NE(run, nullptr);
    ASSERT_EQ(run->events.size(), 3u);
    EXPECT_EQ(run->events[0].type, EnemyType::Bink);
    EXPECT_EQ(run->events[1].type, EnemyType::Turret);
    EXPECT_EQ(run->events[2].type, EnemyType::Carrier);
    EXPECT_FLOAT_EQ(run->time, 0.0f);
    EXPECT_EQ(run->next, 0u);
}

TEST(LoadLevel, ReplacesThePreviousLevel)
{
    TestWorld w;
    const Entity first = loadLevel(w.registry, {{1.0f, EnemyType::Bink, 100.0f}});

    const Entity second = loadLevel(w.registry, {{2.0f, EnemyType::Turret, 100.0f}});

    EXPECT_FALSE(w.registry.isAlive(first));
    EXPECT_TRUE(w.registry.isAlive(second));
    int runs = 0;
    forEach<LevelRun>(w.registry, [&](Entity, LevelRun &) { ++runs; });
    EXPECT_EQ(runs, 1);
}

// --- spawning ----------------------------------------------------------

TEST(Waves, SpawnsEachEnemyWhenItsTimeComes)
{
    TestWorld w;
    loadLevel(w.registry, {{1.0f, EnemyType::Bink, 100.0f}, {2.0f, EnemyType::Turret, 400.0f}});

    wavesSystem(w.registry, 0.5f); // t = 0.5
    EXPECT_EQ(countEnemies(w), 0);

    wavesSystem(w.registry, 0.5f); // t = 1.0: the Bink is due
    EXPECT_EQ(countEnemies(w), 1);

    wavesSystem(w.registry, 0.5f); // t = 1.5
    EXPECT_EQ(countEnemies(w), 1);

    wavesSystem(w.registry, 0.5f); // t = 2.0: the Turret is due
    EXPECT_EQ(countEnemies(w), 2);

    wavesSystem(w.registry, 5.0f); // nothing left to spawn
    EXPECT_EQ(countEnemies(w), 2);
}

TEST(Waves, EnemiesAppearJustRightOfTheArenaAtTheRequestedHeight)
{
    TestWorld w;
    loadLevel(w.registry, {{0.0f, EnemyType::Bink, 123.0f}});

    wavesSystem(w.registry, 0.25f);

    const auto binks = enemiesOfType(w, EnemyType::Bink);
    ASSERT_EQ(binks.size(), 1u);
    EXPECT_FLOAT_EQ(w.pos(binks[0]).x, kArenaWidth + kEnemySpawnMargin);
    EXPECT_FLOAT_EQ(w.pos(binks[0]).y, 123.0f);
    // the spawn point is outside the arena but inside the cull margin
    EXPECT_LT(kEnemySpawnMargin, kCullMargin);
}

TEST(Waves, SeveralDueEventsSpawnInTheSameTick)
{
    TestWorld w;
    loadLevel(w.registry, {{1.0f, EnemyType::Bink, 100.0f},
                           {1.0f, EnemyType::Bink, 200.0f},
                           {1.5f, EnemyType::Bink, 300.0f}});

    wavesSystem(w.registry, 2.0f);

    EXPECT_EQ(countEnemies(w), 3);
}

TEST(Waves, EnemyHealthScalesWithThePlayersInTheRoom)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    spawnPlayer(w.registry, 1);
    loadLevel(w.registry, {{0.0f, EnemyType::Turret, 270.0f}});

    wavesSystem(w.registry, 0.25f);

    const auto turrets = enemiesOfType(w, EnemyType::Turret);
    ASSERT_EQ(turrets.size(), 1u);
    EXPECT_EQ(w.registry.getComponent<Health>(turrets[0])->hp, 4); // 3 * 1.25 -> 4
}

TEST(Waves, DoNothingWithoutALevelOrWithZeroDt)
{
    TestWorld w;

    wavesSystem(w.registry, 1.0f);
    EXPECT_EQ(countEnemies(w), 0);

    loadLevel(w.registry, {{0.0f, EnemyType::Bink, 100.0f}});
    wavesSystem(w.registry, 0.0f);
    EXPECT_EQ(countEnemies(w), 0);
}

// --- end of level ------------------------------------------------------

TEST(LevelCleared, NeedsAllEventsSpawnedAndNoEnemyLeft)
{
    TestWorld w;
    EXPECT_FALSE(isLevelCleared(w.registry)); // no level loaded

    loadLevel(w.registry, {{1.0f, EnemyType::Bink, 100.0f}});
    EXPECT_FALSE(isLevelCleared(w.registry)); // nothing spawned yet

    wavesSystem(w.registry, 1.0f);
    EXPECT_FALSE(isLevelCleared(w.registry)); // spawned, still alive

    const auto binks = enemiesOfType(w, EnemyType::Bink);
    ASSERT_EQ(binks.size(), 1u);
    w.registry.killEntity(binks[0]);
    EXPECT_TRUE(isLevelCleared(w.registry));
}
