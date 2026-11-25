#include "network/LocalServer.hpp"

#include "game/ecs_helpers.hpp"
#include "game/level.hpp"
#include "game/player.hpp"
#include "game/setup.hpp"
#include "game/snapshot.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"

namespace client {

namespace {

const int kLocalPlayer = 0;      // the only player of a solo game
const int kTicksPerSecond = 60;  // game::kTickDt
const int kTicksPerSnapshot = 2; // 60 ticks per second -> 30 snapshots per second

} // namespace

LocalServer::LocalServer(game::Difficulty difficulty, game::GameMode mode)
    : _difficulty(difficulty), _mode(mode)
{
}

bool LocalServer::connect(const std::string &, unsigned short, const std::string &playerName)
{
    _playerName = playerName;
    ServerMessage welcome;
    welcome.type = MessageType::Welcome;
    welcome.playerId = kLocalPlayer;
    welcome.snapshotRate = kTicksPerSecond / kTicksPerSnapshot;
    _messages.push_back(welcome);

    ServerMessage lobby;
    lobby.type = MessageType::LobbyUpdate;
    lobby.players = makePlayerList();
    _messages.push_back(lobby);
    return true;
}

void LocalServer::disconnect()
{
    _playing = false;
    _registry.reset();
}

void LocalServer::setReady(bool ready)
{
    _ready = ready;
    ServerMessage lobby;
    lobby.type = MessageType::LobbyUpdate;
    lobby.players = makePlayerList();
    _messages.push_back(lobby);
    // Alone in the room: the game starts as soon as we are ready.
    if (_ready && !_playing) {
        startGame();
    }
}

void LocalServer::sendInput(const game::Input &input)
{
    if (_paused) {
        return; // not kept: they would all be played again after the pause
    }
    _inputs.push_back(input);
}

void LocalServer::startGame()
{
    _registry = std::make_unique<engine::Registry>();
    game::registerGameComponents(*_registry);
    // Before the level and the ship: they read the rules when they are created.
    game::Rules rules = game::rulesFor(_difficulty);
    rules.mode = _mode;
    game::setRules(*_registry, rules);
    game::startCampaign(*_registry); // level 1, then level 2
    game::spawnPlayer(*_registry, kLocalPlayer);
    _playing = true;
    _tick = 0;
    _timer = 0.0f;
    _inputs.clear();
    _lastInput = game::Input{};

    ServerMessage start;
    start.type = MessageType::GameStart;
    _messages.push_back(start);
}

void LocalServer::update(float dt)
{
    if (!_playing || _paused) {
        return;
    }
    // Fixed time step: always 60 ticks per second, whatever the frame rate.
    _timer += dt;
    while (_timer >= game::kTickDt && _playing) {
        _timer -= game::kTickDt;
        step();
    }
}

void LocalServer::step()
{
    // The client sends one input per tick: apply the oldest one.
    if (!_inputs.empty()) {
        _lastInput = _inputs.front();
        _inputs.pop_front();
    }
    game::forEach<game::Input, game::Player>(
        *_registry, [this](engine::Entity, game::Input &input, game::Player &player) {
            if (player.playerId == kLocalPlayer) {
                input = _lastInput;
            }
        });

    game::stepGame(*_registry, game::kTickDt);
    _tick++;

    if (_tick % kTicksPerSnapshot == 0) {
        _messages.push_back(makeSnapshot());
    }

    const bool defeat = game::allPlayersGameOver(*_registry);
    const bool victory = game::isCampaignCleared(*_registry); // the last level
    if (defeat || victory) {
        ServerMessage end;
        end.type = MessageType::GameOver;
        end.victory = victory;
        end.players = makePlayerList();
        _messages.push_back(end);
        _playing = false;
        _ready = false;
    }
}

ServerMessage LocalServer::makeSnapshot()
{
    ServerMessage snapshot;
    snapshot.type = MessageType::Snapshot;
    snapshot.tick = _tick;

    // Same replication rules as r-type_server: dead ships are hidden, netIds,
    // hit points, boss phase, kind of bonus...
    const game::Snapshot full = game::collectSnapshot(*_registry);
    snapshot.stage = full.stage;
    snapshot.endless = _mode == game::GameMode::Endless;
    snapshot.ackInput = _lastInput.seq; // inputs are applied in order, one per tick
    for (const game::SnapshotEntity &entity : full.entities) {
        EntityInfo info;
        info.id = entity.netId;
        info.type = entity.type;
        const auto team = static_cast<int>(entity.team);
        info.playerId = team < game::kMaxPlayers ? team : -1; // teams P0..P3
        info.x = entity.x;
        info.y = entity.y;
        info.hp = entity.hp;
        info.extra = entity.extra;
        snapshot.entities.push_back(info);
    }
    snapshot.players = makePlayerList();
    return snapshot;
}

std::vector<PlayerInfo> LocalServer::makePlayerList()
{
    std::vector<PlayerInfo> players;
    if (!_registry) {
        PlayerInfo me;
        me.id = kLocalPlayer;
        me.name = _playerName;
        me.lives = game::rulesFor(_difficulty).startingLives;
        me.ready = _ready;
        players.push_back(me);
        return players;
    }
    game::forEach<game::Player>(*_registry, [&](engine::Entity ship, game::Player &player) {
        PlayerInfo info;
        info.id = player.playerId;
        info.name = _playerName;
        info.score = player.score;
        info.lives = player.lives;
        info.alive = player.alive;
        info.ready = true;
        if (const auto *power = _registry->getComponent<game::PowerState>(ship)) {
            info.speedLevel = power->speedLevel;
            info.forcePower = power->forcePower;
        }
        players.push_back(info);
    });
    return players;
}

std::vector<ServerMessage> LocalServer::receive()
{
    std::vector<ServerMessage> messages = _messages;
    _messages.clear();
    return messages;
}

} // namespace client
