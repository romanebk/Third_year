#pragma once

// Base class of every screen of the client (main menu, settings, game...).
// The Client calls these three functions on the current screen every frame.

#include <SFML/Graphics/RenderWindow.hpp>
#include <SFML/Window/Event.hpp>

namespace client {

class Client;

class Screen {
public:
    explicit Screen(Client &client) : _client(client) {}
    virtual ~Screen() = default;

    virtual void handleEvent(const sf::Event &event) = 0;
    virtual void update(float dt) = 0; // dt = seconds since the last frame
    virtual void draw(sf::RenderWindow &window) = 0;

protected:
    Client &_client;
};

} // namespace client
