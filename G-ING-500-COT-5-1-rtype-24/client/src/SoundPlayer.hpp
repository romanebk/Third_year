#pragma once

// Plays the sound effects, the music, and the voice that reads the menus and
// the game for blind players. The voice is made of one file per word
// (assets/voice/<word>.ogg, see scripts/make_sounds.sh), played one after the
// other.

#include "AssetManager.hpp"

#include <SFML/Audio/Music.hpp>
#include <SFML/Audio/Sound.hpp>
#include <deque>
#include <list>
#include <optional>
#include <string>
#include <vector>

namespace client {

// The words to say for a text, in lower case: "Music: 50%" gives
// {"music", "50", "percent"}. Numbers above 100 use "thousand" and "hundred"
// (1250 gives {"1", "thousand", "2", "hundred", "50"}). Other characters are
// skipped, except '%' ("percent") and a '.' after a digit ("dot", addresses).
std::vector<std::string> textToWords(const std::string &text);

class SoundPlayer {
public:
    explicit SoundPlayer(AssetManager &assets);

    void playSound(const std::string &name); // file in assets/sounds/
    // A sound placed in space: `pan` from -1 (left) to 1 (right), `pitch` 1 is
    // normal, higher is more high-pitched.
    void playSoundAt(const std::string &name, float pan, float pitch);
    void playMusic(const std::string &name); // file in assets/music/, loops
    void stopMusic();
    void setVolumes(int musicVolume, int soundVolume); // 0 to 100

    // Says a text. `interrupt`: stop what is being said first (like a screen
    // reader when the selection changes); otherwise it is said after it.
    // A word with no voice file is spelled letter by letter.
    void say(const std::string &text, bool interrupt = true);
    void setVoiceEnabled(bool enabled);
    // Called every frame: starts the next word when the previous one is over.
    void update();

private:
    bool hasVoice(const std::string &word) const;

    AssetManager &_assets;
    std::list<sf::Sound> _sounds; // sounds currently playing
    sf::Music _music;
    std::string _currentMusic;
    float _musicVolume = 50.0f;
    float _soundVolume = 80.0f;
    bool _voiceEnabled = true;
    std::optional<sf::Sound> _voice; // the word being said
    std::deque<std::string> _words;  // the words still to say
};

} // namespace client
