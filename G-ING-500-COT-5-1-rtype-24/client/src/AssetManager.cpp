#include "AssetManager.hpp"

#include <filesystem>
#include <iostream>

#ifndef RTYPE_ASSETS_DIR
#define RTYPE_ASSETS_DIR "assets"
#endif

namespace client {

AssetManager::AssetManager(const std::string &folder) : _folder(folder) {}

std::string AssetManager::getPath(const std::string &file) const
{
    return _folder + "/" + file;
}

const sf::Texture &AssetManager::getTexture(const std::string &name)
{
    auto it = _textures.find(name);
    if (it == _textures.end()) {
        sf::Texture texture;
        if (!texture.loadFromFile(getPath("sprites/" + name))) {
            std::cerr << "Cannot load texture " << name << std::endl;
        }
        it = _textures.emplace(name, std::move(texture)).first;
    }
    return it->second;
}

const sf::Font &AssetManager::getFont(const std::string &name)
{
    auto it = _fonts.find(name);
    if (it == _fonts.end()) {
        sf::Font font;
        if (!font.openFromFile(getPath("fonts/" + name))) {
            std::cerr << "Cannot load font " << name << std::endl;
        }
        it = _fonts.emplace(name, std::move(font)).first;
    }
    return it->second;
}

const sf::SoundBuffer &AssetManager::getSound(const std::string &name)
{
    return loadSound("sounds/" + name);
}

const sf::SoundBuffer &AssetManager::getVoice(const std::string &word)
{
    return loadSound("voice/" + word + ".ogg");
}

const sf::SoundBuffer &AssetManager::loadSound(const std::string &file)
{
    auto it = _sounds.find(file);
    if (it == _sounds.end()) {
        sf::SoundBuffer buffer;
        if (!buffer.loadFromFile(getPath(file))) {
            std::cerr << "Cannot load sound " << file << std::endl;
        }
        it = _sounds.emplace(file, std::move(buffer)).first;
    }
    return it->second;
}

std::string findAssetFolder(const std::string &executablePath)
{
    namespace fs = std::filesystem;
    std::error_code error;
    const fs::path nextToExe = fs::absolute(executablePath, error).parent_path() / "assets";
    if (fs::is_directory(nextToExe, error)) {
        return nextToExe.string();
    }
    if (fs::is_directory("assets", error)) {
        return "assets";
    }
    return RTYPE_ASSETS_DIR;
}

} // namespace client
