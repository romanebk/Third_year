#pragma once

#include "engine/subsystems/Types.hpp"

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace engine {

using TextureId = std::uint32_t;

// Window, input and 2D drawing. Implementations: engine::sfml::SfmlGraphics
// (module engine_sfml) and engine::NullGraphics (headless, tests).
class IGraphics {
public:
    IGraphics() = default;
    IGraphics(const IGraphics &) = delete;
    IGraphics &operator=(const IGraphics &) = delete;
    IGraphics(IGraphics &&) = delete;
    IGraphics &operator=(IGraphics &&) = delete;
    virtual ~IGraphics() = default;

    virtual bool open(unsigned width, unsigned height, std::string_view title) = 0;
    virtual void close() = 0;
    [[nodiscard]] virtual bool isOpen() const = 0;

    // Window and keyboard events since the last call; also updates isKeyDown().
    virtual std::vector<InputEvent> pollEvents() = 0;
    [[nodiscard]] virtual bool isKeyDown(Key key) const = 0;

    // std::nullopt if the file cannot be loaded.
    virtual std::optional<TextureId> loadTexture(const std::string &path) = 0;

    virtual void clear(Color color) = 0;
    virtual void drawRect(const Rect &rect, Color color) = 0;
    // Draws the `source` part of a texture with its top-left corner at `position`.
    virtual void drawSprite(TextureId texture, const Rect &source, Vec2f position,
                            Vec2f scale = {1.0f, 1.0f}) = 0;
    virtual void display() = 0;
};

} // namespace engine
