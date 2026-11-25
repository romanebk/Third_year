#pragma once

// Plain value types shared by the subsystem interfaces. No library types here:
// a game written against these never includes SFML, SDL or Asio.

#include <cstdint>

namespace engine {

struct Vec2f {
    float x = 0.0f;
    float y = 0.0f;
};

// Axis-aligned rectangle; (x, y) is the top-left corner.
struct Rect {
    float x = 0.0f;
    float y = 0.0f;
    float width = 0.0f;
    float height = 0.0f;
};

struct Color {
    std::uint8_t r = 0;
    std::uint8_t g = 0;
    std::uint8_t b = 0;
    std::uint8_t a = 255;
};

// Keys the engine knows, by meaning rather than by library code.
enum class Key : std::uint8_t {
    Unknown,
    Up,
    Down,
    Left,
    Right,
    W,
    A,
    S,
    D,
    Space,
    Enter,
    Escape,
    Count
};

struct InputEvent {
    enum class Type : std::uint8_t { Closed, KeyPressed, KeyReleased };
    Type type = Type::Closed;
    Key key = Key::Unknown;
};

} // namespace engine
