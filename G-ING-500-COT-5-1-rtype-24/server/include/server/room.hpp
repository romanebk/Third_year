#pragma once

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/Registry.hpp"
#include "game/level.hpp"
#include "game/rules.hpp"
#include "game/snapshot.hpp"
#include "game/tick.hpp"
#include "game/world.hpp"
#include "network/packet.hpp"

#include <cstdint>
#include <unordered_map>
#include <vector>

namespace server {

// One reliable event of the room, already encoded with its UDP header: the
// datagram the clients receive and the eventSeq they must ack (§5).
struct ReliableEvent {
    std::uint16_t eventSeq = 0;
    std::vector<std::uint8_t> datagram;
};

// Authoritative simulation of one room (docs/game-design.md §9): it owns the
// game Registry, maps each accepted player id to its ship, and turns the
// registry into SNAPSHOT payloads (docs/rfc-protocol.md §7).
//
// It has no socket: the caller feeds it the decoded client messages and sends
// back the datagrams it builds. That keeps the room testable without network.
class Room {
public:
    // `difficulty` and `mode` (campaign or endless) are fixed for the room
    // lifetime and survive reset(), so every game hosted by this process uses
    // the same rules.
    explicit Room(std::uint32_t roomInstance,
                  game::Difficulty difficulty = game::Difficulty::Normal,
                  game::GameMode mode = game::GameMode::Campaign);

    // Creates the ship of `playerId` (0..3); the level starts on the first join.
    void join(std::uint8_t playerId);

    // Kills the ship of a player that left. An unknown id is ignored.
    void leave(std::uint8_t playerId);

    // Applies a newer INPUT to the ship of `playerId`; false for an unknown
    // player or for a stale/duplicate `inputSeq` (§10).
    bool applyInput(std::uint8_t playerId, const net::InputMsg &input);

    // One authoritative tick: game::stepGame at game::kTickDt.
    void step();

    // Drops the whole game (world, tick, players) so the room process can
    // host the next game with the same instance number.
    void reset();

    [[nodiscard]] std::uint32_t tick() const { return _tick; }
    [[nodiscard]] game::RoomState state() { return game::roomState(_registry); }
    // The level being played, from 1 (the room plays a campaign of levels).
    [[nodiscard]] int stage() { return game::currentStage(_registry); }
    // The game registry, for tests and tools. The room owns it.
    [[nodiscard]] engine::Registry &registry() { return _registry; }
    [[nodiscard]] bool hasPlayer(std::uint8_t playerId) const;
    [[nodiscard]] std::size_t playerCount() const { return _players.size(); }
    [[nodiscard]] std::uint32_t roomInstance() const { return _roomInstance; }

    // Full state for one client, header included; empty when encoding failed.
    std::vector<std::uint8_t> snapshot(std::uint8_t playerId);

    // Reliable events produced since the last call: SPAWN for the entities
    // that appeared, DESTROY for the ones that disappeared (RFC §5, §7). The
    // sequence keeps increasing across reset() so a late ack never covers a
    // future event.
    std::vector<ReliableEvent> takeEvents();

    // End-of-game notice, header included; result is 1 victory, 2 defeat (§7).
    ReliableEvent gameEnd();

private:
    void applyRules();
    void collectEvents();
    ReliableEvent makeSpawn(const game::SnapshotEntity &entity);
    ReliableEvent makeDestroy(std::uint16_t netId);

    struct Player {
        engine::Entity ship{0, 0};
        std::uint32_t lastInputSeq = 0;
        bool gotInput = false;
    };

    engine::Registry _registry;
    std::uint32_t _roomInstance;
    game::Difficulty _difficulty;
    game::GameMode _mode;
    std::uint32_t _tick = 0;
    std::uint32_t _packetSeq = 0;
    bool _levelLoaded = false;
    std::unordered_map<std::uint8_t, Player> _players;
    game::Snapshot _previousSnapshot;
    std::vector<ReliableEvent> _events;
    std::uint16_t _nextEventSeq = 1;
};

} // namespace server
