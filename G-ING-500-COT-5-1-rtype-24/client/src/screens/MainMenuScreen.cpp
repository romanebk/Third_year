#include "screens/MainMenuScreen.hpp"

#include "Client.hpp"
#include "game/world.hpp"
#include "network/LocalServer.hpp"
#include "screens/ConnectScreen.hpp"
#include "screens/LobbyScreen.hpp"
#include "screens/SettingsScreen.hpp"
#include "ui/TextUtils.hpp"

namespace client {

namespace {

// The menu is a column on the left; the picture shows on the right.
const float kColumnX = 250.0f;
const float kColumnWidth = 400.0f;

} // namespace

MainMenuScreen::MainMenuScreen(Client &client)
    : Screen(client), _menu(client.getSounds(), 200.0f, kColumnX, kColumnWidth)
{
    _menu.setItems({"Solo game", "Multiplayer", "Settings", "Quit"});
    _client.getSounds().playMusic("menu.ogg");
    _client.getSounds().say("Main menu");
    _menu.speakSelected(false);
}

void MainMenuScreen::startSoloGame()
{
    // Solo: we play on the local server instead of a real one.
    _client.setConnection(
        std::make_unique<LocalServer>(_client.getConfig().difficulty, _client.getConfig().mode));
    _client.getConnection()->connect("localhost", 0, _client.getConfig().playerName);
    _client.changeScreen(std::make_unique<LobbyScreen>(_client));
}

void MainMenuScreen::handleEvent(const sf::Event &event)
{
    if (_menu.handleEvent(event, _client.getWindow()) != MenuAction::Choose) {
        return;
    }
    switch (_menu.getSelected()) {
    case 0:
        startSoloGame();
        break;
    case 1:
        _client.changeScreen(std::make_unique<ConnectScreen>(_client));
        break;
    case 2:
        _client.changeScreen(std::make_unique<SettingsScreen>(_client));
        break;
    case 3:
        _client.quit();
        break;
    default:
        break;
    }
}

void MainMenuScreen::update(float dt)
{
    _client.updateMenuBackground(dt);
}

void MainMenuScreen::draw(sf::RenderWindow &window)
{
    const sf::Font &font = _client.getFont();
    _client.drawMenuBackground(MenuBackground::Layout::Left);
    drawTitle(window, font, "R-TYPE", kColumnX);
    drawText(window, font, "Defend the galaxy against the Bydos!", 12, kColumnX, 110.0f,
             sf::Color(180, 180, 220), true);
    _menu.draw(window, font);
    drawText(window, font, "Arrows + Enter, or the mouse", 10, kColumnX, 500.0f,
             sf::Color(150, 150, 180), true);
}

} // namespace client
