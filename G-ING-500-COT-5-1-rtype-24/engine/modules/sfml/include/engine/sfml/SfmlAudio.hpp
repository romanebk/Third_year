#pragma once

#include "engine/subsystems/IAudio.hpp"

#include <memory>

namespace engine::sfml {

// IAudio over SFML Audio, hidden behind a Pimpl like SfmlGraphics.
class SfmlAudio final : public IAudio {
public:
    SfmlAudio();
    ~SfmlAudio() override;

    std::optional<SoundId> loadSound(const std::string &path) override;
    void playSound(SoundId sound, float volume) override;
    bool playMusic(const std::string &path, bool loop) override;
    void stopMusic() override;
    void setMasterVolume(float volume) override;

private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};

} // namespace engine::sfml
