#pragma once

#include "network/ServerConnection.hpp"
#include "screens/Screen.hpp"
#include "ui/Menu.hpp"

#include <vector>

namespace client {

// End of the game: victory or game over, with the scores.
class GameOverScreen : public Screen {
public:
    // `endlessWave`: the wave reached in endless mode (there is no victory
    // there, the goal is the score), 0 for a campaign game.
    GameOverScreen(Client &client, bool victory, const std::vector<PlayerInfo> &players,
                   int endlessWave = 0);

    void handleEvent(const sf::Event &event) override;
    void update(float dt) override;
    void draw(sf::RenderWindow &window) override;

private:
    Menu _menu;
    bool _victory;
    std::vector<PlayerInfo> _players;
    int _endlessWave;
    float _waitTime = 1.5f; // seconds before the menu accepts keys
};

} // namespace client
