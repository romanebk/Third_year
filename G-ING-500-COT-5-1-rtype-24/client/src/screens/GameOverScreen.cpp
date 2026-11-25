#include "screens/GameOverScreen.hpp"

#include "Client.hpp"
#include "game/world.hpp"
#include "screens/LobbyScreen.hpp"
#include "screens/MainMenuScreen.hpp"
#include "ui/TextUtils.hpp"

#include <string>

namespace client {

GameOverScreen::GameOverScreen(Client &client, bool victory, const std::vector<PlayerInfo> &players,
                               int endlessWave)
    : Screen(client), _menu(client.getSounds(), 380.0f), _victory(victory), _players(players),
      _endlessWave(endlessWave)
{
    _menu.setItems({"Play again", "Main menu"});
    SoundPlayer &sounds = _client.getSounds();
    sounds.stopMusic();
    // A sound and the voice for blind players: the result, the wave, our score.
    sounds.playSound(_victory ? "victory.ogg" : "game_over.ogg");
    std::string text = _victory ? "Victory" : "Game over";
    if (_endlessWave > 0) {
        text += " wave " + std::to_string(_endlessWave);
    }
    for (const PlayerInfo &player : _players) {
        if (player.id == _client.getPlayerId()) {
            text += " score " + std::to_string(player.score);
        }
    }
    sounds.say(text);
    _menu.speakSelected(false);
}

void GameOverScreen::handleEvent(const sf::Event &event)
{
    // Players are often still pressing fire when the game ends: ignore the
    // keys for a short time so the scores are not skipped by accident.
    if (_waitTime > 0.0f) {
        return;
    }
    const MenuAction action = _menu.handleEvent(event, _client.getWindow());
    if (action == MenuAction::Choose && _menu.getSelected() == 0) {
        // Back to the waiting room of the same server.
        _client.changeScreen(std::make_unique<LobbyScreen>(_client, _players));
    } else if (action == MenuAction::Back ||
               (action == MenuAction::Choose && _menu.getSelected() == 1)) {
        _client.closeConnection();
        _client.changeScreen(std::make_unique<MainMenuScreen>(_client));
    }
}

void GameOverScreen::update(float dt)
{
    _waitTime -= dt;
    _client.updateMenuBackground(dt);
}

void GameOverScreen::draw(sf::RenderWindow &window)
{
    const sf::Font &font = _client.getFont();
    _client.drawMenuBackground(MenuBackground::Layout::Center);
    std::string title = _victory ? "VICTORY!" : "GAME OVER";
    float y = 160.0f;
    if (_endlessWave > 0) {
        // Endless: nobody wins, what counts is how far you went and the score.
        title = "GAME OVER - WAVE " + std::to_string(_endlessWave);
        drawText(window, font, "FINAL SCORE", 14, game::kArenaWidth / 2.0f, 120.0f,
                 sf::Color(120, 220, 255), true);
    }
    drawTitle(window, font, title);
    for (const PlayerInfo &player : _players) {
        drawText(window, font,
                 "P" + std::to_string(player.id + 1) + " " + player.name + "   " +
                     std::to_string(player.score) + " pts",
                 14, game::kArenaWidth / 2.0f, y, sf::Color::White, true);
        y += 36.0f;
    }
    _menu.draw(window, font);
}

} // namespace client
