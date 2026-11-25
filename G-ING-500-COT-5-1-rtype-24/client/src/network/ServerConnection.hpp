#pragma once

// Interface between the client and "the server".
//
// The client never uses sockets directly: it only talks to a ServerConnection.
// - LocalServer: a local server for the solo game (no network at all).
// - UdpConnection: the real connection to r-type_server, over UDP, with the
//   network library (see UdpConnection.hpp).

#include "game/components.hpp"

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace client {

// One entity sent by the server (a ship, an enemy, a shot, an explosion...).
struct EntityInfo {
    std::uint32_t id = 0;
    game::EntityType type = game::EntityType::Ship;
    int playerId = -1; // 0..3 for a player ship, -1 otherwise
    float x = 0.0f;    // center of the entity, in game units (arena 960 x 540)
    float y = 0.0f;
    int hp = 0; // hit points left (0 when the entity has none)
    // Depends on the type: Ship = lives, Boss = phase (1, then 2 at half
    // health), PickupEnt = game::PickupKind (0 Power, 1 Speed), else 0.
    int extra = 0;
};

struct PlayerInfo {
    int id = 0; // 0..3
    std::string name;
    int score = 0;
    int lives = 0;
    bool alive = true;
    bool ready = false;
    int speedLevel = 0; // speed bonuses taken (only known for us online)
    int forcePower = 0; // power bonuses taken (only known for us online)
};

enum class MessageType {
    Welcome,     // we are connected, `playerId` is our player number
    LobbyUpdate, // list of the players in the waiting room
    GameStart,   // the game begins
    Snapshot,    // state of the whole game at a server tick
    PlayerLeft,  // a player left or crashed (`text` says who)
    GameOver,    // end of the game, `victory` says if we won
    Error        // something went wrong, `text` explains it
};

struct ServerMessage {
    MessageType type = MessageType::Error;
    int playerId = 0;
    // Welcome: number of snapshots per second sent by the server.
    int snapshotRate = 30;
    // Snapshot: number that goes up with each snapshot (server tick or packet
    // sequence number). Used to ignore old snapshots that arrive late.
    std::uint32_t tick = 0;
    // Snapshot: the level (campaign) or the wave (endless) being played, from 1.
    // 0 when the server does not send it (r-type_server does not yet).
    int stage = 0;
    bool endless = false; // Snapshot: the game is in endless mode
    // Snapshot: `seq` of the last of our inputs the server applied (0 = none),
    // for the prediction of our ship.
    std::uint32_t ackInput = 0;
    std::vector<EntityInfo> entities;
    std::vector<PlayerInfo> players;
    std::string text;
    bool victory = false;
};

class ServerConnection {
public:
    virtual ~ServerConnection() = default;

    virtual bool connect(const std::string &host, unsigned short port,
                         const std::string &playerName) = 0;
    virtual void disconnect() = 0;
    virtual void setReady(bool ready) = 0;
    // Sent 60 times per second during the game. `input.seq` goes up each time.
    virtual void sendInput(const game::Input &input) = 0;
    // Called every frame (the local server uses it to run the game).
    virtual void update(float dt) = 0;
    // Pause menu. Only the local server (solo game) can really stop: a real
    // server goes on for the other players, so this does nothing there.
    virtual void setPaused(bool) {}
    // Messages received since the last call.
    virtual std::vector<ServerMessage> receive() = 0;
};

// Creates the real network connection (a UdpConnection).
std::unique_ptr<ServerConnection> createNetworkConnection();

} // namespace client
