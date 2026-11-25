#pragma once

#include "screens/Screen.hpp"
#include "ui/Menu.hpp"

#include <string>

namespace client {

// Multiplayer: the player types the server address, the port and a name.
class ConnectScreen : public Screen {
public:
    // `message`: shown under the menu, for example why the connection was lost.
    explicit ConnectScreen(Client &client, const std::string &message = "");

    void handleEvent(const sf::Event &event) override;
    void update(float dt) override;
    void draw(sf::RenderWindow &window) override;

private:
    void refreshItems();
    void connect();

    Menu _menu;
    std::string _port;
    std::string _message; // error or information shown under the menu
};

} // namespace client
