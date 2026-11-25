#pragma once

// Implementations that do nothing visible: for a server (no window, no sound),
// headless runs in CI, and tests. They also show that the interfaces are not
// tied to a library: a third implementation is just another class.

#include "engine/subsystems/IAudio.hpp"
#include "engine/subsystems/IGraphics.hpp"

#include <array>
#include <cstddef>
#include <string>
#include <utility>
#include <vector>

namespace engine {

class NullGraphics final : public IGraphics {
public:
    bool open(unsigned width, unsigned height, std::string_view title) override
    {
        _open = true;
        _width = width;
        _height = height;
        _title = std::string(title);
        return true;
    }
    void close() override { _open = false; }
    [[nodiscard]] bool isOpen() const override { return _open; }

    // Test hook: the event is returned by the next pollEvents().
    void pushEvent(InputEvent event) { _pending.push_back(event); }

    std::vector<InputEvent> pollEvents() override
    {
        std::vector<InputEvent> events;
        events.swap(_pending);
        for (const InputEvent &e : events) {
            if (e.type == InputEvent::Type::Closed) {
                _open = false;
            } else {
                _down[index(e.key)] = e.type == InputEvent::Type::KeyPressed;
            }
        }
        return events;
    }
    [[nodiscard]] bool isKeyDown(Key key) const override { return _down[index(key)]; }

    std::optional<TextureId> loadTexture(const std::string &) override { return _nextTexture++; }

    void clear(Color) override { _drawCalls = 0; }
    void drawRect(const Rect &rect, Color) override
    {
        ++_drawCalls;
        _lastRect = rect;
    }
    void drawSprite(TextureId, const Rect &, Vec2f, Vec2f) override { ++_drawCalls; }
    void display() override { ++_frames; }

    // What was drawn since the last clear(), and how many frames were shown.
    [[nodiscard]] std::size_t drawCalls() const { return _drawCalls; }
    [[nodiscard]] std::size_t frames() const { return _frames; }
    [[nodiscard]] Rect lastRect() const { return _lastRect; }
    [[nodiscard]] unsigned width() const { return _width; }
    [[nodiscard]] unsigned height() const { return _height; }
    [[nodiscard]] const std::string &title() const { return _title; }

private:
    static std::size_t index(Key key) { return static_cast<std::size_t>(key); }

    bool _open = false;
    unsigned _width = 0;
    unsigned _height = 0;
    std::string _title;
    std::vector<InputEvent> _pending;
    std::array<bool, static_cast<std::size_t>(Key::Count)> _down{};
    TextureId _nextTexture = 0;
    std::size_t _drawCalls = 0;
    std::size_t _frames = 0;
    Rect _lastRect;
};

class NullAudio final : public IAudio {
public:
    std::optional<SoundId> loadSound(const std::string &) override { return _nextSound++; }
    void playSound(SoundId, float) override { ++_played; }
    bool playMusic(const std::string &path, bool) override
    {
        _music = path;
        return true;
    }
    void stopMusic() override { _music.clear(); }
    void setMasterVolume(float volume) override { _volume = volume; }

    [[nodiscard]] std::size_t soundsPlayed() const { return _played; }
    [[nodiscard]] const std::string &music() const { return _music; }
    [[nodiscard]] float masterVolume() const { return _volume; }

private:
    SoundId _nextSound = 0;
    std::size_t _played = 0;
    std::string _music;
    float _volume = 1.0f;
};

} // namespace engine
