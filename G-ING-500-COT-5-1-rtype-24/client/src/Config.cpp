#include "Config.hpp"

#include <SFML/System/String.hpp>
#include <algorithm>
#include <fstream>
#include <sstream>

namespace client {

std::string getActionName(Action action)
{
    switch (action) {
    case Action::Up:
        return "Up";
    case Action::Down:
        return "Down";
    case Action::Left:
        return "Left";
    case Action::Right:
        return "Right";
    case Action::Fire:
        return "Fire";
    case Action::Pause:
        return "Pause";
    case Action::Summary:
        return "Summary";
    }
    return "?";
}

std::string getKeyName(sf::Keyboard::Scancode key)
{
    const std::string name = sf::Keyboard::getDescription(key).toAnsiString();
    return name.empty() ? "?" : name;
}

Config::Config()
{
    resetKeys();
}

void Config::resetKeys()
{
    _keys[static_cast<std::size_t>(Action::Up)] = sf::Keyboard::Scancode::Up;
    _keys[static_cast<std::size_t>(Action::Down)] = sf::Keyboard::Scancode::Down;
    _keys[static_cast<std::size_t>(Action::Left)] = sf::Keyboard::Scancode::Left;
    _keys[static_cast<std::size_t>(Action::Right)] = sf::Keyboard::Scancode::Right;
    _keys[static_cast<std::size_t>(Action::Fire)] = sf::Keyboard::Scancode::Space;
    _keys[static_cast<std::size_t>(Action::Pause)] = sf::Keyboard::Scancode::Escape;
    _keys[static_cast<std::size_t>(Action::Summary)] = sf::Keyboard::Scancode::Tab;
}

sf::Keyboard::Scancode Config::getKey(Action action) const
{
    return _keys[static_cast<std::size_t>(action)];
}

void Config::setKey(Action action, sf::Keyboard::Scancode key)
{
    // Array indexes are std::size_t (an unsigned number), not int.
    const std::size_t index = static_cast<std::size_t>(action);
    for (std::size_t i = 0; i < _keys.size(); i++) {
        if (i != index && _keys[i] == key) {
            _keys[i] = _keys[index]; // swap, so no action is left without a key
        }
    }
    _keys[index] = key;
}

// File format: one "name=value" per line, for example "music=50".
bool Config::load(const std::string &path)
{
    std::ifstream file(path);
    if (!file) {
        return false;
    }
    std::string line;
    while (std::getline(file, line)) {
        const std::size_t equal = line.find('=');
        if (equal == std::string::npos) {
            continue;
        }
        const std::string name = line.substr(0, equal);
        const std::string value = line.substr(equal + 1);
        std::istringstream stream(value);
        int number = 0;
        const bool isNumber = static_cast<bool>(stream >> number);

        if (name == "name" && !value.empty()) {
            playerName = value;
        } else if (name == "host" && !value.empty()) {
            host = value;
        } else if (name == "port" && isNumber && number > 0 && number < 65536) {
            port = static_cast<unsigned short>(number);
        } else if (name == "music" && isNumber) {
            musicVolume = std::clamp(number, 0, 100);
        } else if (name == "sound" && isNumber) {
            soundVolume = std::clamp(number, 0, 100);
        } else if (name == "difficulty" && game::parseDifficulty(value)) {
            difficulty = *game::parseDifficulty(value);
        } else if (name == "voice" && (value == "on" || value == "off")) {
            voice = value == "on";
        } else if (name == "mode" && game::parseMode(value)) {
            mode = *game::parseMode(value);
        } else if (name.rfind("key_", 0) == 0 && isNumber && number >= 0 &&
                   number < static_cast<int>(sf::Keyboard::ScancodeCount)) {
            for (std::size_t i = 0; i < _keys.size(); i++) {
                if (name == "key_" + getActionName(static_cast<Action>(i))) {
                    _keys[i] = static_cast<sf::Keyboard::Scancode>(number);
                }
            }
        }
    }
    return true;
}

bool Config::save(const std::string &path) const
{
    std::ofstream file(path);
    if (!file) {
        return false;
    }
    file << "name=" << playerName << "\n";
    file << "host=" << host << "\n";
    file << "port=" << port << "\n";
    file << "music=" << musicVolume << "\n";
    file << "sound=" << soundVolume << "\n";
    file << "difficulty=" << game::difficultyName(difficulty) << "\n";
    file << "mode=" << game::modeName(mode) << "\n";
    file << "voice=" << (voice ? "on" : "off") << "\n";
    for (std::size_t i = 0; i < _keys.size(); i++) {
        file << "key_" << getActionName(static_cast<Action>(i)) << "=" << static_cast<int>(_keys[i])
             << "\n";
    }
    return true;
}

} // namespace client
