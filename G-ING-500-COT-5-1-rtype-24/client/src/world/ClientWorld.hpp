#pragma once

// The game world as the client sees it, rebuilt from the server snapshots.
// This file does not use SFML: it only stores positions.
//
// The server sends 20 or 30 snapshots per second but we draw 60 images per
// second. To avoid entities jumping from one position to the next, each
// entity slides from its previous position to the new one: this is called
// interpolation. All entities (our ship included) are handled the same way:
// the client only shows what the server decided.

#include "network/ServerConnection.hpp"

#include <cstdint>
#include <map>
#include <vector>

namespace client {

struct ClientEntity {
    std::uint32_t id = 0;
    game::EntityType type = game::EntityType::Ship;
    int playerId = -1;
    float x = 0.0f; // position drawn on screen
    float y = 0.0f;
    float startX = 0.0f; // interpolation: from (startX, startY) ...
    float startY = 0.0f;
    float targetX = 0.0f; // ... to (targetX, targetY)
    float targetY = 0.0f;
    float progress = 1.0f; // 0 = at start, 1 = at target
    float speedY = 0.0f;   // vertical speed, used to tilt the ship sprite
    float age = 0.0f;      // seconds since it appeared (animations)
    int hp = 0;
    int maxHp = 0; // highest hp seen: the boss appears with all its hit points
    int extra = 0; // see EntityInfo
};

// What changed in a snapshot, to play sounds and effects.
struct WorldChanges {
    int newPlayerShots = 0;
    int newExplosions = 0;
    bool localShipDestroyed = false;
    bool bossAppeared = false;
    bool bossHit = false;     // the boss lost hit points
    bool bossEnraged = false; // the boss went to phase 2
    bool bossDestroyed = false;
    int powerPickups = 0; // bonuses collected by a ship
    int speedPickups = 0;
    // To place the sounds left / right (blind players): the id of one new
    // enemy and of one new explosion, 0 if there is none.
    std::uint32_t newEnemy = 0;
    std::uint32_t newExplosion = 0;
};

class ClientWorld {
public:
    void setLocalPlayer(int playerId) { _localPlayer = playerId; }
    // Snapshots per second of the server: an entity takes this long to slide
    // to its new position. 30 by default (local server), 20 for r-type_server.
    void setSnapshotRate(int snapshotRate);
    int getLocalPlayer() const { return _localPlayer; }

    WorldChanges applySnapshot(const ServerMessage &snapshot);
    // Moves the entities toward their target positions.
    void update(float dt);

    const std::map<std::uint32_t, ClientEntity> &getEntities() const { return _entities; }
    const std::vector<PlayerInfo> &getPlayers() const { return _players; }
    // The boss, or nullptr when there is none on screen.
    const ClientEntity *getBoss() const;
    // Our own ship, or nullptr when it is not on screen (dead).
    const ClientEntity *getLocalShip() const;
    void clear();

private:
    std::map<std::uint32_t, ClientEntity> _entities;
    std::vector<PlayerInfo> _players;
    int _localPlayer = 0;
    float _snapshotInterval = 1.0f / 30.0f; // seconds between two snapshots
    std::uint32_t _lastTick = 0;
    bool _hasSnapshot = false;
};

} // namespace client
