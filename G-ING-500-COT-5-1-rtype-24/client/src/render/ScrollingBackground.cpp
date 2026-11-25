#include "render/ScrollingBackground.hpp"

#include "render/Viewport.hpp"

#include <SFML/Graphics/RectangleShape.hpp>
#include <SFML/Graphics/Sprite.hpp>
#include <cmath>
#include <iostream>

namespace client {

namespace {

// Picture widths per second: one crossing takes 100 s.
const float kScrollSpeed = 0.01f;
// Alpha of the black shade over the picture (0 to 255).
const std::uint8_t kShade = 90;

// Color of the picture for each level (white = the picture as it is). After
// the last one, it starts again (endless mode).
const sf::Color kStageColors[] = {sf::Color::White, sf::Color(255, 180, 160),
                                  sf::Color(170, 255, 200), sf::Color(170, 200, 255),
                                  sf::Color(230, 170, 255)};
const int kStageColorCount = 5;

} // namespace

ScrollingBackground::ScrollingBackground(const std::string &path)
{
    _loaded = _texture.loadFromFile(path);
    if (_loaded) {
        _texture.setSmooth(true);
    } else {
        std::cerr << "Game background not found: " << path << " (using the stars)\n";
    }
}

void ScrollingBackground::update(float dt)
{
    // Two tiles (the picture and its mirror) make one period.
    _scroll = std::fmod(_scroll + kScrollSpeed * dt, 2.0f);
}

void ScrollingBackground::draw(sf::RenderWindow &window, int stage)
{
    const sf::Vector2f area(window.getSize());
    if (!_loaded || area.x <= 0.0f || area.y <= 0.0f) {
        return;
    }
    // Draw in window pixels, over the bars too, then give the game view back.
    const sf::View gameView = window.getView();
    window.setView(sf::View(sf::FloatRect({0.0f, 0.0f}, area)));

    const sf::FloatRect fit = coverRect(sf::Vector2f(_texture.getSize()), area);
    const float scale = fit.size.x / static_cast<float>(_texture.getSize().x);
    const float offset = _scroll * fit.size.x;
    sf::Sprite sprite(_texture);
    if (stage > 0) {
        sprite.setColor(kStageColors[(stage - 1) % kStageColorCount]);
    }
    // Tile n covers [n * width - offset, (n + 1) * width - offset]; the odd
    // ones are mirrored so that two neighbours always touch by the same edge.
    for (int n = static_cast<int>(std::floor(offset / fit.size.x));; ++n) {
        const float left = static_cast<float>(n) * fit.size.x - offset;
        if (left >= area.x) {
            break;
        }
        const bool mirrored = n % 2 != 0;
        sprite.setScale({mirrored ? -scale : scale, scale});
        sprite.setPosition({mirrored ? left + fit.size.x : left, fit.position.y});
        window.draw(sprite);
    }

    sf::RectangleShape shade(area);
    shade.setFillColor(sf::Color(0, 0, 8, kShade));
    window.draw(shade);
    window.setView(gameView);
}

} // namespace client
