#pragma once

#include "screens/Screen.hpp"
#include "ui/Menu.hpp"
#include "world/ClientWorld.hpp"
#include "world/Prediction.hpp"
#include "world/Sprites.hpp"

#include <SFML/Window/Keyboard.hpp>
#include <cstdint>
#include <set>
#include <string>

namespace client {

// The game itself. Every frame:
// 1. read the messages of the server (snapshots) and update the world;
// 2. 60 times per second, read the keys and send them to the server (the
//    server moves the ships, the client only draws what it receives);
// 3. draw the background, the entities and the HUD.
class GameScreen : public Screen {
public:
    explicit GameScreen(Client &client, bool bossPreview = false);

    void handleEvent(const sf::Event &event) override;
    void update(float dt) override;
    void draw(sf::RenderWindow &window) override;

private:
    // Opens or closes the pause; in a solo game it freezes the local server.
    void setPaused(bool paused);
    void readServerMessages();
    // After a snapshot: our predicted ship goes back to the server position.
    void correctPrediction(const ServerMessage &snapshot);
    void sendInputs(float dt);
    game::Input readKeyboard() const;
    void drawEntity(sf::RenderWindow &window, const ClientEntity &entity);
    void drawBossBall(sf::RenderWindow &window, const ClientEntity &entity);
    void drawBossPreview(sf::RenderWindow &window);
    void drawBossPreviewShots(sf::RenderWindow &window, float bossX, float bossY, float shipX,
                              float shipY);
    void drawHud(sf::RenderWindow &window);
    void drawBossBar(sf::RenderWindow &window);
    void playBossAndBonusSounds(const WorldChanges &changes);
    void showInfo(const std::string &text); // message in the middle, for a few seconds
    // Blind players: a sound placed where entity `id` is compared to our ship
    // (left / right, higher on screen = higher-pitched).
    void playSoundAtEntity(const std::string &name, std::uint32_t id);
    // Blind players (Summary key): the voice says score, lives, weapon, wave, boss.
    void saySummary();
    // A new level or wave begins: big banner ("WAVE 4", "BOSS WAVE 5").
    void startStage(int stage, bool endless);

    ClientWorld _world;
    Prediction _prediction; // our ship moves right away, without waiting for the server
    std::set<sf::Keyboard::Scancode> _pressedKeys; // keys held down right now
    float _inputTimer = 0.0f;
    std::uint32_t _inputNumber = 0;
    float _chargeTime = 0.0f; // how long fire is held (beam gauge)
    bool _paused = false;
    std::string _infoText; // message shown for a few seconds ("X left the game")
    float _infoTime = 0.0f;
    float _bossHitCooldown = 0.0f; // time before the next boss hit sound
    bool _bossPreview = false;
    BossKind _previewBoss = BossKind::Dobkeratops;
    float _previewTime = 0.0f;
    int _stage = 0; // level or wave being played (0 = unknown)
    bool _endless = false;
    bool _bossWave = false;  // endless: this wave ends with a boss
    std::string _bannerText; // big text at the start of a level or wave
    float _bannerTime = 0.0f;
    Menu _pauseMenu;
};

} // namespace client
