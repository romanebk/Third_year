#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/endless.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/rules.hpp"
#include "game/snapshot.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

int countOf(const std::vector<SpawnEvent> &events, EnemyType type)
{
    return static_cast<int>(std::count_if(events.begin(), events.end(),
                                          [&](const SpawnEvent &e) { return e.type == type; }));
}

// A room that plays the endless mode, with one ship.
void startEndless(TestWorld &w, Difficulty difficulty = Difficulty::Normal)
{
    Rules rules = rulesFor(difficulty);
    rules.mode = GameMode::Endless;
    setRules(w.registry, rules);
    startCampaign(w.registry);
}

// Pretends the player cleared the wave that is loaded.
void clearCurrentWave(TestWorld &w)
{
    forEach<LevelRun>(w.registry, [](Entity, LevelRun &run) { run.next = run.events.size(); });
    std::vector<Entity> enemies;
    forEach<Enemy>(w.registry, [&](Entity e, Enemy &) { enemies.push_back(e); });
    for (const Entity e : enemies) {
        w.registry.killEntity(e);
    }
}

int currentWave(TestWorld &w)
{
    int wave = -1;
    forEach<Campaign>(w.registry, [&](Entity, Campaign &c) { wave = c.current; });
    return wave;
}

std::size_t loadedEventCount(TestWorld &w)
{
    std::size_t n = 0;
    forEach<LevelRun>(w.registry, [&](Entity, LevelRun &run) { n = run.events.size(); });
    return n;
}

} // namespace

// --- the mode setting ---------------------------------------------------

TEST(GameMode, ParsesTheNamesInAnyCase)
{
    EXPECT_EQ(parseMode("campaign"), GameMode::Campaign);
    EXPECT_EQ(parseMode("ENDLESS"), GameMode::Endless);
    EXPECT_EQ(parseMode("Endless"), GameMode::Endless);
    EXPECT_FALSE(parseMode("versus").has_value());
    EXPECT_FALSE(parseMode("").has_value());
}

TEST(GameMode, NamesAreTheOnesTheParserAccepts)
{
    EXPECT_STREQ(modeName(GameMode::Campaign), "campaign");
    EXPECT_STREQ(modeName(GameMode::Endless), "endless");
    EXPECT_EQ(parseMode(modeName(GameMode::Endless)), GameMode::Endless);
}

TEST(GameMode, TheDefaultRulesPlayTheCampaign)
{
    EXPECT_EQ(rulesFor(Difficulty::Easy).mode, GameMode::Campaign);
    EXPECT_EQ(rulesFor(Difficulty::Hard).mode, GameMode::Campaign);
    TestWorld w;
    EXPECT_EQ(rulesOf(w.registry).mode, GameMode::Campaign);
}

TEST(GameMode, TheModeOfTheRoomIsKeptWithItsRules)
{
    TestWorld w;
    startEndless(w, Difficulty::Hard);

    EXPECT_EQ(rulesOf(w.registry).mode, GameMode::Endless);
    EXPECT_EQ(rulesOf(w.registry).difficulty, Difficulty::Hard);
}

// --- the waves ------------------------------------------------------------

TEST(EndlessWave, EveryEnemyAppearsInsideTheArenaWithRoomForASine)
{
    for (int wave = 0; wave < 60; ++wave) {
        for (const SpawnEvent &event : endlessWave(wave)) {
            EXPECT_GE(event.time, 0.0f) << "wave " << wave;
            EXPECT_GE(event.y, 60.0f) << "wave " << wave;
            EXPECT_LE(event.y, kArenaHeight - 60.0f) << "wave " << wave;
        }
    }
}

TEST(EndlessWave, IsTheSameEveryTime)
{
    for (int wave : {0, 1, 7, 30}) {
        const auto a = endlessWave(wave);
        const auto b = endlessWave(wave);
        ASSERT_EQ(a.size(), b.size());
        for (std::size_t i = 0; i < a.size(); ++i) {
            EXPECT_EQ(a[i].type, b[i].type);
            EXPECT_FLOAT_EQ(a[i].time, b[i].time);
            EXPECT_FLOAT_EQ(a[i].y, b[i].y);
        }
    }
}

TEST(EndlessWave, ANegativeWaveCountsAsTheFirst)
{
    EXPECT_EQ(endlessWave(-3).size(), endlessWave(0).size());
}

