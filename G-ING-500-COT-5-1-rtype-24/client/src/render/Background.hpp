#pragma once

// Scrolling star field. Three layers of stars move left at different speeds
// (far stars slow, near stars fast): this is the "parallax" effect. The sky
// color slowly changes over time so the background is not always the same.
// Everything depends on dt (time), not on the frame rate.

#include <SFML/Graphics/RenderWindow.hpp>
#include <vector>

namespace client {

class Background {
public:
    Background();

    void update(float dt);
    // Sky color and stars.
    void draw(sf::RenderWindow &window);
    // The stars only, to draw them over a picture.
    void drawStars(sf::RenderWindow &window);

private:
    struct Star {
        float x;
        float y;
        float speed; // units per second
        float size;
        sf::Color color;
    };

    std::vector<Star> _stars;
    float _time = 0.0f;
};

} // namespace client
