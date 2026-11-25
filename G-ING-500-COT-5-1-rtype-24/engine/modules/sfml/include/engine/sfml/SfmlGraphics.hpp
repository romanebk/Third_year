#pragma once

#include "engine/subsystems/IGraphics.hpp"

#include <memory>

namespace engine::sfml {

// IGraphics over SFML. SFML stays an implementation detail (Pimpl): this header
// includes no SFML header, so a game can swap it for another IGraphics.
class SfmlGraphics final : public IGraphics {
public:
    SfmlGraphics();
    ~SfmlGraphics() override;

    bool open(unsigned width, unsigned height, std::string_view title) override;
    void close() override;
    [[nodiscard]] bool isOpen() const override;

    std::vector<InputEvent> pollEvents() override;
    [[nodiscard]] bool isKeyDown(Key key) const override;

    std::optional<TextureId> loadTexture(const std::string &path) override;

    void clear(Color color) override;
    void drawRect(const Rect &rect, Color color) override;
    void drawSprite(TextureId texture, const Rect &source, Vec2f position, Vec2f scale) override;
    void display() override;

private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};

} // namespace engine::sfml
