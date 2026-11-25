#pragma once

#include "Config.hpp"
#include "screens/Screen.hpp"
#include "ui/Menu.hpp"

namespace client {

// Volumes and key rebinding (accessibility: every player can choose the keys
// that are comfortable for them). Changes are saved right away.
class SettingsScreen : public Screen {
public:
    explicit SettingsScreen(Client &client);

    void handleEvent(const sf::Event &event) override;
    void update(float dt) override;
    void draw(sf::RenderWindow &window) override;

private:
    void refreshItems();

    Menu _menu;
    bool _waitingForKey = false; // true after choosing an action to rebind
    Action _actionToRebind = Action::Up;
};

} // namespace client
