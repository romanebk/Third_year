#include "TestWorld.hpp"
#include "game/boss.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/player.hpp"
#include "game/rules.hpp"
#include "game/world.hpp"

#include <cmath>
#include <gtest/gtest.h>
#include <vector>

using namespace game_test;

namespace {

void useDifficulty(TestWorld &w, Difficulty difficulty)
{
    setRules(w.registry, rulesFor(difficulty));
}

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

float speedOf(TestWorld &w, Entity e)
{
    return std::sqrt(w.vel(e).vx * w.vel(e).vx + w.vel(e).vy * w.vel(e).vy);
}

int hpOf(TestWorld &w, Entity e)
{
    return w.registry.getComponent<Health>(e)->hp;
}

} // namespace

// --- the presets -------------------------------------------------------

TEST(RulesFor, NormalIsTheBaseGame)
{
    const Rules normal = rulesFor(Difficulty::Normal);

    EXPECT_EQ(normal.difficulty, Difficulty::Normal);
    EXPECT_FLOAT_EQ(normal.enemyHpScale, 1.0f);
    EXPECT_FLOAT_EQ(normal.enemyBulletSpeedScale, 1.0f);
    EXPECT_FLOAT_EQ(normal.enemyFireIntervalScale, 1.0f);
    EXPECT_EQ(normal.startingLives, 3);
    EXPECT_FLOAT_EQ(normal.respawnInvincibility, kRespawnInvincibility);
}

TEST(RulesFor, EasyHelpsAndHardHurts)
{
    const Rules easy = rulesFor(Difficulty::Easy);
    const Rules normal = rulesFor(Difficulty::Normal);
    const Rules hard = rulesFor(Difficulty::Hard);

    EXPECT_LT(easy.enemyHpScale, normal.enemyHpScale);
    EXPECT_LT(normal.enemyHpScale, hard.enemyHpScale);
    EXPECT_LT(easy.enemyBulletSpeedScale, normal.enemyBulletSpeedScale);
    EXPECT_LT(normal.enemyBulletSpeedScale, hard.enemyBulletSpeedScale);
    // a bigger interval means fewer enemy shots
    EXPECT_GT(easy.enemyFireIntervalScale, normal.enemyFireIntervalScale);
    EXPECT_GT(normal.enemyFireIntervalScale, hard.enemyFireIntervalScale);
    EXPECT_GT(easy.startingLives, normal.startingLives);
    EXPECT_GT(normal.startingLives, hard.startingLives);
    EXPECT_GT(easy.respawnInvincibility, normal.respawnInvincibility);
    EXPECT_GT(normal.respawnInvincibility, hard.respawnInvincibility);
    EXPECT_GE(hard.startingLives, 1);
}

TEST(RulesFor, EachPresetKnowsItsOwnDifficulty)
{
    EXPECT_EQ(rulesFor(Difficulty::Easy).difficulty, Difficulty::Easy);
    EXPECT_EQ(rulesFor(Difficulty::Hard).difficulty, Difficulty::Hard);
}

// --- names -------------------------------------------------------------

TEST(DifficultyName, ParsesTheThreeNamesInAnyCase)
{
    EXPECT_EQ(parseDifficulty("easy"), Difficulty::Easy);
    EXPECT_EQ(parseDifficulty("Normal"), Difficulty::Normal);
    EXPECT_EQ(parseDifficulty("HARD"), Difficulty::Hard);
}

TEST(DifficultyName, RejectsAnythingElse)
{
    EXPECT_FALSE(parseDifficulty("").has_value());
    EXPECT_FALSE(parseDifficulty("medium").has_value());
    EXPECT_FALSE(parseDifficulty("easy ").has_value());
    EXPECT_FALSE(parseDifficulty("1").has_value());
}

TEST(DifficultyName, NamesRoundTrip)
{
    for (const Difficulty d : {Difficulty::Easy, Difficulty::Normal, Difficulty::Hard}) {
        EXPECT_EQ(parseDifficulty(difficultyName(d)), d);
    }
}

// --- storing the rules in a room ---------------------------------------

TEST(RoomRules, AreNormalWhenNoneWereSet)
{
    TestWorld w;

    const Rules rules = rulesOf(w.registry);

    EXPECT_EQ(rules.difficulty, Difficulty::Normal);
    EXPECT_EQ(rules.startingLives, 3);
}

TEST(RoomRules, AreNormalWhenTheComponentsWereNotRegistered)
{
    engine::Registry bare;

    EXPECT_EQ(rulesOf(bare).difficulty, Difficulty::Normal);
}

