#ifndef CLIENT_RENDER_SCROLLINGBACKGROUND_HPP
#define CLIENT_RENDER_SCROLLINGBACKGROUND_HPP

// Picture behind the game (client/assets/backgrounds/game.jpg). It covers the
// whole window, scrolls slowly to the left (far away, slower than the stars)
// and is repeated mirrored, so there is no visible seam when it loops. A light
// shade keeps the ships and the shots readable. If the file is missing,
// isLoaded() is false and the game keeps the plain star field.

#include <SFML/Graphics/RenderWindow.hpp>
#include <SFML/Graphics/Texture.hpp>
#include <string>

namespace client {

class ScrollingBackground {
public:
    explicit ScrollingBackground(const std::string &path);

    bool isLoaded() const { return _loaded; }
    void update(float dt);
    // `stage`: the level or wave (from 1). Each one gives the picture another
    // color, so the levels do not all look the same. 0 = unknown: no color.
    void draw(sf::RenderWindow &window, int stage);

private:
    sf::Texture _texture;
    bool _loaded = false;
    float _scroll = 0.0f; // distance already scrolled, in picture widths
};

} // namespace client

#endif // CLIENT_RENDER_SCROLLINGBACKGROUND_HPP
