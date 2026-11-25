#pragma once

// The real connection to the game server (r-type_server), over UDP, with the
// messages of the network library (docs/rfc-protocol.md).
//
// The server creates our ship as soon as it accepts us, so we only ask to
// join when the player presses "Ready" in the waiting room:
// 1. connect():      finds the server address and opens our socket;
// 2. setReady(true): sends CONNECT every 0.5 s until the server answers ACCEPT;
// 3. ACCEPT:         the game starts; INPUT is sent 60 times per second;
// 4. SNAPSHOT:       the state of the game, 20 times per second;
// 5. GAME_END:       end of the game, we leave the room (LEAVE).
// If the server does not answer, or says nothing for 5 seconds: Error.

#include "network/ServerConnection.hpp"
#include "network/packet.hpp"

#include <asio/io_context.hpp>
#include <asio/ip/udp.hpp>
#include <cstdint>
#include <string>
#include <vector>

namespace client {

// Number of a room started by hand (r-type_server without the lobby).
const std::uint32_t kDirectRoomInstance = 1;

// Converts a SNAPSHOT of the server into the message used by the screens.
// The player list has the score and lives of every player; only our own name
// (the server does not send the names of the others yet).
ServerMessage snapshotToMessage(const net::SnapshotMsg &snapshot, int playerId,
                                const std::string &playerName);

class UdpConnection : public ServerConnection {
public:
    UdpConnection();

    bool connect(const std::string &host, unsigned short port,
                 const std::string &playerName) override;
    void disconnect() override;
    void setReady(bool ready) override;
    void sendInput(const game::Input &input) override;
    void update(float dt) override;
    std::vector<ServerMessage> receive() override;

private:
    enum class State {
        Idle,    // not in the room
        Joining, // CONNECT sent, waiting for ACCEPT
        Playing  // in the game
    };

    void sendConnect();
    void sendLeave();
    void send(const std::vector<std::uint8_t> &datagram);
    void readDatagrams();
    void handleDatagram(const std::uint8_t *data, std::size_t size);
    void handleAccept(net::Reader &reader);
    void handleSnapshot(net::Reader &reader);
    void endGame(bool victory);
    void fail(const std::string &text);
    void sendLobbyUpdate();

    // The io_context must be created before the socket that uses it.
    asio::io_context _context;
    asio::ip::udp::socket _socket;
    asio::ip::udp::endpoint _server;
    std::string _serverName; // "host:port", for the error messages
    std::string _playerName;
    State _state = State::Idle;
    int _playerId = 0;
    std::uint32_t _packetSeq = 0;
    // Never goes back to 0: the server ignores an INPUT that is not newer.
    std::uint32_t _inputSeq = 0;
    std::uint32_t _lastGameSeq = 0; // input.seq of the last input sent
    float _connectTimer = 0.0f;     // time since the last CONNECT
    float _connectElapsed = 0.0f;   // time since the first CONNECT
    float _silence = 0.0f;          // time since the last packet of the server
    std::uint32_t _lastServerTick = 0;
    std::uint8_t _lastMask = 0;
    std::uint16_t _lastEvent = 0;     // highest event number received (ack)
    std::vector<PlayerInfo> _players; // from the last snapshot, for GameOver
    std::vector<ServerMessage> _messages;
};

} // namespace client
