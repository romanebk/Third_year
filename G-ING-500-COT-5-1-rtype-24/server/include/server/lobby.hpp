#pragma once

#include "network/lobby.hpp"

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace server {

// One player sitting in a waiting room.
struct LobbyPlayer {
    std::uint32_t clientId = 0;
    std::string name;
    bool ready = false;
};

// One waiting room. A room keeps its id for the whole lobby lifetime and is
// erased only when its last player leaves. Once started, its players move to
// the room process (UDP), the lobby stops accepting joins for it, and the host
// may start it again for the next game.
struct LobbyRoom {
    std::uint16_t roomId = 0;
    std::string name;
    std::uint32_t hostId = 0;
    std::vector<LobbyPlayer> players;
    bool started = false;
    std::uint16_t udpPort = 0;
    std::uint32_t roomInstance = 0;
};

// A frame the TCP layer must send to one client connection.
struct LobbyOutgoing {
    std::uint32_t clientId = 0;
    std::vector<std::uint8_t> frame;
};

// The lobby policy of docs/rfc-protocol.md §8, without sockets: the TCP layer
// gives it the frames it decoded and sends back the frames it produces.
//
// Rules of v1 (simple, one game room process):
// - a client must LOGIN before anything else; names are unique;
// - CREATE_ROOM adds a waiting room, JOIN_ROOM enters one (max 4 players),
//   the host may START it at any time;
// - only one room can be started per lobby process; starting another room is
//   refused with ERROR/ShuttingDown;
// - starting the already running room again re-announces it (play again);
// - every change of a room is broadcast as ROOM_UPDATE to its players.
class Lobby {
public:
    static constexpr std::size_t kMaxPlayersPerRoom = 4;
    static constexpr std::size_t kMaxRooms = 16;

    // `udpPort` is the port of the room process announced in ROOM_START;
    // `roomHost` is the address clients must connect to (the lobby cannot
    // guess it reliably behind NAT, so the operator sets it); `roomInstance`
    // must be the `--room-instance` of the room process.
    Lobby(std::uint16_t udpPort, std::string roomHost, std::uint32_t roomInstance = 1);

    // Registers a new TCP connection. The returned id becomes the player id
    // once LOGIN succeeds; the TCP layer maps it to its socket.
    std::uint32_t connect();
    // The connection closed: the player leaves its room and is forgotten.
    // Pending frames for the other players are appended to `out`.
    void disconnect(std::uint32_t clientId, std::vector<LobbyOutgoing> &out);

    // Handles one decoded client frame; appends every frame to send in `out`.
    void handle(std::uint32_t clientId, const net::LobbyFrame &frame,
                std::vector<LobbyOutgoing> &out);

    [[nodiscard]] const std::vector<LobbyRoom> &rooms() const { return _rooms; }
    [[nodiscard]] const LobbyRoom *findRoom(std::uint16_t roomId) const;
    [[nodiscard]] std::size_t loggedInCount() const;
    // Room id of the started room, or 0 when none is running.
    [[nodiscard]] std::uint16_t startedRoomId() const { return _startedRoom; }

private:
    struct Session {
        std::string name;
        bool loggedIn = false;
        std::optional<std::uint16_t> roomId;
    };

    void login(std::uint32_t clientId, const net::LobbyLogin &message,
               std::vector<LobbyOutgoing> &out);
    void listRooms(std::uint32_t clientId, std::vector<LobbyOutgoing> &out);
    void createRoom(std::uint32_t clientId, const net::LobbyCreateRoom &message,
                    std::vector<LobbyOutgoing> &out);
    void joinRoom(std::uint32_t clientId, const net::LobbyJoinRoom &message,
                  std::vector<LobbyOutgoing> &out);
    void leaveRoom(std::uint32_t clientId, std::vector<LobbyOutgoing> &out);
    void setReady(std::uint32_t clientId, const net::LobbySetReady &message,
                  std::vector<LobbyOutgoing> &out);
    void chat(std::uint32_t clientId, const net::LobbyChat &message,
              std::vector<LobbyOutgoing> &out);
    void start(std::uint32_t clientId, std::vector<LobbyOutgoing> &out);

    // Removes the player from its room, promoting a new host or erasing an
    // empty room, and broadcasts the update to the players left behind.
    void removeFromRoom(std::uint32_t clientId, std::vector<LobbyOutgoing> &out);
    [[nodiscard]] LobbyRoom *roomOf(std::uint32_t clientId);
    [[nodiscard]] LobbyRoom *findRoomMutable(std::uint16_t roomId);
    [[nodiscard]] bool isNameTaken(const std::string &name) const;
    [[nodiscard]] bool requireLogin(std::uint32_t clientId, std::vector<LobbyOutgoing> &out);

    std::unordered_map<std::uint32_t, Session> _sessions;
    std::vector<LobbyRoom> _rooms;
    std::uint32_t _nextClientId = 1;
    std::uint16_t _nextRoomId = 1;
    std::uint32_t _nextLobbyToken = 1;
    std::uint16_t _udpPort;
    std::uint32_t _roomInstance;
    std::string _roomHost;
    std::uint16_t _startedRoom = 0;
};

} // namespace server
