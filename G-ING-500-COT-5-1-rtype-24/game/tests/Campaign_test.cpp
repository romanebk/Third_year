#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/snapshot.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <gtest/gtest.h>
#include <stdexcept>
#include <vector>

using namespace game_test;

namespace {

int countOf(const std::vector<SpawnEvent> &events, EnemyType type)
{
    return static_cast<int>(std::count_if(events.begin(), events.end(),
                                          [&](const SpawnEvent &e) { return e.type == type; }));
}

float lastTime(const std::vector<SpawnEvent> &events)
{
    float last = 0.0f;
    for (const SpawnEvent &event : events) {
        last = std::max(last, event.time);
    }
    return last;
}

// Pretends the player cleared the level that is loaded: every event is spawned
// and no enemy is left.
void clearCurrentLevel(TestWorld &w)
{
    forEach<LevelRun>(w.registry, [](Entity, LevelRun &run) { run.next = run.events.size(); });
    std::vector<Entity> enemies;
    forEach<Enemy>(w.registry, [&](Entity e, Enemy &) { enemies.push_back(e); });
    for (const Entity e : enemies) {
        w.registry.killEntity(e);
    }
}

const Campaign &campaignOf(TestWorld &w)
{
    const Campaign *found = nullptr;
    forEach<Campaign>(w.registry, [&](Entity, Campaign &c) { found = &c; });
    return *found;
}

std::size_t loadedEventCount(TestWorld &w)
{
    std::size_t n = 0;
    forEach<LevelRun>(w.registry, [&](Entity, LevelRun &run) { n = run.events.size(); });
    return n;
}

int countEnemies(TestWorld &w)
{
    int n = 0;
    forEach<Enemy>(w.registry, [&](Entity, Enemy &) { ++n; });
    return n;
}

} // namespace

// --- the list of levels ------------------------------------------------

TEST(Levels, TheGameHasTwoLevelsWithTheirOwnName)
{
    EXPECT_EQ(levelCount(), 2);
    EXPECT_STRNE(levelName(0), levelName(1));
}

TEST(Levels, LevelEventsReturnTheRightTimeline)
{
    const auto first = levelEvents(0);
    const auto second = levelEvents(1);

    ASSERT_EQ(first.size(), level1().size());
    ASSERT_EQ(second.size(), level2().size());
    EXPECT_NE(first.size(), second.size());
}

TEST(Levels, AnUnknownLevelIsRejected)
{
    EXPECT_THROW(levelEvents(-1), std::out_of_range);
    EXPECT_THROW(levelEvents(2), std::out_of_range);
    EXPECT_THROW(levelName(2), std::out_of_range);
}

// --- level 2 -----------------------------------------------------------

TEST(Level2, EveryEnemyAppearsInsideTheArenaWithRoomForASine)
{
    for (const SpawnEvent &event : level2()) {
        EXPECT_GE(event.time, 0.0f);
        EXPECT_GE(event.y, 60.0f);
        EXPECT_LE(event.y, kArenaHeight - 60.0f);
    }
}

TEST(Level2, EndsWithASingleBoss)
{
    const auto events = level2();

    EXPECT_EQ(countOf(events, EnemyType::Boss), 1);
    const auto boss = std::find_if(events.begin(), events.end(),
                                   [](const SpawnEvent &e) { return e.type == EnemyType::Boss; });
    ASSERT_NE(boss, events.end());
    EXPECT_FLOAT_EQ(boss->time, lastTime(events));
}

TEST(Level2, IsLongerAndBusierThanLevelOne)
{
    const auto one = level1();
    const auto two = level2();

    EXPECT_GT(lastTime(two), lastTime(one));
    EXPECT_GT(two.size(), one.size());
    EXPECT_GT(countOf(two, EnemyType::Turret), countOf(one, EnemyType::Turret));
    EXPECT_GT(countOf(two, EnemyType::Patapata), countOf(one, EnemyType::Patapata));
}

