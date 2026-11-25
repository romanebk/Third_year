#pragma once

#include "game/world.hpp"

#include <SFML/Graphics/Font.hpp>
#include <SFML/Graphics/RenderWindow.hpp>
#include <string>

namespace client {

// Draws a text at (x, y). If `centered` is true, x is the middle of the text.
void drawText(sf::RenderWindow &window, const sf::Font &font, const std::string &text,
              unsigned size, float x, float y, sf::Color color = sf::Color::White,
              bool centered = false);

// Big yellow title at the top of the menu screens.
// `centerX` is the middle of the title (the arena by default).
void drawTitle(sf::RenderWindow &window, const sf::Font &font, const std::string &title,
               float centerX = game::kArenaWidth / 2.0f);

} // namespace client
