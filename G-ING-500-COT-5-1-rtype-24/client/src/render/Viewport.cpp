#include "render/Viewport.hpp"

#include <algorithm>

namespace client {

sf::FloatRect letterboxViewport(sf::Vector2u windowSize, float gameWidth, float gameHeight)
{
    const sf::FloatRect whole({0.0f, 0.0f}, {1.0f, 1.0f});
    if (windowSize.x == 0 || windowSize.y == 0 || gameWidth <= 0.0f || gameHeight <= 0.0f) {
        return whole;
    }
    const float windowRatio = static_cast<float>(windowSize.x) / static_cast<float>(windowSize.y);
    const float gameRatio = gameWidth / gameHeight;
    if (windowRatio > gameRatio) {
        // Wider than the game: bars on the left and the right.
        const float width = gameRatio / windowRatio;
        return sf::FloatRect({(1.0f - width) / 2.0f, 0.0f}, {width, 1.0f});
    }
    // Taller than the game (or the same shape): bars above and below.
    const float height = windowRatio / gameRatio;
    return sf::FloatRect({0.0f, (1.0f - height) / 2.0f}, {1.0f, height});
}

sf::FloatRect coverRect(sf::Vector2f imageSize, sf::Vector2f areaSize)
{
    if (imageSize.x <= 0.0f || imageSize.y <= 0.0f) {
        return sf::FloatRect({0.0f, 0.0f}, areaSize);
    }
    const float scale = std::max(areaSize.x / imageSize.x, areaSize.y / imageSize.y);
    const sf::Vector2f size{imageSize.x * scale, imageSize.y * scale};
    return sf::FloatRect({(areaSize.x - size.x) / 2.0f, (areaSize.y - size.y) / 2.0f}, size);
}

} // namespace client