TEST(EndlessWave, GetsBiggerWithTheWaves)
{
    EXPECT_GT(endlessWave(8).size(), endlessWave(0).size());
    EXPECT_GT(countOf(endlessWave(8), EnemyType::Bink), countOf(endlessWave(0), EnemyType::Bink));
}

TEST(EndlessWave, NeverHasMoreThanTheMaximumInAGroup)
{
    for (int wave : {0, 20, 100, 1000}) {
        const auto events = endlessWave(wave);
        EXPECT_LE(countOf(events, EnemyType::Patapata), kEndlessMaxGroup);
        EXPECT_LE(countOf(events, EnemyType::Bink), 2 * kEndlessMaxGroup);
    }
}

TEST(EndlessWave, TurretsAppearFromTheThirdWave)
{
    EXPECT_EQ(countOf(endlessWave(0), EnemyType::Turret), 0);
    EXPECT_EQ(countOf(endlessWave(1), EnemyType::Turret), 0);
    EXPECT_GT(countOf(endlessWave(2), EnemyType::Turret), 0);
}

TEST(EndlessWave, EveryWaveHasACarrierThatDropsABonus)
{
    for (int wave = 0; wave < 20; ++wave) {
        EXPECT_GE(countOf(endlessWave(wave), EnemyType::Carrier), 1) << "wave " << wave;
    }
}

TEST(EndlessWave, ABossComesEveryFifthWave)
{
    for (int wave = 0; wave < 30; ++wave) {
        const int bosses = countOf(endlessWave(wave), EnemyType::Boss);
        if (wave % 5 == 4) {
            EXPECT_EQ(bosses, 1) << "wave " << wave;
            EXPECT_TRUE(isEndlessBossWave(wave));
        } else {
            EXPECT_EQ(bosses, 0) << "wave " << wave;
            EXPECT_FALSE(isEndlessBossWave(wave));
        }
    }
}

TEST(EndlessWave, TheBossComesAfterTheOtherEnemies)
{
    const auto events = endlessWave(4);
    float lastOther = 0.0f;
    float bossTime = 0.0f;
    for (const SpawnEvent &event : events) {
        if (event.type == EnemyType::Boss) {
            bossTime = event.time;
        } else {
            lastOther = std::max(lastOther, event.time);
        }
    }
    EXPECT_GT(bossTime, lastOther);
}

TEST(EndlessWave, HitPointsGrowByTenPercentPerWaveUpToTheLimit)
{
    EXPECT_FLOAT_EQ(endlessHpScale(0), 1.0f);
    EXPECT_FLOAT_EQ(endlessHpScale(5), 1.5f);
    EXPECT_FLOAT_EQ(endlessHpScale(1000), kEndlessMaxHpScale);
    EXPECT_FLOAT_EQ(endlessHpScale(-4), 1.0f);
}

// --- playing the endless mode --------------------------------------------

TEST(Endless, StartsWithTheFirstWaveLoaded)
{
    TestWorld w;
    startEndless(w);

    EXPECT_EQ(currentWave(w), 0);
    EXPECT_EQ(loadedEventCount(w), endlessWave(0).size());
    EXPECT_EQ(currentStage(w.registry), 1);
}

TEST(Endless, ClearingAWaveWaitsThenLoadsTheNextOne)
{
    TestWorld w;
    startEndless(w);
    clearCurrentWave(w);

    stepGame(w.registry, kTickDt); // the wave is seen as cleared: the pause begins
    EXPECT_EQ(currentWave(w), 0);

    for (float t = 0.0f; t < kEndlessWaveDelay + 0.5f; t += kTickDt) {
        stepGame(w.registry, kTickDt);
    }
    EXPECT_EQ(currentWave(w), 1);
    EXPECT_EQ(currentStage(w.registry), 2);
    EXPECT_EQ(loadedEventCount(w), endlessWave(1).size());
}

TEST(Endless, ThePauseIsShorterThanBetweenTwoLevelsOfTheCampaign)
{
    EXPECT_LT(kEndlessWaveDelay, kStageClearDelay);
}

TEST(Endless, GoesOnPastTheLastLevelOfTheCampaign)
{
    TestWorld w;
    startEndless(w);

    for (int wave = 0; wave < levelCount() + 3; ++wave) {
        clearCurrentWave(w);
        for (float t = 0.0f; t < kEndlessWaveDelay + 0.5f; t += kTickDt) {
            stepGame(w.registry, kTickDt);
        }
    }
    EXPECT_GE(currentWave(w), levelCount() + 3);
}

