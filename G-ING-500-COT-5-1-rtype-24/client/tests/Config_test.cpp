#include "Config.hpp"

#include <cstdio>
#include <fstream>
#include <gtest/gtest.h>

using namespace client;

TEST(Config, DefaultKeysAreArrowsAndSpace)
{
    const Config config;
    EXPECT_EQ(config.getKey(Action::Up), sf::Keyboard::Scancode::Up);
    EXPECT_EQ(config.getKey(Action::Fire), sf::Keyboard::Scancode::Space);
}

TEST(Config, RebindingSwapsKeysWhenAlreadyUsed)
{
    Config config;
    config.setKey(Action::Fire, sf::Keyboard::Scancode::Up);
    EXPECT_EQ(config.getKey(Action::Fire), sf::Keyboard::Scancode::Up);
    EXPECT_EQ(config.getKey(Action::Up), sf::Keyboard::Scancode::Space);
}

TEST(Config, SaveAndLoad)
{
    const std::string path = "client_test.cfg";
    Config config;
    config.playerName = "Alexis";
    config.port = 5000;
    config.musicVolume = 30;
    config.setKey(Action::Fire, sf::Keyboard::Scancode::X);
    ASSERT_TRUE(config.save(path));

    Config loaded;
    ASSERT_TRUE(loaded.load(path));
    EXPECT_EQ(loaded.playerName, "Alexis");
    EXPECT_EQ(loaded.port, 5000);
    EXPECT_EQ(loaded.musicVolume, 30);
    EXPECT_EQ(loaded.getKey(Action::Fire), sf::Keyboard::Scancode::X);
    std::remove(path.c_str());
}

TEST(Config, BadValuesAreIgnored)
{
    const std::string path = "client_bad.cfg";
    std::ofstream(path) << "music=500\nport=-3\nkey_Fire=hello\nnot a line\n";
    Config config;
    config.load(path);
    EXPECT_EQ(config.musicVolume, 100);
    EXPECT_EQ(config.port, 4300);
    EXPECT_EQ(config.getKey(Action::Fire), sf::Keyboard::Scancode::Space);
    std::remove(path.c_str());
}

TEST(Config, DifficultyIsSaved)
{
    const std::string path = "client_difficulty.cfg";
    Config config;
    EXPECT_EQ(config.difficulty, game::Difficulty::Normal);
    config.difficulty = game::Difficulty::Hard;
    ASSERT_TRUE(config.save(path));
    Config loaded;
    ASSERT_TRUE(loaded.load(path));
    EXPECT_EQ(loaded.difficulty, game::Difficulty::Hard);

    std::ofstream(path) << "difficulty=impossible\n";
    Config bad;
    bad.load(path);
    EXPECT_EQ(bad.difficulty, game::Difficulty::Normal);
    std::remove(path.c_str());
}

TEST(Config, ModeIsSaved)
{
    const std::string path = "client_mode.cfg";
    Config config;
    EXPECT_EQ(config.mode, game::GameMode::Campaign);
    config.mode = game::GameMode::Endless;
    ASSERT_TRUE(config.save(path));
    Config loaded;
    ASSERT_TRUE(loaded.load(path));
    EXPECT_EQ(loaded.mode, game::GameMode::Endless);

    std::ofstream(path) << "mode=versus\n";
    Config bad;
    bad.load(path);
    EXPECT_EQ(bad.mode, game::GameMode::Campaign);
    std::remove(path.c_str());
}

TEST(Config, TheSummaryKeyAndTheVoiceAreSaved)
{
    const std::string path = "client_voice.cfg";
    Config config;
    EXPECT_EQ(config.getKey(Action::Summary), sf::Keyboard::Scancode::Tab);
    EXPECT_TRUE(config.voice); // on by default: a blind player must hear the menus
    config.voice = false;
    ASSERT_TRUE(config.save(path));
    Config loaded;
    ASSERT_TRUE(loaded.load(path));
    EXPECT_FALSE(loaded.voice);
    std::remove(path.c_str());
}
