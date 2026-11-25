#pragma once

// The client application: it owns the window, the assets, the sounds, the
// settings and the connection to the server, and runs the main loop.

#include "AssetManager.hpp"
#include "Config.hpp"
#include "SoundPlayer.hpp"
#include "network/ServerConnection.hpp"
#include "render/Background.hpp"
#include "render/MenuBackground.hpp"
#include "render/ScrollingBackground.hpp"
#include "screens/Screen.hpp"

#include <SFML/Graphics/RenderWindow.hpp>
#include <memory>
#include <string>

namespace client {

// Options of the command line (see main.cpp).
struct LaunchOptions {
    std::string host;
    unsigned short port = 0;
    std::string name;
    std::string configFile = "client.cfg";
    bool bossPreview = false;
};

class Client {
public:
    Client(const std::string &assetFolder, const LaunchOptions &options);

    void run();
    void quit();
    // The new screen replaces the current one at the next frame.
    void changeScreen(std::unique_ptr<Screen> screen);

    sf::RenderWindow &getWindow() { return _window; }
    AssetManager &getAssets() { return _assets; }
    SoundPlayer &getSounds() { return _sounds; }
    Config &getConfig() { return _config; }
    Background &getBackground() { return _background; }
    // Menu screens: the picture if it exists, else the star field.
    void updateMenuBackground(float dt);
    void drawMenuBackground(MenuBackground::Layout layout);
    // The game: the scrolling picture with the stars over it, or the stars alone.
    void updateGameBackground(float dt);
    void drawGameBackground(int stage); // stage: level or wave, 0 = unknown
    // Fullscreen on or off (F11). The game keeps its proportions in both.
    void toggleFullscreen();
    const sf::Font &getFont();
    void saveConfig();

    // Connection to the server (nullptr when not connected).
    ServerConnection *getConnection() { return _connection.get(); }
    void setConnection(std::unique_ptr<ServerConnection> connection);
    void closeConnection();
    // Our player number (0 to 3), given by the server in the Welcome message.
    int getPlayerId() const { return _playerId; }
    void setPlayerId(int playerId) { _playerId = playerId; }
    // Snapshots per second of the server (Welcome message), for interpolation.
    int getSnapshotRate() const { return _snapshotRate; }
    void setSnapshotRate(int snapshotRate) { _snapshotRate = snapshotRate; }

private:
    // Settings that must be applied again each time the window is created.
    void applyWindowSettings();
    // Fits the game area (960 x 540) in the window, centered, with its proportions.
    void updateView();

    sf::RenderWindow _window;
    AssetManager _assets;
    SoundPlayer _sounds;
    Config _config;
    std::string _configFile;
    Background _background;
    MenuBackground _menuBackground;
    ScrollingBackground _gameBackground;
    std::unique_ptr<ServerConnection> _connection;
    int _playerId = 0;
    int _snapshotRate = 30;
    std::unique_ptr<Screen> _screen;
    std::unique_ptr<Screen> _nextScreen;
    bool _running = true;
    bool _fullscreen = false;
    sf::Vector2u _windowedSize{1280, 720}; // size to come back to after the fullscreen
};

} // namespace client
