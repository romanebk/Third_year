#include "render/MenuBackground.hpp"

#include "render/Viewport.hpp"

#include <SFML/Graphics/Sprite.hpp>
#include <SFML/Graphics/Vertex.hpp>
#include <SFML/Graphics/VertexArray.hpp>
#include <cmath>
#include <iostream>

namespace client {

namespace {

// The picture is drawn a little bigger than the window and moves inside this
// margin, so the drift never shows an edge.
const float kOverscan = 1.06f;
const float kDriftSpeed = 0.15f; // radians per second

sf::Vertex shade(float x, float y, std::uint8_t alpha)
{
    return sf::Vertex{{x, y}, sf::Color(0, 0, 8, alpha)};
}

} // namespace

MenuBackground::MenuBackground(const std::string &path)
{
    _loaded = _texture.loadFromFile(path);
    if (_loaded) {
        _texture.setSmooth(true);
    } else {
        std::cerr << "Menu background not found: " << path << " (using the stars)\n";
    }
}

void MenuBackground::update(float dt)
{
    _time += dt;
}

void MenuBackground::draw(sf::RenderWindow &window, Layout layout)
{
    const sf::Vector2f area(window.getSize());
    if (!_loaded || area.x <= 0.0f || area.y <= 0.0f) {
        return;
    }
    // Draw in window pixels, over the bars too, then give the game view back.
    const sf::View gameView = window.getView();
    window.setView(sf::View(sf::FloatRect({0.0f, 0.0f}, area)));

    const sf::FloatRect fit = coverRect(sf::Vector2f(_texture.getSize()), area);
    sf::Sprite sprite(_texture);
    const float scale = fit.size.x / static_cast<float>(_texture.getSize().x) * kOverscan;
    const sf::Vector2f size{fit.size.x * kOverscan, fit.size.y * kOverscan};
    const sf::Vector2f margin{size.x - area.x, size.y - area.y};
    sprite.setScale({scale, scale});
    sprite.setPosition({-margin.x / 2.0f * (1.0f + std::sin(_time * kDriftSpeed)),
                        -margin.y / 2.0f * (1.0f + std::cos(_time * kDriftSpeed * 0.7f))});
    window.draw(sprite);

    sf::VertexArray shadow(sf::PrimitiveType::TriangleStrip, 4);
    if (layout == Layout::Left) {
        // Dark on the left, where the menu is, fading to the picture on the right.
        shadow[0] = shade(0.0f, 0.0f, 215);
        shadow[1] = shade(0.0f, area.y, 215);
        shadow[2] = shade(area.x * 0.62f, 0.0f, 10);
        shadow[3] = shade(area.x * 0.62f, area.y, 10);
    } else {
        shadow[0] = shade(0.0f, 0.0f, 150);
        shadow[1] = shade(0.0f, area.y, 150);
        shadow[2] = shade(area.x, 0.0f, 150);
        shadow[3] = shade(area.x, area.y, 150);
    }
    window.draw(shadow);
    window.setView(gameView);
}

} // namespace client
