#include "TestWorld.hpp"
#include "game/ecs_helpers.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

#include <gtest/gtest.h>
#include <string>
#include <vector>

using namespace game_test;

namespace {

void run(TestWorld &w, int ticks)
{
    for (int i = 0; i < ticks; ++i) {
        stepGame(w.registry, kTickDt);
    }
}

Player &playerOf(TestWorld &w, Entity ship)
{
    return *w.registry.getComponent<Player>(ship);
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

} // namespace

TEST(StepGame, ShootRunsBeforeMovementSoANewBulletMovesInTheSameTick)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    w.registry.getComponent<Input>(ship)->fire = true;

    stepGame(w.registry, kTickDt);

    const auto bullets = entitiesOfType(w, EntityType::PlayerBullet);
    ASSERT_EQ(bullets.size(), 1u);
    const float nose = kPlayerSpawnX + kPlayerWidth * 0.5f + kBulletWidth * 0.5f;
    EXPECT_NEAR(w.pos(bullets[0]).x, nose + kShotSpeed * kTickDt, 1e-3f);
}

TEST(StepGame, AShotKillsAnEnemyAndCreditsTheShooter)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 1);
    const Position spawn = playerSpawnPosition(1);
    const Entity enemy = w.enemy(300.0f, spawn.y, 1, 100);
    w.registry.getComponent<Input>(ship)->fire = true;

    run(w, 120);

    EXPECT_FALSE(w.registry.isAlive(enemy));
    EXPECT_EQ(playerOf(w, ship).score, 100);
    EXPECT_TRUE(playerOf(w, ship).alive);
}

TEST(StepGame, ABeamPiercesEveryEnemyInALine)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    const float y = playerSpawnPosition(0).y;
    const Entity closeEnemy = w.enemy(300.0f, y, 1, 100);
    const Entity farEnemy = w.enemy(400.0f, y, 1, 150);
    Input &input = *w.registry.getComponent<Input>(ship);

    input.fire = true;
    run(w, 60); // the tap shot kills the first enemy, then the beam charges
    input.fire = false;
    run(w, 120);

    EXPECT_FALSE(w.registry.isAlive(closeEnemy));
    EXPECT_FALSE(w.registry.isAlive(farEnemy));
    EXPECT_EQ(playerOf(w, ship).score, 250);
}

TEST(StepGame, ADeadShipComesBackAfterTheRespawnDelay)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    const Position spawn = playerSpawnPosition(0);
    w.shot(Team::EnemyShot, spawn.x, spawn.y);

    stepGame(w.registry, kTickDt);
    EXPECT_FALSE(playerOf(w, ship).alive);
    EXPECT_EQ(playerOf(w, ship).lives, 2);

    run(w, 60);
    EXPECT_FALSE(playerOf(w, ship).alive); // 1 s: still waiting

    run(w, 70);
    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_GT(playerOf(w, ship).invincibleTimer, 0.0f);
    EXPECT_EQ(w.registry.getComponent<Health>(ship)->hp, 1);
    EXPECT_TRUE(entitiesOfType(w, EntityType::Explosion).empty()); // lifetime expired
}

TEST(StepGame, LosingTheLastLifeEndsTheGame)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    playerOf(w, ship).lives = 0;
    const Position spawn = playerSpawnPosition(0);
    w.shot(Team::EnemyShot, spawn.x, spawn.y);

    stepGame(w.registry, kTickDt);
    EXPECT_TRUE(allPlayersGameOver(w.registry));

    run(w, 300); // never comes back
    EXPECT_FALSE(playerOf(w, ship).alive);
    EXPECT_TRUE(allPlayersGameOver(w.registry));
}

TEST(StepGame, ALoadedLevelSpawnsEnemiesThatScrollIn)
{
    TestWorld w;
    spawnPlayer(w.registry, 0);
    loadLevel(w.registry, {{1.0f, EnemyType::Carrier, 270.0f}});

    run(w, 61); // a bit past t = 1 s

    std::vector<Entity> carriers;
    forEach<Enemy>(w.registry, [&](Entity e, Enemy &enemy) {
        if (enemy.type == EnemyType::Carrier) {
            carriers.push_back(e);
        }
    });
    ASSERT_EQ(carriers.size(), 1u);
    EXPECT_LT(w.pos(carriers[0]).x, kArenaWidth + kEnemySpawnMargin); // already moving left
    EXPECT_GT(w.pos(carriers[0]).x, kArenaWidth - 100.0f);
}

TEST(StepGame, ATurretShootsAndKillsAPlayerWhoDoesNotMove)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    const Position spawn = playerSpawnPosition(0);
    const Entity turret = spawnEnemy(w.registry, EnemyType::Turret, 500.0f, spawn.y);
    w.registry.getComponent<Enemy>(turret)->fireTimer = 0.0f;

    // The bullet needs about 2.3 s to cross the arena. Stop at the death:
    // the ship respawns two seconds later.
    int ticks = 0;
    while (playerOf(w, ship).alive && ticks < 300) {
        stepGame(w.registry, kTickDt);
        ++ticks;
    }

    EXPECT_FALSE(playerOf(w, ship).alive);
    EXPECT_EQ(playerOf(w, ship).lives, 2);
    EXPECT_GT(ticks, 120); // not instant: the bullet really had to travel
}

TEST(StepGame, AFullLevelCanBeClearedByAShootingPlayer)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    const Position spawn = playerSpawnPosition(0);
    loadLevel(w.registry, {{0.5f, EnemyType::Bink, spawn.y}, {1.0f, EnemyType::Carrier, spawn.y}});
    Input &input = *w.registry.getComponent<Input>(ship);
    EXPECT_FALSE(isLevelCleared(w.registry));

    // tap the fire key every 0.25 s so the cooldown never blocks a shot
    for (int tick = 0; tick < 60 * 12 && !isLevelCleared(w.registry); ++tick) {
        input.fire = (tick % 15) < 2;
        stepGame(w.registry, kTickDt);
    }

    EXPECT_TRUE(isLevelCleared(w.registry));
    EXPECT_EQ(playerOf(w, ship).score, kBinkScore + kCarrierScore);
}

TEST(StepGame, GameSystemsRunInTheDesignOrder)
{
    const std::vector<std::string> expected{"player-timers", "campaign",  "waves",
                                            "enemy-fire",    "boss",      "shoot",
                                            "movement",      "collision", "lifetime"};
    EXPECT_EQ(gameSystems().names(), expected);
}
