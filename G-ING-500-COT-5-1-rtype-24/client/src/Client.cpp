#include "Client.hpp"

#include "game/world.hpp"
#include "render/Viewport.hpp"
#include "screens/ConnectScreen.hpp"
#include "screens/GameScreen.hpp"
#include "screens/MainMenuScreen.hpp"

#include <SFML/System/Clock.hpp>

namespace client {

namespace {

// Window size: 1280 x 720, or 960 x 540 if the screen is too small.
sf::Vector2u chooseWindowSize()
{
    const sf::Vector2u screen = sf::VideoMode::getDesktopMode().size;
    if (screen.x < 1360 || screen.y < 800) {
        return {960, 540};
    }
    return {1280, 720};
}

const char *const kWindowTitle = "R-Type";
// The window can be resized down to this size (16:9, a quarter of the game area).
const sf::Vector2u kMinimumWindowSize{640, 360};

} // namespace

Client::Client(const std::string &assetFolder, const LaunchOptions &options)
    : _window(sf::VideoMode(chooseWindowSize()), kWindowTitle, sf::Style::Default),
      _assets(assetFolder), _sounds(_assets), _configFile(options.configFile),
      _menuBackground(_assets.getPath("backgrounds/menu.jpg")),
      _gameBackground(_assets.getPath("backgrounds/game.jpg"))
{
    // Open the window in the middle of the screen.
    const sf::Vector2u screen = sf::VideoMode::getDesktopMode().size;
    const sf::Vector2u size = _window.getSize();
    _window.setPosition({(static_cast<int>(screen.x) - static_cast<int>(size.x)) / 2,
                         (static_cast<int>(screen.y) - static_cast<int>(size.y)) / 2});
    _windowedSize = _window.getSize();
    applyWindowSettings();

    _config.load(_configFile);
    if (!options.name.empty()) {
        _config.playerName = options.name;
    }
    if (!options.host.empty()) {
        _config.host = options.host;
    }
    if (options.port != 0) {
        _config.port = options.port;
    }
    _sounds.setVolumes(_config.musicVolume, _config.soundVolume);
    _sounds.setVoiceEnabled(_config.voice);

    if (options.bossPreview) {
        _screen = std::make_unique<GameScreen>(*this, true);
    } else if (!options.host.empty()) {
        // With --host, go straight to the connection screen.
        _screen = std::make_unique<ConnectScreen>(*this);
    } else {
        _screen = std::make_unique<MainMenuScreen>(*this);
    }
}

void Client::applyWindowSettings()
{
    _window.setFramerateLimit(60);
    _window.setKeyRepeatEnabled(false); // one KeyPressed event per key press
    _window.setMinimumSize(kMinimumWindowSize);
    updateView();
}

void Client::updateView()
{
    // The game uses its own coordinates (960 x 540, like the server), whatever
    // the size of the window. The view is scaled to the window and centered:
    // the game keeps its proportions, the rest of the window stays black. The
    // mouse follows (mapPixelToCoords takes the view into account).
    sf::View view(sf::FloatRect({0.0f, 0.0f}, {game::kArenaWidth, game::kArenaHeight}));
    view.setViewport(letterboxViewport(_window.getSize(), game::kArenaWidth, game::kArenaHeight));
    _window.setView(view);
}

void Client::toggleFullscreen()
{
    _fullscreen = !_fullscreen;
    if (_fullscreen) {
        _windowedSize = _window.getSize();
        _window.create(sf::VideoMode::getDesktopMode(), kWindowTitle, sf::Style::Default,
                       sf::State::Fullscreen);
    } else {
        _window.create(sf::VideoMode(_windowedSize), kWindowTitle, sf::Style::Default,
                       sf::State::Windowed);
    }
    applyWindowSettings();
}

const sf::Font &Client::getFont()
{
    return _assets.getFont("PressStart2P-Regular.ttf");
}

void Client::saveConfig()
{
    _config.save(_configFile);
    _sounds.setVolumes(_config.musicVolume, _config.soundVolume);
    _sounds.setVoiceEnabled(_config.voice);
}

void Client::changeScreen(std::unique_ptr<Screen> screen)
{
    _nextScreen = std::move(screen);
}

void Client::setConnection(std::unique_ptr<ServerConnection> connection)
{
    closeConnection();
    _connection = std::move(connection);
}

void Client::closeConnection()
{
    if (_connection) {
        _connection->disconnect();
        _connection.reset();
    }
}

void Client::updateMenuBackground(float dt)
{
    _menuBackground.update(dt);
    _background.update(dt);
}

void Client::drawMenuBackground(MenuBackground::Layout layout)
{
    if (_menuBackground.isLoaded()) {
        _menuBackground.draw(_window, layout);
    } else {
        _background.draw(_window);
    }
}

void Client::updateGameBackground(float dt)
{
    _gameBackground.update(dt);
    _background.update(dt);
}

void Client::drawGameBackground(int stage)
{
    if (_gameBackground.isLoaded()) {
        _gameBackground.draw(_window, stage);
        _background.drawStars(_window);
    } else {
        _background.draw(_window);
    }
}

void Client::quit()
{
    _running = false;
}

void Client::run()
{
    sf::Clock clock;
    while (_running && _window.isOpen()) {
        // A screen cannot delete itself while it runs: the change happens here.
        if (_nextScreen) {
            _screen = std::move(_nextScreen);
        }

        float dt = clock.restart().asSeconds();
        if (dt > 0.1f) {
            dt = 0.1f; // after a freeze, do not jump too far
        }

        while (const std::optional<sf::Event> event = _window.pollEvent()) {
            const auto *key = event->getIf<sf::Event::KeyPressed>();
            if (event->is<sf::Event::Closed>()) {
                _running = false;
            } else if (event->is<sf::Event::Resized>()) {
                updateView(); // the window was resized, maximized or restored
            } else if (key != nullptr && key->code == sf::Keyboard::Key::F11) {
                toggleFullscreen();
            } else {
                _screen->handleEvent(*event);
            }
        }

        // Network first: the local server runs here, then the screen reads
        // the received messages in its update.
        if (_connection) {
            _connection->update(dt);
        }
        _screen->update(dt);
        _sounds.update(); // the voice says its next word

        _window.clear(sf::Color::Black);
        _screen->draw(_window);
        _window.display();
    }
    closeConnection();
    _config.save(_configFile);
    _window.close();
}

} // namespace client
