#ifndef CLIENT_RENDER_VIEWPORT_HPP
#define CLIENT_RENDER_VIEWPORT_HPP

// The game is drawn in a fixed area (960 x 540, like the server) and must keep
// its proportions whatever the size of the window: it is scaled up or down and
// centered, and what is left of the window (bars) stays black.

#include <SFML/Graphics/Rect.hpp>
#include <SFML/System/Vector2.hpp>

namespace client {

// The part of a window of `windowSize` pixels where a game area of
// `gameWidth` x `gameHeight` is drawn, as fractions of the window (SFML
// "viewport": 0 to 1). The result has the proportions of the game area and is
// centered: a wider window gets bars on the left and right, a taller one bars
// above and below. An empty window (size 0, for instance when minimized) gives
// the whole window.
sf::FloatRect letterboxViewport(sf::Vector2u windowSize, float gameWidth, float gameHeight);

// Where to draw an image of `imageSize` pixels so that it covers all of an area
// of `areaSize` (like CSS "background-size: cover"): scaled with its
// proportions, centered, and cropped on the longer side. The result is in the
// coordinates of the area and always contains it. An empty image gives the area.
sf::FloatRect coverRect(sf::Vector2f imageSize, sf::Vector2f areaSize);

} // namespace client

#endif // CLIENT_RENDER_VIEWPORT_HPP
