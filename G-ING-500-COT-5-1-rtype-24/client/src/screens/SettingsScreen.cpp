#include "screens/SettingsScreen.hpp"

#include "Client.hpp"
#include "game/world.hpp"
#include "screens/MainMenuScreen.hpp"
#include "ui/TextUtils.hpp"

#include <algorithm>
#include <string>
#include <vector>

namespace client {

namespace {

// Menu lines: 0 = music, 1 = sounds, 2 = difficulty, 3 = game mode, 4 = voice,
// 5..11 = the actions, then reset and back. The lines are closer than usual so
// that the 14 lines fit between the title and the help text.
const int kMusicLine = 0;
const int kSoundLine = 1;
const int kDifficultyLine = 2;
const int kModeLine = 3;
const int kVoiceLine = 4;
const int kFirstKeyLine = 5;
const float kMenuTop = 88.0f;
const float kLineHeight = 28.0f;
const int kResetLine = kFirstKeyLine + kActionCount;
const int kBackLine = kResetLine + 1;

// Easy -> Normal -> Hard
game::Difficulty harder(game::Difficulty difficulty)
{
    if (difficulty == game::Difficulty::Easy) {
        return game::Difficulty::Normal;
    }
    return game::Difficulty::Hard;
}

// Hard -> Normal -> Easy
game::Difficulty easier(game::Difficulty difficulty)
{
    if (difficulty == game::Difficulty::Hard) {
        return game::Difficulty::Normal;
    }
    return game::Difficulty::Easy;
}

} // namespace

SettingsScreen::SettingsScreen(Client &client)
    : Screen(client),
      _menu(client.getSounds(), kMenuTop, game::kArenaWidth / 2.0f, 600.0f, kLineHeight)
{
    refreshItems();
    _client.getSounds().say("Settings");
    _menu.speakSelected(false);
}

void SettingsScreen::refreshItems()
{
    const Config &config = _client.getConfig();
    std::vector<std::string> items;
    items.push_back("< Music: " + std::to_string(config.musicVolume) + "% >");
    items.push_back("< Sounds: " + std::to_string(config.soundVolume) + "% >");
    items.push_back("< Difficulty: " + std::string(game::difficultyName(config.difficulty)) + " >");
    items.push_back("< Mode: " + std::string(game::modeName(config.mode)) + " >");
    items.push_back(std::string("< Voice: ") + (config.voice ? "on" : "off") + " >");
    for (int i = 0; i < kActionCount; i++) {
        const auto action = static_cast<Action>(i);
        items.push_back(getActionName(action) + ": " + getKeyName(config.getKey(action)));
    }
    items.push_back("Reset keys");
    items.push_back("Back");
    _menu.setItems(items);
}

void SettingsScreen::handleEvent(const sf::Event &event)
{
    Config &config = _client.getConfig();

    // Waiting for the new key of an action.
    if (_waitingForKey) {
        if (const auto *key = event.getIf<sf::Event::KeyPressed>()) {
            if (key->code != sf::Keyboard::Key::Escape) { // Escape = cancel
                config.setKey(_actionToRebind, key->scancode);
                _client.saveConfig();
            }
            _waitingForKey = false;
            refreshItems();
        }
        return;
    }

    const MenuAction action = _menu.handleEvent(event, _client.getWindow());
    const int line = _menu.getSelected();
    int change = 0;
    if (action == MenuAction::Left) {
        change = -10;
    } else if (action == MenuAction::Right) {
        change = 10;
    }

    if (change != 0 && line == kMusicLine) {
        config.musicVolume = std::clamp(config.musicVolume + change, 0, 100);
        _client.saveConfig();
    } else if (change != 0 && line == kSoundLine) {
        config.soundVolume = std::clamp(config.soundVolume + change, 0, 100);
        _client.saveConfig();
        _client.getSounds().playSound("shoot.ogg"); // to hear the new volume
    } else if (change != 0 && line == kDifficultyLine) {
        config.difficulty = change > 0 ? harder(config.difficulty) : easier(config.difficulty);
        _client.saveConfig();
    } else if (change != 0 && line == kModeLine) {
        config.mode = config.mode == game::GameMode::Campaign ? game::GameMode::Endless
                                                              : game::GameMode::Campaign;
        _client.saveConfig();
    } else if ((change != 0 || action == MenuAction::Choose) && line == kVoiceLine) {
        config.voice = !config.voice;
        _client.saveConfig();
    } else if (action == MenuAction::Choose && line >= kFirstKeyLine && line < kResetLine) {
        _actionToRebind = static_cast<Action>(line - kFirstKeyLine);
        _waitingForKey = true;
        _client.getSounds().say("Press the new key for " + getActionName(_actionToRebind));
    } else if (action == MenuAction::Choose && line == kResetLine) {
        config.resetKeys();
        _client.saveConfig();
    } else if ((action == MenuAction::Choose && line == kBackLine) || action == MenuAction::Back) {
        _client.changeScreen(std::make_unique<MainMenuScreen>(_client));
        return;
    }
    refreshItems();
}

void SettingsScreen::update(float dt)
{
    _client.updateMenuBackground(dt);
}

void SettingsScreen::draw(sf::RenderWindow &window)
{
    const sf::Font &font = _client.getFont();
    _client.drawMenuBackground(MenuBackground::Layout::Center);
    drawTitle(window, font, "SETTINGS");
    _menu.draw(window, font);
    std::string help = "Left/Right: volume   Enter: change a key";
    if (_waitingForKey) {
        help = "Press the new key for " + getActionName(_actionToRebind) + " (Escape to cancel)";
    } else if (_menu.getSelected() == kDifficultyLine) {
        help = "Left/Right: difficulty of the solo game (online, the server chooses)";
    } else if (_menu.getSelected() == kModeLine) {
        help = "Left/Right: campaign (2 levels) or endless (waves that never stop), solo only";
    } else if (_menu.getSelected() == kVoiceLine) {
        help = "A voice reads the menus and the game (Summary key: score, lives, boss)";
    }
    drawText(window, font, help, 10, game::kArenaWidth / 2.0f, 500.0f,
             _waitingForKey ? sf::Color(255, 200, 60) : sf::Color(150, 150, 180), true);
}

} // namespace client
