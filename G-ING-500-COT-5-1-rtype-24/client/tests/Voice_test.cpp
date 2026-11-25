#include "SoundPlayer.hpp"

#include <filesystem>
#include <gtest/gtest.h>
#include <string>
#include <vector>

using namespace client;

TEST(Voice, ATextIsCutIntoWords)
{
    EXPECT_EQ(textToWords("< Music: 50% >"), (std::vector<std::string>{"music", "50", "percent"}));
    EXPECT_EQ(textToWords("BOSS DESTROYED!"), (std::vector<std::string>{"boss", "destroyed"}));
    EXPECT_EQ(textToWords("P2"), (std::vector<std::string>{"p", "2"}));
    EXPECT_EQ(textToWords("10.0.0.1"),
              (std::vector<std::string>{"10", "dot", "0", "dot", "0", "dot", "1"}));
}

TEST(Voice, BigNumbersUseThousandAndHundred)
{
    EXPECT_EQ(textToWords("100"), (std::vector<std::string>{"100"}));
    EXPECT_EQ(textToWords("1250"),
              (std::vector<std::string>{"1", "thousand", "2", "hundred", "50"}));
    EXPECT_EQ(textToWords("3000"), (std::vector<std::string>{"3", "thousand"}));
    EXPECT_EQ(textToWords("205"), (std::vector<std::string>{"2", "hundred", "5"}));
}

// Every word said by the menus and the game has its voice file: a missing word
// would be spelled letter by letter.
TEST(Voice, EveryWordOfTheGameHasAVoiceFile)
{
    const std::string texts[] = {
        "Main menu Solo game Multiplayer Settings Quit",
        "Music Sounds Difficulty easy normal hard Mode campaign endless Voice on off",
        "Up Down Left Right Fire Pause Summary Space Escape Tab Reset keys Back",
        "Press the new key for",
        "Address Port Name Connect delete Waiting room Ready Not ready Leave",
        "Resume Quit to menu Victory Game over Play again",
        "score lives speed power wave level boss no boss percent",
        "WARNING: THE BOSS IS COMING THE BOSS IS ENRAGED! BOSS DESTROYED!",
        "Unknown address No answer from Connection lost with The room is full",
        "hundred thousand dot"};
    for (const std::string &text : texts) {
        for (const std::string &word : textToWords(text)) {
            EXPECT_TRUE(
                std::filesystem::exists(std::string(CLIENT_ASSETS_DIR) + "/voice/" + word + ".ogg"))
                << word;
        }
    }
    for (int number = 0; number <= 100; number++) {
        EXPECT_TRUE(std::filesystem::exists(std::string(CLIENT_ASSETS_DIR) + "/voice/" +
                                            std::to_string(number) + ".ogg"))
            << number;
    }
    for (char letter = 'a'; letter <= 'z'; letter++) {
        EXPECT_TRUE(std::filesystem::exists(std::string(CLIENT_ASSETS_DIR) + "/voice/" +
                                            std::string(1, letter) + ".ogg"))
            << letter;
    }
}
