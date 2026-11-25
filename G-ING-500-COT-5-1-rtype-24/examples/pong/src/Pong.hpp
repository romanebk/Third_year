#pragma once

// A second game built on the engine, with no R-Type code: two paddles, one
// ball, first to kWinningScore wins. It uses the same building blocks as
// R-Type (Registry, View, Scheduler, EventBus) and draws through IGraphics, so
// any graphics module (SFML today) can display it.

#include "engine/core/EventBus.hpp"
#include "engine/ecs/Registry.hpp"
#include "engine/ecs/Scheduler.hpp"
#include "engine/subsystems/IGraphics.hpp"

#include <array>
#include <cstddef>

namespace pong {

// --- Components: Pong's own, unrelated to the R-Type ones. ---
struct Position {
    float x = 0.0f; // top-left corner
    float y = 0.0f;
};

struct Velocity {
    float x = 0.0f;
    float y = 0.0f;
};

struct Size {
    float width = 0.0f;
    float height = 0.0f;
};

struct Paddle {
    int side = 0; // 0 = left, 1 = right
};

struct Ball {};

// --- Events ---
struct Goal {
    int scorer = 0; // side that scored
};

struct Bounce {}; // the ball hit a paddle (a sound could play here)

// What the players press this tick.
struct Controls {
    bool leftUp = false;
    bool leftDown = false;
    bool rightUp = false;
    bool rightDown = false;
};

inline constexpr float kWidth = 800.0f;
inline constexpr float kHeight = 480.0f;
inline constexpr float kPaddleWidth = 12.0f;
inline constexpr float kPaddleHeight = 80.0f;
inline constexpr float kPaddleMargin = 24.0f;
inline constexpr float kPaddleSpeed = 360.0f;
inline constexpr float kBallSize = 12.0f;
inline constexpr float kBallSpeed = 300.0f;
inline constexpr float kSpeedUp = 1.05f; // after each paddle hit
inline constexpr int kWinningScore = 5;

class PongGame {
public:
    PongGame();
    // The systems capture `this`: a copy would drive the wrong game.
    PongGame(const PongGame &) = delete;
    PongGame &operator=(const PongGame &) = delete;
    PongGame(PongGame &&) = delete;
    PongGame &operator=(PongGame &&) = delete;
    ~PongGame() = default;

    void setControls(const Controls &controls) { _controls = controls; }
    // One fixed simulation step: runs the systems, then the queued events.
    void step(float dt);
    void render(engine::IGraphics &graphics);

    [[nodiscard]] int score(int side) const { return _scores.at(static_cast<std::size_t>(side)); }
    [[nodiscard]] bool finished() const { return _winner >= 0; }
    [[nodiscard]] int winner() const { return _winner; }

    engine::Registry &registry() { return _registry; }
    engine::EventBus &events() { return _events; }
    [[nodiscard]] const engine::Scheduler &systems() const { return _systems; }
    [[nodiscard]] engine::Entity ball() const { return _ball; }
    [[nodiscard]] engine::Entity paddle(int side) const
    {
        return _paddles.at(static_cast<std::size_t>(side));
    }

    // Puts the ball back in the middle, served towards `side`.
    void serve(int side);

private:
    engine::Registry _registry;
    engine::Scheduler _systems;
    engine::EventBus _events;
    Controls _controls;
    std::array<int, 2> _scores{};
    int _winner = -1;
    engine::Entity _ball{0, 0};
    std::array<engine::Entity, 2> _paddles{engine::Entity{0, 0}, engine::Entity{0, 0}};
};

} // namespace pong
