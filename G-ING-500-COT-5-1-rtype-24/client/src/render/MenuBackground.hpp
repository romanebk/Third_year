#ifndef CLIENT_RENDER_MENUBACKGROUND_HPP
#define CLIENT_RENDER_MENUBACKGROUND_HPP

// Picture behind the menu screens (client/assets/backgrounds/menu.jpg). It is
// scaled to cover the whole window, whatever its shape, and drifts very slowly.
// A dark gradient keeps the menu readable. If the file is missing,
// isLoaded() is false and the screens use the star field instead.

#include <SFML/Graphics/RenderWindow.hpp>
#include <SFML/Graphics/Texture.hpp>
#include <string>

namespace client {

class MenuBackground {
public:
    // Where the menu is: on the left (main menu) or in the middle (other screens).
    enum class Layout { Left, Center };

    explicit MenuBackground(const std::string &path);

    bool isLoaded() const { return _loaded; }
    void update(float dt);
    void draw(sf::RenderWindow &window, Layout layout);

private:
    sf::Texture _texture;
    bool _loaded = false;
    float _time = 0.0f;
};

} // namespace client

#endif // CLIENT_RENDER_MENUBACKGROUND_HPP