TEST(Level2, HasTurretsAsWallsAtTheTopAndTheBottom)
{
    const auto events = level2();
    const auto turretAt = [&](float y) {
        return std::any_of(events.begin(), events.end(), [&](const SpawnEvent &e) {
            return e.type == EnemyType::Turret && e.y == y;
        });
    };

    EXPECT_TRUE(turretAt(60.0f));
    EXPECT_TRUE(turretAt(kArenaHeight - 60.0f));
}

TEST(Level2, UsesEveryEnemyKind)
{
    const auto events = level2();

    EXPECT_GT(countOf(events, EnemyType::Bink), 0);
    EXPECT_GT(countOf(events, EnemyType::Patapata), 0);
    EXPECT_GT(countOf(events, EnemyType::Turret), 0);
    EXPECT_GT(countOf(events, EnemyType::Carrier), 0);
}

// --- starting a campaign -----------------------------------------------

TEST(Campaign, StartsAtLevelOneWithItsTimelineLoaded)
{
    TestWorld w;

    startCampaign(w.registry);

    EXPECT_EQ(campaignOf(w).current, 0);
    EXPECT_EQ(campaignOf(w).count, levelCount());
    EXPECT_FALSE(campaignOf(w).clearing);
    EXPECT_EQ(currentStage(w.registry), 1);
    EXPECT_EQ(loadedEventCount(w), level1().size());
    EXPECT_FALSE(isLevelCleared(w.registry));
}

TEST(Campaign, StartingAgainReplacesThePreviousOne)
{
    TestWorld w;
    startCampaign(w.registry);
    startCampaign(w.registry);

    int campaigns = 0;
    int runs = 0;
    forEach<Campaign>(w.registry, [&](Entity, Campaign &) { ++campaigns; });
    forEach<LevelRun>(w.registry, [&](Entity, LevelRun &) { ++runs; });
    EXPECT_EQ(campaigns, 1);
    EXPECT_EQ(runs, 1);
}

TEST(Campaign, WithoutOneARoomPlaysASingleLevelAsBefore)
{
    TestWorld w;
    loadLevel(w.registry, {{0.0f, EnemyType::Bink, 100.0f}});

    EXPECT_EQ(currentStage(w.registry), 1);
    EXPECT_FALSE(isCampaignCleared(w.registry));
    campaignSystem(w.registry, 10.0f); // nothing to do

    forEach<LevelRun>(w.registry, [](Entity, LevelRun &run) { run.next = run.events.size(); });
    EXPECT_TRUE(isCampaignCleared(w.registry)); // same as isLevelCleared
}

// --- moving from one level to the next ---------------------------------

TEST(Campaign, DoesNothingWhileTheLevelIsNotCleared)
{
    TestWorld w;
    startCampaign(w.registry);

    campaignSystem(w.registry, 100.0f);

    EXPECT_FALSE(campaignOf(w).clearing);
    EXPECT_EQ(campaignOf(w).current, 0);
}

TEST(Campaign, ClearingTheFirstLevelWaitsThenLoadsTheSecond)
{
    TestWorld w;
    startCampaign(w.registry);
    clearCurrentLevel(w);

    campaignSystem(w.registry, 0.5f);
    EXPECT_TRUE(campaignOf(w).clearing);
    EXPECT_EQ(campaignOf(w).current, 0);
    EXPECT_EQ(roomState(w.registry), RoomState::Playing); // not won: a level follows

    campaignSystem(w.registry, kStageClearDelay - 1.0f);
    EXPECT_EQ(campaignOf(w).current, 0); // still waiting

    campaignSystem(w.registry, 1.0f);
    EXPECT_FALSE(campaignOf(w).clearing);
    EXPECT_EQ(campaignOf(w).current, 1);
    EXPECT_EQ(currentStage(w.registry), 2);
    EXPECT_EQ(loadedEventCount(w), level2().size());
    EXPECT_FALSE(isLevelCleared(w.registry)); // the new level has to be played
    EXPECT_EQ(roomState(w.registry), RoomState::Playing);
}

TEST(Campaign, ClearingTheLastLevelWinsTheGame)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    startCampaign(w.registry);
    clearCurrentLevel(w);
    campaignSystem(w.registry, 0.1f);
    campaignSystem(w.registry, kStageClearDelay);
    ASSERT_EQ(currentStage(w.registry), 2);

    clearCurrentLevel(w);

    EXPECT_TRUE(isCampaignCleared(w.registry));
    EXPECT_EQ(roomState(w.registry), RoomState::Victory);
    campaignSystem(w.registry, 100.0f); // no third level
    EXPECT_EQ(currentStage(w.registry), 2);
    EXPECT_FALSE(campaignOf(w).clearing);
}

