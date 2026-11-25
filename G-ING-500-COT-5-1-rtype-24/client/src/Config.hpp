#pragma once

// Player settings, saved in a text file (client.cfg) between two launches.
// Keys are stored as SFML scancodes: a scancode is the PHYSICAL position of a
// key, so the default "W A S D" stays at the same place on an AZERTY keyboard
// (where it is labelled "Z Q S D").

#include "game/rules.hpp"

#include <SFML/Window/Keyboard.hpp>
#include <array>
#include <cstddef>
#include <string>

namespace client {

// Summary: the voice says the score, the lives, the weapon and the boss (blind players).
enum class Action { Up, Down, Left, Right, Fire, Pause, Summary };
const int kActionCount = 7;

std::string getActionName(Action action);
// Text written on a key of the user's keyboard ("Space", "Z", ...).
std::string getKeyName(sf::Keyboard::Scancode key);

class Config {
public:
    Config(); // default values

    bool load(const std::string &path);
    bool save(const std::string &path) const;

    sf::Keyboard::Scancode getKey(Action action) const;
    // If the key was already used by another action, the two actions swap keys.
    void setKey(Action action, sf::Keyboard::Scancode key);
    void resetKeys();

    int musicVolume = 50; // 0 to 100
    int soundVolume = 80; // 0 to 100
    std::string playerName = "Player";
    std::string host = "127.0.0.1";
    unsigned short port = 4300; // UDP port of r-type_server
    // Solo game only: in multiplayer, the server chooses the difficulty.
    game::Difficulty difficulty = game::Difficulty::Normal;
    // Solo game only: campaign (2 levels) or endless (waves that never stop).
    game::GameMode mode = game::GameMode::Campaign;
    // A voice reads the menus and the game (blind players). On by default: a
    // blind player could not find the option to turn it on.
    bool voice = true;

private:
    std::array<sf::Keyboard::Scancode, kActionCount> _keys{};
};

} // namespace client
