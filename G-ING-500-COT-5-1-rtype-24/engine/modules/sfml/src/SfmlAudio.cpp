#include "engine/sfml/SfmlAudio.hpp"

#include <SFML/Audio/Music.hpp>
#include <SFML/Audio/Sound.hpp>
#include <SFML/Audio/SoundBuffer.hpp>
#include <algorithm>
#include <list>
#include <vector>

namespace engine::sfml {

namespace {
constexpr std::size_t kMaxPlayingSounds = 32;
} // namespace

struct SfmlAudio::Impl {
    // unique_ptr: a playing sf::Sound points to its buffer, which must not move.
    std::vector<std::unique_ptr<sf::SoundBuffer>> buffers;
    std::list<sf::Sound> playing;
    sf::Music music;
    float master = 1.0f;
};

SfmlAudio::SfmlAudio() : _impl(std::make_unique<Impl>()) {}

SfmlAudio::~SfmlAudio() = default;

std::optional<SoundId> SfmlAudio::loadSound(const std::string &path)
{
    auto buffer = std::make_unique<sf::SoundBuffer>();
    if (!buffer->loadFromFile(path)) {
        return std::nullopt;
    }
    _impl->buffers.push_back(std::move(buffer));
    return static_cast<SoundId>(_impl->buffers.size() - 1);
}

void SfmlAudio::playSound(SoundId sound, float volume)
{
    if (sound >= _impl->buffers.size()) {
        return;
    }
    _impl->playing.remove_if(
        [](const sf::Sound &s) { return s.getStatus() == sf::Sound::Status::Stopped; });
    if (_impl->playing.size() >= kMaxPlayingSounds) {
        return;
    }
    sf::Sound &s = _impl->playing.emplace_back(*_impl->buffers[sound]);
    s.setVolume(100.0f * std::clamp(volume, 0.0f, 1.0f) * _impl->master);
    s.play();
}

bool SfmlAudio::playMusic(const std::string &path, bool loop)
{
    if (!_impl->music.openFromFile(path)) {
        return false;
    }
    _impl->music.setLooping(loop);
    _impl->music.setVolume(100.0f * _impl->master);
    _impl->music.play();
    return true;
}

void SfmlAudio::stopMusic()
{
    _impl->music.stop();
}

void SfmlAudio::setMasterVolume(float volume)
{
    _impl->master = std::clamp(volume, 0.0f, 1.0f);
    _impl->music.setVolume(100.0f * _impl->master);
}

} // namespace engine::sfml
