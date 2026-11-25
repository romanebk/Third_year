#include "SoundPlayer.hpp"

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <iostream>

namespace client {

namespace {

// A number said with the voice files 0 to 100, "hundred" and "thousand".
void addNumber(std::vector<std::string> &words, long number)
{
    if (number >= 1000) {
        addNumber(words, number / 1000);
        words.push_back("thousand");
        number %= 1000;
        if (number == 0) {
            return;
        }
    }
    if (number > 100) {
        words.push_back(std::to_string(number / 100));
        words.push_back("hundred");
        number %= 100;
        if (number == 0) {
            return;
        }
    }
    words.push_back(std::to_string(number));
}

void addToken(std::vector<std::string> &words, const std::string &token)
{
    if (token.empty()) {
        return;
    }
    if (std::isdigit(static_cast<unsigned char>(token[0])) == 0) {
        words.push_back(token); // a word
    } else if (token.size() > 9) {
        for (char digit : token) {
            words.push_back(std::string(1, digit)); // too long: digit by digit
        }
    } else {
        addNumber(words, std::stol(token));
    }
}

} // namespace

std::vector<std::string> textToWords(const std::string &text)
{
    std::vector<std::string> words;
    std::string token; // letters only, or digits only
    char previous = ' ';
    for (char c : text) {
        const bool letter = std::isalpha(static_cast<unsigned char>(c)) != 0;
        const bool digit = std::isdigit(static_cast<unsigned char>(c)) != 0;
        const bool tokenIsNumber =
            !token.empty() && std::isdigit(static_cast<unsigned char>(token[0])) != 0;
        // A letter after digits (or the other way round) starts a new token.
        if (!token.empty() && (!(letter || digit) || (digit != tokenIsNumber))) {
            addToken(words, token);
            token.clear();
        }
        if (letter || digit) {
            token += static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        } else if (c == '%') {
            words.push_back("percent");
        } else if (c == '.' && std::isdigit(static_cast<unsigned char>(previous)) != 0) {
            words.push_back("dot");
        }
        previous = c;
    }
    addToken(words, token);
    return words;
}

SoundPlayer::SoundPlayer(AssetManager &assets) : _assets(assets) {}

void SoundPlayer::playSound(const std::string &name)
{
    playSoundAt(name, 0.0f, 1.0f);
}

void SoundPlayer::playSoundAt(const std::string &name, float pan, float pitch)
{
    // Forget the sounds that are finished.
    _sounds.remove_if(
        [](const sf::Sound &sound) { return sound.getStatus() == sf::Sound::Status::Stopped; });
    if (_sounds.size() > 30) {
        return; // too many sounds at the same time
    }
    _sounds.emplace_back(_assets.getSound(name));
    _sounds.back().setVolume(_soundVolume);
    _sounds.back().setPan(std::clamp(pan, -1.0f, 1.0f));
    _sounds.back().setPitch(pitch);
    _sounds.back().play();
}

void SoundPlayer::playMusic(const std::string &name)
{
    if (name == _currentMusic) {
        return; // already playing
    }
    _currentMusic = name;
    if (!_music.openFromFile(_assets.getPath("music/" + name))) {
        std::cerr << "Cannot load music " << name << std::endl;
        return;
    }
    _music.setLooping(true);
    _music.setVolume(_musicVolume);
    _music.play();
}

void SoundPlayer::stopMusic()
{
    _music.stop();
    _currentMusic.clear();
}

void SoundPlayer::setVolumes(int musicVolume, int soundVolume)
{
    _musicVolume = static_cast<float>(musicVolume);
    _music.setVolume(_musicVolume);
    _soundVolume = static_cast<float>(soundVolume);
}

bool SoundPlayer::hasVoice(const std::string &word) const
{
    std::error_code error;
    return std::filesystem::exists(_assets.getPath("voice/" + word + ".ogg"), error);
}

void SoundPlayer::say(const std::string &text, bool interrupt)
{
    if (!_voiceEnabled) {
        return;
    }
    if (interrupt) {
        _words.clear();
        if (_voice) {
            _voice->stop();
        }
    }
    for (const std::string &word : textToWords(text)) {
        if (hasVoice(word)) {
            _words.push_back(word);
            continue;
        }
        for (char letter : word) { // unknown word (a name...): spell it
            if (hasVoice(std::string(1, letter))) {
                _words.push_back(std::string(1, letter));
            }
        }
    }
    update();
}

void SoundPlayer::setVoiceEnabled(bool enabled)
{
    _voiceEnabled = enabled;
    if (!enabled) {
        _words.clear();
        if (_voice) {
            _voice->stop();
        }
    }
}

void SoundPlayer::update()
{
    if (_voice && _voice->getStatus() != sf::Sound::Status::Stopped) {
        return; // still saying the previous word
    }
    if (_words.empty()) {
        return;
    }
    _voice.emplace(_assets.getVoice(_words.front()));
    _words.pop_front();
    _voice->setVolume(_soundVolume);
    _voice->play();
}

} // namespace client
