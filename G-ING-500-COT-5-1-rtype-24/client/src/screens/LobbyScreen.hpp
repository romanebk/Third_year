#pragma once

#include "network/ServerConnection.hpp"
#include "screens/Screen.hpp"
#include "ui/Menu.hpp"

#include <string>
#include <vector>

namespace client {

// Waiting room: shows the players of the game and who is ready.
// The server starts the game when everybody is ready.
class LobbyScreen : public Screen {
public:
    // `players`: the players already known (for example after a game).
    explicit LobbyScreen(Client &client, const std::vector<PlayerInfo> &players = {});

    void handleEvent(const sf::Event &event) override;
    void update(float dt) override;
    void draw(sf::RenderWindow &window) override;

private:
    void leave();

    Menu _menu;
    std::vector<PlayerInfo> _players;
    bool _ready = false;
    std::string _message;
};

} // namespace client
