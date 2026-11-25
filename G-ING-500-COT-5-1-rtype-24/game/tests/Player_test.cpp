#include "TestWorld.hpp"
#include "game/player.hpp"
#include "game/world.hpp"

#include <gtest/gtest.h>
#include <stdexcept>

using namespace game_test;

namespace {

Player &playerOf(TestWorld &w, Entity ship)
{
    return *w.registry.getComponent<Player>(ship);
}

// Marks the ship as just killed: what the collision system leaves behind.
void kill(TestWorld &w, Entity ship, int livesLeft)
{
    Player &player = playerOf(w, ship);
    player.alive = false;
    player.lives = livesLeft;
    player.respawnTimer = kRespawnDelay;
    w.registry.getComponent<Health>(ship)->hp = 0;
    w.pos(ship) = Position{500.0f, 100.0f};
}

} // namespace

// --- spawn -------------------------------------------------------------

TEST(SpawnPlayer, BuildsACompleteShip)
{
    TestWorld w;

    const Entity ship = spawnPlayer(w.registry, 2);

    EXPECT_EQ(playerOf(w, ship).playerId, 2);
    EXPECT_EQ(playerOf(w, ship).lives, 3);
    EXPECT_EQ(playerOf(w, ship).score, 0);
    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_EQ(*w.registry.getComponent<Team>(ship), Team::P2);
    EXPECT_EQ(*w.registry.getComponent<EntityType>(ship), EntityType::Ship);
    EXPECT_EQ(w.registry.getComponent<Health>(ship)->hp, 1);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Collider>(ship)->w, kPlayerWidth);
    EXPECT_FLOAT_EQ(w.registry.getComponent<Collider>(ship)->h, kPlayerHeight);
    EXPECT_TRUE(w.registry.hasComponent<Input>(ship));
    EXPECT_TRUE(w.registry.hasComponent<Velocity>(ship));
    EXPECT_TRUE(w.registry.hasComponent<PowerState>(ship));
    EXPECT_TRUE(w.registry.hasComponent<Weapon>(ship));
    EXPECT_FLOAT_EQ(w.pos(ship).x, playerSpawnPosition(2).x);
    EXPECT_FLOAT_EQ(w.pos(ship).y, playerSpawnPosition(2).y);
}

TEST(SpawnPlayer, RejectsAnIdOutsideTheRoom)
{
    TestWorld w;

    EXPECT_THROW(spawnPlayer(w.registry, -1), std::out_of_range);
    EXPECT_THROW(spawnPlayer(w.registry, kMaxPlayers), std::out_of_range);
    EXPECT_EQ(w.registry.aliveCount(), 0u);
}

TEST(SpawnPlayer, SpawnPositionsAreDistinctAndInsideTheArena)
{
    float previousY = -1.0f;
    for (int id = 0; id < kMaxPlayers; ++id) {
        const Position p = playerSpawnPosition(id);
        EXPECT_FLOAT_EQ(p.x, kPlayerSpawnX);
        EXPECT_GT(p.y, previousY);
        EXPECT_GE(p.y, kPlayerHeight * 0.5f);
        EXPECT_LE(p.y, kArenaHeight - kPlayerHeight * 0.5f);
        previousY = p.y;
    }
}

// --- timers and respawn ------------------------------------------------

TEST(PlayerTimers, InvincibilityCountsDownAndStopsAtZero)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    playerOf(w, ship).invincibleTimer = 1.0f;

    playerTimersSystem(w.registry, 0.25f);
    EXPECT_FLOAT_EQ(playerOf(w, ship).invincibleTimer, 0.75f);

    playerTimersSystem(w.registry, 5.0f);
    EXPECT_FLOAT_EQ(playerOf(w, ship).invincibleTimer, 0.0f);
}

TEST(PlayerTimers, DeadShipRespawnsAfterTheDelay)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 1);
    kill(w, ship, 2);

    for (int i = 0; i < 3; ++i) {
        playerTimersSystem(w.registry, 0.5f); // 1.5 s of the 2 s delay
    }
    EXPECT_FALSE(playerOf(w, ship).alive);

    playerTimersSystem(w.registry, 0.5f);

    EXPECT_TRUE(playerOf(w, ship).alive);
    EXPECT_EQ(playerOf(w, ship).lives, 2); // the life was lost at death, not now
    EXPECT_EQ(w.registry.getComponent<Health>(ship)->hp, 1);
    EXPECT_FLOAT_EQ(playerOf(w, ship).invincibleTimer, kRespawnInvincibility);
    EXPECT_FLOAT_EQ(w.pos(ship).x, playerSpawnPosition(1).x);
    EXPECT_FLOAT_EQ(w.pos(ship).y, playerSpawnPosition(1).y);
}

TEST(PlayerTimers, ShipWithNoLifeLeftStaysDead)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    kill(w, ship, -1);

    for (int i = 0; i < 20; ++i) {
        playerTimersSystem(w.registry, 1.0f);
    }

    EXPECT_FALSE(playerOf(w, ship).alive);
}

TEST(PlayerTimers, ZeroDtChangesNothing)
{
    TestWorld w;
    const Entity ship = spawnPlayer(w.registry, 0);
    kill(w, ship, 2);

    playerTimersSystem(w.registry, 0.0f);

    EXPECT_FALSE(playerOf(w, ship).alive);
    EXPECT_FLOAT_EQ(playerOf(w, ship).respawnTimer, kRespawnDelay);
}

// --- game over ---------------------------------------------------------

TEST(GameOver, NoPlayersIsNotGameOver)
{
    TestWorld w;

    EXPECT_FALSE(allPlayersGameOver(w.registry));
}

TEST(GameOver, AliveOrRespawningPlayersAreNotGameOver)
{
    TestWorld w;
    const Entity a = spawnPlayer(w.registry, 0);
    EXPECT_FALSE(allPlayersGameOver(w.registry));

    kill(w, a, 0); // dead but one more respawn is coming
    EXPECT_FALSE(allPlayersGameOver(w.registry));
}

TEST(GameOver, EveryPlayerOutOfLivesIsGameOver)
{
    TestWorld w;
    const Entity a = spawnPlayer(w.registry, 0);
    const Entity b = spawnPlayer(w.registry, 1);
    kill(w, a, -1);
    EXPECT_FALSE(allPlayersGameOver(w.registry)); // b is still playing

    kill(w, b, -1);
    EXPECT_TRUE(allPlayersGameOver(w.registry));
}
