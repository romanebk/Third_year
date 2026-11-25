#pragma once

#include <cstdint>
#include <optional>
#include <string>

namespace engine {

using SoundId = std::uint32_t;

// Sound effects and background music. Implementations: engine::sfml::SfmlAudio
// (module engine_sfml) and engine::NullAudio (silent: server, tests).
class IAudio {
public:
    IAudio() = default;
    IAudio(const IAudio &) = delete;
    IAudio &operator=(const IAudio &) = delete;
    IAudio(IAudio &&) = delete;
    IAudio &operator=(IAudio &&) = delete;
    virtual ~IAudio() = default;

    // Loads a short sound in memory; std::nullopt if the file cannot be loaded.
    virtual std::optional<SoundId> loadSound(const std::string &path) = 0;
    // volume in [0, 1], multiplied by the master volume. Unknown ids are ignored.
    virtual void playSound(SoundId sound, float volume = 1.0f) = 0;

    // Streams a music file; false if it cannot be opened.
    virtual bool playMusic(const std::string &path, bool loop = true) = 0;
    virtual void stopMusic() = 0;

    // Master volume in [0, 1], applied to sounds and music.
    virtual void setMasterVolume(float volume) = 0;
};

} // namespace engine
