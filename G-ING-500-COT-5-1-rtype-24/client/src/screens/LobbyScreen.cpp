#include "screens/LobbyScreen.hpp"

#include "Client.hpp"
#include "game/world.hpp"
#include "screens/GameScreen.hpp"
#include "screens/MainMenuScreen.hpp"
#include "ui/TextUtils.hpp"

namespace client {

LobbyScreen::LobbyScreen(Client &client, const std::vector<PlayerInfo> &players)
    : Screen(client), _menu(client.getSounds(), 360.0f), _players(players)
{
    for (PlayerInfo &player : _players) {
        player.ready = false; // everybody has to be ready again
    }
    _menu.setItems({"Ready", "Leave"});
    _client.getSounds().say("Waiting room");
    _menu.speakSelected(false);
}

void LobbyScreen::leave()
{
    _client.closeConnection();
    _client.changeScreen(std::make_unique<MainMenuScreen>(_client));
}

void LobbyScreen::handleEvent(const sf::Event &event)
{
    const MenuAction action = _menu.handleEvent(event, _client.getWindow());
    if (action == MenuAction::Back || (action == MenuAction::Choose && _menu.getSelected() == 1)) {
        leave();
    } else if (action == MenuAction::Choose && _menu.getSelected() == 0) {
        _ready = !_ready;
        _message.clear();
        _client.getConnection()->setReady(_ready);
        _menu.setItems({_ready ? "Not ready" : "Ready", "Leave"});
    }
}

void LobbyScreen::update(float dt)
{
    _client.updateMenuBackground(dt);
    ServerConnection *connection = _client.getConnection();
    if (connection == nullptr) {
        return;
    }
    for (const ServerMessage &message : connection->receive()) {
        if (message.type == MessageType::Welcome) {
            _client.setPlayerId(message.playerId);
            _client.setSnapshotRate(message.snapshotRate);
        } else if (message.type == MessageType::LobbyUpdate) {
            _players = message.players;
        } else if (message.type == MessageType::PlayerLeft) {
            _message = message.text + " left";
            _client.getSounds().say(_message);
        } else if (message.type == MessageType::Error) {
            _message = message.text;
            _ready = false; // the server did not let us in: we can try again
            _menu.setItems({"Ready", "Leave"});
            _client.getSounds().say(_message);
        } else if (message.type == MessageType::GameStart) {
            _client.changeScreen(std::make_unique<GameScreen>(_client));
            return;
        }
    }
}

void LobbyScreen::draw(sf::RenderWindow &window)
{
    const sf::Font &font = _client.getFont();
    _client.drawMenuBackground(MenuBackground::Layout::Center);
    drawTitle(window, font, "WAITING ROOM");

    // One line per player slot (4 players maximum).
    for (int slot = 0; slot < 4; slot++) {
        const float y = 140.0f + static_cast<float>(slot) * 40.0f;
        std::string line = "P" + std::to_string(slot + 1) + "  ";
        sf::Color color(120, 120, 150);
        for (const PlayerInfo &player : _players) {
            if (player.id == slot) {
                line += player.name + (player.ready ? "  READY" : "  waiting...");
                color = player.ready ? sf::Color(120, 255, 120) : sf::Color::White;
            }
        }
        if (color == sf::Color(120, 120, 150)) {
            line += "free";
        }
        drawText(window, font, line, 14, 250.0f, y, color);
    }
    _menu.draw(window, font);
    drawText(window, font, _message, 12, game::kArenaWidth / 2.0f, 460.0f, sf::Color(255, 120, 120),
             true);
}

} // namespace client
