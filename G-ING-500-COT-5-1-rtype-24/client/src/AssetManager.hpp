#pragma once

// Loads the textures, fonts and sounds of client/assets once, and gives them
// back by name. Example: assets.getTexture("r-typesheet42.gif").
// If a file is missing, an error is printed and an empty resource is used,
// so the game does not crash.

#include <SFML/Audio/SoundBuffer.hpp>
#include <SFML/Graphics/Font.hpp>
#include <SFML/Graphics/Texture.hpp>
#include <map>
#include <string>

namespace client {

class AssetManager {
public:
    explicit AssetManager(const std::string &folder);

    const sf::Texture &getTexture(const std::string &name);
    const sf::Font &getFont(const std::string &name);
    const sf::SoundBuffer &getSound(const std::string &name);
    // One spoken word, assets/voice/<word>.ogg (accessibility).
    const sf::SoundBuffer &getVoice(const std::string &word);
    // Full path of a file of the asset folder (used for streamed musics).
    std::string getPath(const std::string &file) const;

private:
    // Sounds and voices: `file` is the path in the asset folder.
    const sf::SoundBuffer &loadSound(const std::string &file);

    std::string _folder;
    // std::map never moves its elements, so the references stay valid.
    std::map<std::string, sf::Texture> _textures;
    std::map<std::string, sf::Font> _fonts;
    std::map<std::string, sf::SoundBuffer> _sounds;
};

// Finds the assets folder: next to the executable, else in the current
// folder, else the one of the source code.
std::string findAssetFolder(const std::string &executablePath);

} // namespace client
