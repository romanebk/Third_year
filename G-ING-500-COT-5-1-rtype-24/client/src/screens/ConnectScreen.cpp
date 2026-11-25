#include "screens/ConnectScreen.hpp"

#include "Client.hpp"
#include "game/world.hpp"
#include "screens/LobbyScreen.hpp"
#include "screens/MainMenuScreen.hpp"
#include "ui/TextUtils.hpp"

namespace client {

namespace {

// Menu lines
const int kAddressLine = 0;
const int kPortLine = 1;
const int kNameLine = 2;
const int kConnectLine = 3;
const int kBackLine = 4;

} // namespace

ConnectScreen::ConnectScreen(Client &client, const std::string &message)
    : Screen(client), _menu(client.getSounds(), 160.0f),
      _port(std::to_string(client.getConfig().port)), _message(message)
{
    refreshItems();
    _client.getSounds().say("Multiplayer");
    _client.getSounds().say(_message, false); // why the connection was lost
    _menu.speakSelected(false);
}

void ConnectScreen::refreshItems()
{
    const Config &config = _client.getConfig();
    _menu.setItems({"Address: " + config.host, "Port: " + _port, "Name: " + config.playerName,
                    "Connect", "Back"});
}

void ConnectScreen::connect()
{
    Config &config = _client.getConfig();
    const int port = _port.empty() ? 0 : std::stoi(_port);
    if (port <= 0 || port > 65535) {
        _message = "The port must be between 1 and 65535";
        _client.getSounds().say(_message);
        return;
    }
    if (config.playerName.empty()) {
        config.playerName = "Player";
    }
    config.port = static_cast<unsigned short>(port);
    _client.saveConfig();

    std::unique_ptr<ServerConnection> connection = createNetworkConnection();
    if (!connection->connect(config.host, config.port, config.playerName)) {
        _message = "Unknown address: " + config.host;
        _client.getSounds().say(_message);
        return;
    }
    _client.setConnection(std::move(connection));
    _client.changeScreen(std::make_unique<LobbyScreen>(_client));
}

void ConnectScreen::handleEvent(const sf::Event &event)
{
    Config &config = _client.getConfig();
    const int line = _menu.getSelected();

    // Typing in the selected field.
    if (const auto *text = event.getIf<sf::Event::TextEntered>()) {
        const char32_t c = text->unicode;
        const bool printable = c >= 32 && c < 127;
        bool typed = true;
        if (line == kAddressLine && printable && c != ' ' && config.host.size() < 40) {
            config.host += static_cast<char>(c);
        } else if (line == kPortLine && c >= '0' && c <= '9' && _port.size() < 5) {
            _port += static_cast<char>(c);
        } else if (line == kNameLine && printable && config.playerName.size() < 12) {
            config.playerName += static_cast<char>(c);
        } else {
            typed = false; // Enter, Backspace, a letter in the port...
        }
        refreshItems();
        if (typed) { // the voice says the character typed
            _client.getSounds().say(c == '.' ? "dot" : std::string(1, static_cast<char>(c)));
        }
        return;
    }
    if (const auto *key = event.getIf<sf::Event::KeyPressed>()) {
        if (key->code == sf::Keyboard::Key::Backspace) {
            if (line == kAddressLine && !config.host.empty()) {
                config.host.pop_back();
            } else if (line == kPortLine && !_port.empty()) {
                _port.pop_back();
            } else if (line == kNameLine && !config.playerName.empty()) {
                config.playerName.pop_back();
            }
            refreshItems();
            _client.getSounds().say("delete");
            return;
        }
        // Space is a normal character in the text fields.
        if (key->code == sf::Keyboard::Key::Space && line <= kNameLine) {
            return;
        }
    }

    const MenuAction action = _menu.handleEvent(event, _client.getWindow());
    if (action == MenuAction::Back || (action == MenuAction::Choose && line == kBackLine)) {
        _client.saveConfig();
        _client.changeScreen(std::make_unique<MainMenuScreen>(_client));
    } else if (action == MenuAction::Choose && line == kConnectLine) {
        connect();
    }
}

void ConnectScreen::update(float dt)
{
    _client.updateMenuBackground(dt);
}

void ConnectScreen::draw(sf::RenderWindow &window)
{
    const sf::Font &font = _client.getFont();
    _client.drawMenuBackground(MenuBackground::Layout::Center);
    drawTitle(window, font, "MULTIPLAYER");
    _menu.draw(window, font);
    drawText(window, font, _message, 12, game::kArenaWidth / 2.0f, 380.0f, sf::Color(255, 120, 120),
             true);
    drawText(window, font, "Select a line and type. Backspace erases.", 10,
             game::kArenaWidth / 2.0f, 500.0f, sf::Color(150, 150, 180), true);
}

} // namespace client