TEST(RoomRules, SetRulesAreReturned)
{
    TestWorld w;

    useDifficulty(w, Difficulty::Hard);

    EXPECT_EQ(rulesOf(w.registry).difficulty, Difficulty::Hard);
    EXPECT_EQ(rulesOf(w.registry).startingLives, 2);
}

TEST(RoomRules, SettingThemAgainReplacesThePreviousOnes)
{
    TestWorld w;
    useDifficulty(w, Difficulty::Hard);
    useDifficulty(w, Difficulty::Easy);

    EXPECT_EQ(rulesOf(w.registry).difficulty, Difficulty::Easy);
    int holders = 0;
    forEach<Rules>(w.registry, [&](Entity, Rules &) { ++holders; });
    EXPECT_EQ(holders, 1);
}

// --- players -----------------------------------------------------------

TEST(RulesPlayers, ShipsStartWithTheLivesOfTheDifficulty)
{
    for (const Difficulty d : {Difficulty::Easy, Difficulty::Normal, Difficulty::Hard}) {
        TestWorld w;
        useDifficulty(w, d);

        const Entity ship = spawnPlayer(w.registry, 0);

        EXPECT_EQ(w.registry.getComponent<Player>(ship)->lives, rulesFor(d).startingLives)
            << difficultyName(d);
    }
}

TEST(RulesPlayers, RespawnInvincibilityFollowsTheDifficulty)
{
    for (const Difficulty d : {Difficulty::Easy, Difficulty::Normal, Difficulty::Hard}) {
        TestWorld w;
        useDifficulty(w, d);
        const Entity ship = spawnPlayer(w.registry, 0);
        Player &player = *w.registry.getComponent<Player>(ship);
        player.alive = false;
        player.respawnTimer = 0.25f;

        playerTimersSystem(w.registry, 0.5f);

        EXPECT_TRUE(player.alive) << difficultyName(d);
        EXPECT_FLOAT_EQ(player.invincibleTimer, rulesFor(d).respawnInvincibility)
            << difficultyName(d);
    }
}

// --- enemy hit points --------------------------------------------------

TEST(RulesEnemies, HitPointsAreScaledAndRoundedUp)
{
    TestWorld easy;
    useDifficulty(easy, Difficulty::Easy);
    EXPECT_EQ(hpOf(easy, spawnEnemy(easy.registry, EnemyType::Turret, 900.0f, 60.0f)), 2); // 1.5
    EXPECT_EQ(hpOf(easy, spawnEnemy(easy.registry, EnemyType::Carrier, 900.0f, 60.0f)), 1);
    EXPECT_EQ(hpOf(easy, spawnEnemy(easy.registry, EnemyType::Boss, 900.0f, 60.0f)), 60);

    TestWorld hard;
    useDifficulty(hard, Difficulty::Hard);
    EXPECT_EQ(hpOf(hard, spawnEnemy(hard.registry, EnemyType::Turret, 900.0f, 60.0f)), 5); // 4.5
    EXPECT_EQ(hpOf(hard, spawnEnemy(hard.registry, EnemyType::Carrier, 900.0f, 60.0f)), 3);
    EXPECT_EQ(hpOf(hard, spawnEnemy(hard.registry, EnemyType::Boss, 900.0f, 60.0f)), 180);
}

TEST(RulesEnemies, AnEnemyAlwaysHasAtLeastOneHitPoint)
{
    TestWorld w;
    useDifficulty(w, Difficulty::Easy);

    EXPECT_EQ(hpOf(w, spawnEnemy(w.registry, EnemyType::Bink, 900.0f, 60.0f)), 1);
    EXPECT_EQ(hpOf(w, spawnEnemy(w.registry, EnemyType::Patapata, 900.0f, 60.0f)), 1);
}

TEST(RulesEnemies, TheDifficultyStacksWithThePlayerCount)
{
    TestWorld w;
    useDifficulty(w, Difficulty::Hard);

    // Turret: 3 hp, x1.75 for 4 players -> 6, then x1.5 -> 9
    EXPECT_EQ(hpOf(w, spawnEnemy(w.registry, EnemyType::Turret, 900.0f, 60.0f, 4)), 9);
}

TEST(RulesEnemies, MaxHpFollowsHp)
{
    TestWorld w;
    useDifficulty(w, Difficulty::Hard);

    const Entity turret = spawnEnemy(w.registry, EnemyType::Turret, 900.0f, 60.0f);

    EXPECT_EQ(w.registry.getComponent<Health>(turret)->maxHp, 5);
}

TEST(RulesEnemies, NormalChangesNothing)
{
    TestWorld w; // no rules set: same as Normal
    EXPECT_EQ(hpOf(w, spawnEnemy(w.registry, EnemyType::Turret, 900.0f, 60.0f)), kTurretHp);
    EXPECT_EQ(hpOf(w, spawnEnemy(w.registry, EnemyType::Boss, 900.0f, 60.0f)), kBossHp);
}

