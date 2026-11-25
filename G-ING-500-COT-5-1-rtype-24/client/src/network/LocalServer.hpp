#pragma once

// Local server of the solo game: no network at all.
//
// It does not reimplement the game: it calls the gameplay code of the `game`
// library (game::stepGame, game::collectSnapshot), exactly like r-type_server.
// It only replaces the network part: messages are put in a list instead of
// being sent.

#include "engine/ecs/Registry.hpp"
#include "game/rules.hpp"
#include "network/ServerConnection.hpp"

#include <deque>
#include <memory>
#include <string>
#include <vector>

namespace client {

class LocalServer : public ServerConnection {
public:
    explicit LocalServer(game::Difficulty difficulty = game::Difficulty::Normal,
                         game::GameMode mode = game::GameMode::Campaign);

    bool connect(const std::string &host, unsigned short port,
                 const std::string &playerName) override;
    void disconnect() override;
    void setReady(bool ready) override;
    void sendInput(const game::Input &input) override;
    void update(float dt) override;
    void setPaused(bool paused) override { _paused = paused; }
    std::vector<ServerMessage> receive() override;

private:
    void startGame();
    void step();
    ServerMessage makeSnapshot();
    std::vector<PlayerInfo> makePlayerList();

    game::Difficulty _difficulty;
    game::GameMode _mode;
    std::string _playerName = "Player";
    bool _ready = false;
    bool _playing = false;
    bool _paused = false; // the game is frozen: no tick, no input
    std::unique_ptr<engine::Registry> _registry;
    std::deque<game::Input> _inputs; // inputs received, applied one per tick
    game::Input _lastInput;
    std::uint32_t _tick = 0;
    float _timer = 0.0f;
    std::vector<ServerMessage> _messages; // messages waiting for receive()
};

} // namespace client
