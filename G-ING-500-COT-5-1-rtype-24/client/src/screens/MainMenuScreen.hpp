#pragma once

#include "screens/Screen.hpp"
#include "ui/Menu.hpp"

namespace client {

// First screen: Solo game, Multiplayer, Settings, Quit.
class MainMenuScreen : public Screen {
public:
    explicit MainMenuScreen(Client &client);

    void handleEvent(const sf::Event &event) override;
    void update(float dt) override;
    void draw(sf::RenderWindow &window) override;

private:
    void startSoloGame();

    Menu _menu;
};

} // namespace client