// --- enemy fire --------------------------------------------------------

TEST(RulesFire, TheTurretCooldownIsScaled)
{
    TestWorld easy;
    useDifficulty(easy, Difficulty::Easy);
    const Entity slow = spawnEnemy(easy.registry, EnemyType::Turret, 900.0f, 60.0f);
    EXPECT_FLOAT_EQ(easy.registry.getComponent<Enemy>(slow)->fireCooldown,
                    kTurretFireCooldown * 1.5f);
    EXPECT_FLOAT_EQ(easy.registry.getComponent<Enemy>(slow)->fireTimer, kTurretFireCooldown * 1.5f);

    TestWorld hard;
    useDifficulty(hard, Difficulty::Hard);
    const Entity fast = spawnEnemy(hard.registry, EnemyType::Turret, 900.0f, 60.0f);
    EXPECT_FLOAT_EQ(hard.registry.getComponent<Enemy>(fast)->fireCooldown,
                    kTurretFireCooldown * 0.75f);
}

TEST(RulesFire, EnemiesThatNeverFireStillNeverFire)
{
    TestWorld w;
    useDifficulty(w, Difficulty::Hard);

    const Entity bink = spawnEnemy(w.registry, EnemyType::Bink, 900.0f, 60.0f);

    EXPECT_FLOAT_EQ(w.registry.getComponent<Enemy>(bink)->fireCooldown, 0.0f);
}

TEST(RulesFire, BulletSpeedFollowsTheDifficulty)
{
    for (const Difficulty d : {Difficulty::Easy, Difficulty::Normal, Difficulty::Hard}) {
        TestWorld w;
        useDifficulty(w, d);
        w.ship(0, 100.0f, 300.0f);
        const Entity turret = spawnEnemy(w.registry, EnemyType::Turret, 400.0f, 100.0f);
        w.registry.getComponent<Enemy>(turret)->fireTimer = 0.0f;

        enemyFireSystem(w.registry, kTickDt);

        const auto shots = bullets(w);
        ASSERT_EQ(shots.size(), 1u) << difficultyName(d);
        EXPECT_NEAR(speedOf(w, shots[0]), kEnemyBulletSpeed * rulesFor(d).enemyBulletSpeedScale,
                    1e-3f)
            << difficultyName(d);
    }
}

TEST(RulesFire, ScaledVelocityKeepsTheDirection)
{
    const Velocity v = scaledVelocity(Velocity{-300.0f, 200.0f}, 0.5f);

    EXPECT_FLOAT_EQ(v.vx, -150.0f);
    EXPECT_FLOAT_EQ(v.vy, 100.0f);
}

// --- boss --------------------------------------------------------------

TEST(RulesBoss, ShootsSoonerOnHardAndLaterOnEasy)
{
    // dt = 0.25 s: arrival, then the first shot after the (scaled) cooldown.
    // Normal 1.5 s -> 7th step, Hard 1.125 s -> 6th step, Easy 2.25 s -> 10th.
    const auto bulletsAfter = [](Difficulty d, int steps) {
        TestWorld w;
        useDifficulty(w, d);
        w.ship(0, 100.0f, 270.0f);
        spawnEnemy(w.registry, EnemyType::Boss, kBossHoverX, 270.0f);
        for (int i = 0; i < steps; ++i) {
            bossSystem(w.registry, 0.25f);
        }
        return bullets(w).size();
    };

    EXPECT_EQ(bulletsAfter(Difficulty::Hard, 6), 1u);
    EXPECT_EQ(bulletsAfter(Difficulty::Normal, 6), 0u);
    EXPECT_EQ(bulletsAfter(Difficulty::Normal, 7), 1u);
    EXPECT_EQ(bulletsAfter(Difficulty::Easy, 9), 0u);
    EXPECT_EQ(bulletsAfter(Difficulty::Easy, 10), 1u);
}

TEST(RulesBoss, BulletsAreScaledToo)
{
    TestWorld w;
    useDifficulty(w, Difficulty::Hard);
    w.ship(0, 100.0f, 270.0f);
    spawnEnemy(w.registry, EnemyType::Boss, kBossHoverX, 270.0f);

    for (int i = 0; i < 6; ++i) {
        bossSystem(w.registry, 0.25f);
    }

    const auto shots = bullets(w);
    ASSERT_EQ(shots.size(), 1u);
    EXPECT_NEAR(speedOf(w, shots[0]), kEnemyBulletSpeed * 1.25f, 1e-3f);
}
