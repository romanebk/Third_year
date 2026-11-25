#pragma once

// Prediction of our own ship. Without it, our ship only moves when the
// server's answer comes back (a network round trip: slow over Wi-Fi).
//
// Each input sent to the server is also applied right away to a copy of our
// ship, with the same movement functions as the server (game library). When a
// snapshot arrives, the server says where our ship is and which input it
// applied last (ackInput): we start again from that position and apply again
// the inputs the server has not seen yet. The server stays the boss: the
// prediction is only corrected, never sent.
//
// This file does not use SFML.

#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

#include <cstdint>
#include <deque>

namespace client {

class Prediction {
public:
    explicit Prediction(int playerId);

    // An input sent to the server: our ship moves right away.
    void addInput(const game::Input &input);
    // Snapshot: position of our ship on the server, the last input it applied
    // and our speed level (speed bonuses).
    void correct(float x, float y, std::uint32_t ackInput, int speedLevel);
    // Our ship is not on screen (dead): nothing to predict until it comes back.
    void reset();
    // Called every frame: the small correction errors fade out smoothly.
    void update(float dt);

    bool isReady() const { return _ready; } // a server position was received
    float getX() const;                     // where to draw our ship
    float getY() const;
    float getSpeedY() const; // vertical speed, to tilt the sprite

private:
    void step(const game::Input &input); // one tick of movement, like the server

    engine::Registry _registry; // a small world with only our ship
    engine::Entity _ship;
    std::deque<game::Input> _inputs; // sent, not yet applied by the server
    bool _ready = false;
    float _errorX = 0.0f; // drawn position - predicted position, fades out
    float _errorY = 0.0f;
};

} // namespace client
