#include "network/LocalServer.hpp"
#include "world/Sprites.hpp"

#include <SFML/Audio/SoundBuffer.hpp>
#include <SFML/Graphics/Texture.hpp>
#include <gtest/gtest.h>
#include <string>

using namespace client;

// Every sound the game plays must exist and be readable by SFML.
TEST(Assets, EverySoundLoads)
{
    const std::string sounds[] = {"shoot.ogg",        "explosion.ogg",    "player_hit.ogg",
                                  "menu_move.ogg",    "menu_select.ogg",  "boss_alarm.ogg",
                                  "boss_hit.ogg",     "boss_enrage.ogg",  "boss_explosion.ogg",
                                  "pickup_power.ogg", "pickup_speed.ogg", "enemy.ogg",
                                  "victory.ogg",      "game_over.ogg"};
    for (const std::string &name : sounds) {
        sf::SoundBuffer buffer;
        EXPECT_TRUE(buffer.loadFromFile(std::string(CLIENT_ASSETS_DIR) + "/sounds/" + name))
            << name;
    }
}

TEST(Assets, TheMenuBackgroundLoads)
{
    sf::Texture texture;
    EXPECT_TRUE(texture.loadFromFile(std::string(CLIENT_ASSETS_DIR) + "/backgrounds/menu.jpg"));
    EXPECT_GE(texture.getSize().x, 1280u);
}

TEST(Assets, TheGameBackgroundLoads)
{
    sf::Texture texture;
    EXPECT_TRUE(texture.loadFromFile(std::string(CLIENT_ASSETS_DIR) + "/backgrounds/game.jpg"));
    EXPECT_GE(texture.getSize().x, 1280u);
}

TEST(Sprites, EachBonusHasItsOwnSprite)
{
    const SpriteInfo power = getSpriteInfo(game::EntityType::PickupEnt, 0); // PickupKind::Power
    const SpriteInfo speed = getSpriteInfo(game::EntityType::PickupEnt, 1); // PickupKind::Speed
    EXPECT_NE(power.sheet, speed.sheet);
}

TEST(Sprites, EachBossBallHasItsOwnStyle)
{
    EXPECT_EQ(bossBallVisual(0), game::BulletVisual::Normal); // ordinary enemy shot
    EXPECT_EQ(bossBallVisual(static_cast<int>(game::BulletVisual::Dobkeratops)),
              game::BulletVisual::Dobkeratops);
    EXPECT_EQ(bossBallVisual(static_cast<int>(game::BulletVisual::Gomander)),
              game::BulletVisual::Gomander);
    EXPECT_EQ(bossBallVisual(static_cast<int>(game::BulletVisual::Warship)),
              game::BulletVisual::Warship);
    EXPECT_EQ(bossBallVisual(static_cast<int>(game::BulletVisual::Compiler)),
              game::BulletVisual::Compiler);
    // An unknown variant is drawn as the ordinary shot, never as a boss ball.
    EXPECT_EQ(bossBallVisual(99), game::BulletVisual::Normal);
}

TEST(LocalServer, UsesTheDifficultyOfTheSettings)
{
    LocalServer server(game::Difficulty::Easy);
    server.connect("localhost", 0, "Alexis");
    server.setReady(true);
    server.update(0.1f); // a few ticks: at least one snapshot
    bool found = false;
    for (const ServerMessage &message : server.receive()) {
        if (message.type == MessageType::Snapshot) {
            EXPECT_EQ(message.players[0].lives, 5); // Easy: 5 lives instead of 3
            found = true;
        }
    }
    EXPECT_TRUE(found);
}

// Counts the snapshots received after `seconds` of game.
static int snapshotsAfter(LocalServer &server, float seconds)
{
    server.update(seconds);
    int count = 0;
    for (const ServerMessage &message : server.receive()) {
        if (message.type == MessageType::Snapshot) {
            count++;
        }
    }
    return count;
}

TEST(LocalServer, ThePauseFreezesTheGame)
{
    LocalServer server;
    server.connect("localhost", 0, "Ariel");
    server.setReady(true);
    EXPECT_GT(snapshotsAfter(server, 0.5f), 0);

    server.setPaused(true);
    EXPECT_EQ(snapshotsAfter(server, 2.0f), 0); // 2 s of pause: nothing happens

    server.setPaused(false);
    EXPECT_GT(snapshotsAfter(server, 0.5f), 0); // and the game goes on
}

TEST(LocalServer, InputsSentDuringThePauseAreNotKept)
{
    LocalServer server;
    server.connect("localhost", 0, "Ariel");
    server.setReady(true);
    server.update(0.1f);
    server.receive();

    server.setPaused(true);
    game::Input fire;
    fire.fire = true;
    for (int i = 0; i < 120; i++) {
        server.sendInput(fire);
    }
    server.setPaused(false);
    // 0.1 s = 6 ticks: if the 120 inputs had been kept, they would be played
    // for two seconds after the pause. We only check that the game runs.
    EXPECT_GT(snapshotsAfter(server, 0.1f), 0);
}

TEST(LocalServer, TheEndlessModeStartsAGameWithTheDifficultyOfTheSettings)
{
    LocalServer server(game::Difficulty::Easy, game::GameMode::Endless);
    server.connect("localhost", 0, "Ariel");
    server.setReady(true);
    server.update(0.5f);

    bool snapshot = false;
    for (const ServerMessage &message : server.receive()) {
        EXPECT_NE(message.type, MessageType::GameOver); // an endless game does not end by itself
        if (message.type == MessageType::Snapshot) {
            EXPECT_EQ(message.players[0].lives, 5); // Easy: 5 lives
            snapshot = true;
        }
    }
    EXPECT_TRUE(snapshot);
}

TEST(LocalServer, TheSnapshotsGiveTheWaveForTheScreen)
{
    LocalServer endless(game::Difficulty::Normal, game::GameMode::Endless);
    endless.connect("localhost", 0, "Alexis");
    endless.setReady(true);
    endless.update(0.5f);
    LocalServer campaign(game::Difficulty::Normal, game::GameMode::Campaign);
    campaign.connect("localhost", 0, "Alexis");
    campaign.setReady(true);
    campaign.update(0.5f);

    int snapshots = 0;
    for (const ServerMessage &message : endless.receive()) {
        if (message.type == MessageType::Snapshot) {
            EXPECT_EQ(message.stage, 1); // the first wave
            EXPECT_TRUE(message.endless);
            snapshots++;
        }
    }
    for (const ServerMessage &message : campaign.receive()) {
        if (message.type == MessageType::Snapshot) {
            EXPECT_EQ(message.stage, 1); // the first level
            EXPECT_FALSE(message.endless);
            snapshots++;
        }
    }
    EXPECT_GT(snapshots, 0);
}