TEST(Campaign, PlayersKeepTheirScoreLivesAndUpgradesAcrossLevels)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    Player &player = *w.registry.getComponent<Player>(ship);
    player.score = 4200;
    player.lives = 2;
    w.registry.getComponent<Weapon>(ship)->level = 2;
    w.registry.getComponent<PowerState>(ship)->speedLevel = 1;
    startCampaign(w.registry);
    clearCurrentLevel(w);

    campaignSystem(w.registry, 0.1f);
    campaignSystem(w.registry, kStageClearDelay);

    ASSERT_EQ(currentStage(w.registry), 2);
    EXPECT_EQ(player.score, 4200);
    EXPECT_EQ(player.lives, 2);
    EXPECT_EQ(w.registry.getComponent<Weapon>(ship)->level, 2);
    EXPECT_EQ(w.registry.getComponent<PowerState>(ship)->speedLevel, 1);
    EXPECT_TRUE(player.alive);
}

TEST(Campaign, ZeroDtChangesNothing)
{
    TestWorld w;
    startCampaign(w.registry);
    clearCurrentLevel(w);

    campaignSystem(w.registry, 0.0f);

    EXPECT_FALSE(campaignOf(w).clearing);
}

// --- inside the game loop ----------------------------------------------

TEST(Campaign, StepGameMovesToLevelTwoAndItsEnemiesAppear)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    startCampaign(w.registry);
    clearCurrentLevel(w);

    // the pause between the levels: no enemy yet
    for (int i = 0; i < 60 * 3; ++i) {
        stepGame(w.registry, kTickDt);
    }
    EXPECT_EQ(currentStage(w.registry), 1);
    EXPECT_EQ(countEnemies(w), 0);

    for (int i = 0; i < 60 * 2; ++i) { // the pause ends at 4 s, level 2 starts
        stepGame(w.registry, kTickDt);
    }
    EXPECT_EQ(currentStage(w.registry), 2);

    for (int i = 0; i < 60 * 3; ++i) { // the first turrets of level 2 (t = 2 s)
        stepGame(w.registry, kTickDt);
    }
    EXPECT_GE(countEnemies(w), 2);
}

// --- network -----------------------------------------------------------

TEST(Campaign, TheSnapshotTellsTheStage)
{
    TestWorld w;
    EXPECT_EQ(collectSnapshot(w.registry).stage, 1); // no campaign

    startCampaign(w.registry);
    EXPECT_EQ(collectSnapshot(w.registry).stage, 1);

    clearCurrentLevel(w);
    campaignSystem(w.registry, 0.1f);
    campaignSystem(w.registry, kStageClearDelay);
    EXPECT_EQ(collectSnapshot(w.registry).stage, 2);
}

// --- load ----------------------------------------------------------------

namespace {

// Plays a whole level with a ship that only taps fire, and returns the largest
// number of entities a snapshot would carry (no cap), to size kMaxSnapshotEntities.
std::size_t peakEntities(int levelIndex)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 1);
    loadLevel(w.registry, levelEvents(levelIndex));
    Input &input = *w.registry.getComponent<Input>(ship);
    std::size_t peak = 0;
    for (int tick = 0; tick < 60 * 110; ++tick) {
        input.fire = (tick % 12) < 2;
        stepGame(w.registry, kTickDt);
        peak = std::max(peak, collectSnapshot(w.registry, 100000).entities.size());
    }
    return peak;
}

} // namespace

TEST(Levels, ASnapshotOfASingleShipNeverNeedsMoreEntitiesThanTheCapAllows)
{
    // With one ship the peak is about 30 entities; the cap (73) leaves room for
    // several ships and their upgraded weapons.
    EXPECT_LE(peakEntities(0), kMaxSnapshotEntities);
    EXPECT_LE(peakEntities(1), kMaxSnapshotEntities);
}