TEST(Endless, NeverEndsInAVictory)
{
    TestWorld w;
    startEndless(w);
    spawnPlayer(w.registry, 0);

    // The wave is cleared, even the last one a campaign would have.
    clearCurrentWave(w);
    EXPECT_FALSE(isCampaignCleared(w.registry));
    EXPECT_EQ(roomState(w.registry), RoomState::Playing);

    forEach<Campaign>(w.registry, [](Entity, Campaign &c) { c.current = 50; });
    clearCurrentWave(w);
    EXPECT_FALSE(isCampaignCleared(w.registry));
    EXPECT_EQ(roomState(w.registry), RoomState::Playing);
}

TEST(Endless, TheGameStillEndsWhenEveryPlayerIsOut)
{
    TestWorld w;
    startEndless(w);
    const Entity ship = spawnPlayer(w.registry, 0);
    Player &player = *w.registry.getComponent<Player>(ship);
    player.alive = false;
    player.lives = -1;

    EXPECT_EQ(roomState(w.registry), RoomState::Defeat);
}

TEST(Endless, TheCampaignOfTheSameRoomIsNotAffected)
{
    TestWorld w; // no rules set: the campaign
    startCampaign(w.registry);
    spawnPlayer(w.registry, 0);

    EXPECT_EQ(loadedEventCount(w), level1().size());
    forEach<Campaign>(w.registry, [](Entity, Campaign &c) { c.current = c.count - 1; });
    clearCurrentWave(w);
    EXPECT_TRUE(isCampaignCleared(w.registry));
    EXPECT_EQ(roomState(w.registry), RoomState::Victory);
}

TEST(Endless, EnemiesOfALateWaveHaveMoreHitPoints)
{
    const auto firstEnemyHp = [](int wave) {
        TestWorld w;
        startEndless(w);
        spawnPlayer(w.registry, 0);
        forEach<Campaign>(w.registry, [&](Entity, Campaign &c) { c.current = wave; });
        // A single Bink due right now.
        loadLevel(w.registry, {SpawnEvent{0.0f, EnemyType::Bink, 270.0f}});
        wavesSystem(w.registry, kTickDt);
        int hp = 0;
        forEach<Enemy>(w.registry,
                       [&](Entity e, Enemy &) { hp = w.registry.getComponent<Health>(e)->hp; });
        return hp;
    };

    EXPECT_EQ(firstEnemyHp(0), 1);
    EXPECT_GT(firstEnemyHp(20), firstEnemyHp(0));
}

TEST(Endless, TheBossOfALateWaveHasMoreHitPointsToo)
{
    const auto bossHpAt = [](int wave) {
        TestWorld w;
        startEndless(w);
        spawnPlayer(w.registry, 0);
        forEach<Campaign>(w.registry, [&](Entity, Campaign &c) { c.current = wave; });
        loadLevel(w.registry, {SpawnEvent{0.0f, EnemyType::Boss, 270.0f}});
        wavesSystem(w.registry, kTickDt);
        int hp = 0;
        forEach<BossState>(w.registry, [&](Entity e, BossState &) {
            hp = w.registry.getComponent<Health>(e)->hp;
        });
        return hp;
    };

    EXPECT_GT(bossHpAt(9), bossHpAt(4));
}

TEST(Endless, TheCampaignKeepsTheHitPointsOfTheEnemiesUnchanged)
{
    TestWorld w; // campaign
    startCampaign(w.registry);
    spawnPlayer(w.registry, 0);
    forEach<Campaign>(w.registry, [](Entity, Campaign &c) { c.current = 0; });
    loadLevel(w.registry, {SpawnEvent{0.0f, EnemyType::Bink, 270.0f}});
    wavesSystem(w.registry, kTickDt);
    int hp = 0;
    forEach<Enemy>(w.registry,
                   [&](Entity e, Enemy &) { hp = w.registry.getComponent<Health>(e)->hp; });

    EXPECT_EQ(hp, 1);
}

TEST(Endless, TheSnapshotTellsTheWave)
{
    TestWorld w;
    startEndless(w);
    spawnPlayer(w.registry, 0);
    clearCurrentWave(w);
    for (float t = 0.0f; t < kEndlessWaveDelay + 0.5f; t += kTickDt) {
        stepGame(w.registry, kTickDt);
    }

    const Snapshot snapshot = collectSnapshot(w.registry);
    EXPECT_EQ(snapshot.stage, 2);
    EXPECT_EQ(snapshot.state, RoomState::Playing);
}
