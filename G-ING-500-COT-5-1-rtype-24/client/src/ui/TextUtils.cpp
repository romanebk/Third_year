#include "ui/TextUtils.hpp"

#include "game/world.hpp"

#include <SFML/Graphics/Text.hpp>

namespace client {

void drawText(sf::RenderWindow &window, const sf::Font &font, const std::string &text,
              unsigned size, float x, float y, sf::Color color, bool centered)
{
    sf::Text drawable(font, text, size);
    drawable.setFillColor(color);
    // A black outline keeps the text readable over the stars and sprites.
    drawable.setOutlineColor(sf::Color::Black);
    drawable.setOutlineThickness(2.0f);
    if (centered) {
        x -= drawable.getLocalBounds().size.x / 2.0f;
    }
    drawable.setPosition({x, y});
    window.draw(drawable);
}

void drawTitle(sf::RenderWindow &window, const sf::Font &font, const std::string &title,
               float centerX)
{
    drawText(window, font, title, 36, centerX, 50.0f, sf::Color(255, 200, 60), true);
}

} // namespace client
