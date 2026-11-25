#include "render/Background.hpp"

#include "game/world.hpp"

#include <SFML/Graphics/RectangleShape.hpp>
#include <cmath>
#include <cstdint>
#include <random>

namespace client {

Background::Background()
{
    std::mt19937 random(42); // same stars at every launch
    std::uniform_real_distribution<float> randomX(0.0f, game::kArenaWidth);
    std::uniform_real_distribution<float> randomY(0.0f, game::kArenaHeight);

    // layer: number of stars, speed, size, brightness
    const int counts[3] = {80, 50, 20};
    const float speeds[3] = {15.0f, 45.0f, 120.0f};
    const float sizes[3] = {1.0f, 1.5f, 2.5f};
    const std::uint8_t brightness[3] = {110, 180, 255};

    for (int layer = 0; layer < 3; layer++) {
        for (int i = 0; i < counts[layer]; i++) {
            Star star;
            star.x = randomX(random);
            star.y = randomY(random);
            star.speed = speeds[layer];
            star.size = sizes[layer];
            star.color = sf::Color(brightness[layer], brightness[layer], 255);
            _stars.push_back(star);
        }
    }
}

void Background::update(float dt)
{
    _time += dt;
    for (Star &star : _stars) {
        star.x -= star.speed * dt;
        if (star.x < 0.0f) {
            star.x += game::kArenaWidth; // comes back on the right
        }
    }
}

void Background::draw(sf::RenderWindow &window)
{
    // Sky color: goes slowly from dark blue to dark purple and back (60 s).
    const float t = (std::sin(_time * 2.0f * 3.14159f / 60.0f) + 1.0f) / 2.0f;
    const auto red = static_cast<std::uint8_t>(5.0f + 25.0f * t);
    const auto blue = static_cast<std::uint8_t>(30.0f + 10.0f * t);
    sf::RectangleShape sky({game::kArenaWidth, game::kArenaHeight});
    sky.setFillColor(sf::Color(red, 5, blue));
    window.draw(sky);
    drawStars(window);
}

void Background::drawStars(sf::RenderWindow &window)
{
    sf::RectangleShape dot;
    for (const Star &star : _stars) {
        dot.setSize({star.size, star.size});
        dot.setPosition({star.x, star.y});
        dot.setFillColor(star.color);
        window.draw(dot);
    }
}

} // namespace client
