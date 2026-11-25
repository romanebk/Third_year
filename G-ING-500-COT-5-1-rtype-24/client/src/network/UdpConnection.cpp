#include "network/UdpConnection.hpp"

#include "game/world.hpp"
#include "network/bytes.hpp"

#include <array>
#include <asio/error.hpp>
#include <system_error>

namespace client {

namespace {

const float kConnectRetry = 0.5f;   // send CONNECT again every 0.5 s...
const float kConnectTimeout = 5.0f; // ... and give up after 5 s
const float kServerTimeout = 5.0f;  // nothing received for 5 s: connection lost
const int kLeaveCopies = 3;         // LEAVE gets no answer: send it 3 times
const std::uint8_t kByeRoomFull = 2;
const std::uint8_t kStateVictory = 1; // `state` of a SNAPSHOT
const std::uint8_t kStateDefeat = 2;
const std::uint8_t kResultVictory = 1; // `result` of a GAME_END

} // namespace

ServerMessage snapshotToMessage(const net::SnapshotMsg &snapshot, int playerId,
                                const std::string &playerName)
{
    ServerMessage message;
    message.type = MessageType::Snapshot;
    message.tick = snapshot.serverTick;
    for (const net::EntityRecord &record : snapshot.entities) {
        if (record.type > static_cast<std::uint8_t>(game::EntityType::Boss)) {
            continue; // a type this client does not know how to draw
        }
        EntityInfo entity;
        entity.id = record.netId;
        entity.type = static_cast<game::EntityType>(record.type);
        // Teams 0 to 3 are the players (game::Team::P0 to P3).
        entity.playerId = record.team < game::kMaxPlayers ? record.team : -1;
        entity.x = record.x;
        entity.y = record.y;
        entity.hp = record.hp;
        entity.extra = record.extra;
        message.entities.push_back(entity);
    }

    // The HUD of every player. Only our own name is known, the others are "".
    for (const net::PlayerHud &hud : snapshot.players) {
        if (hud.playerId == playerId) {
            continue; // added below, with the details of the "self" block
        }
        PlayerInfo other;
        other.id = hud.playerId;
        other.score = hud.score;
        other.lives = hud.lives;
        other.alive = hud.alive != 0;
        other.ready = true;
        message.players.push_back(other);
    }
    PlayerInfo me;
    me.id = playerId;
    me.name = playerName;
    me.score = snapshot.self.score;
    me.lives = snapshot.self.lives;
    me.alive = snapshot.self.alive != 0;
    me.ready = true;
    me.speedLevel = snapshot.self.speedLevel;
    me.forcePower = snapshot.self.forcePower;
    message.players.push_back(me);
    message.stage = net::snapshotStage(snapshot.self);
    message.endless = net::snapshotEndless(snapshot.self);
    return message;
}

UdpConnection::UdpConnection() : _socket(_context) {}

bool UdpConnection::connect(const std::string &host, unsigned short port,
                            const std::string &playerName)
{
    disconnect();
    // The server refuses a name longer than 16 characters.
    _playerName = playerName.substr(0, net::kMaxNameLength);
    _serverName = host + ":" + std::to_string(port);

    // The resolver turns "localhost" or "192.168.1.10" into a server address.
    std::error_code error;
    asio::ip::udp::resolver resolver(_context);
    const auto results = resolver.resolve(asio::ip::udp::v4(), host, std::to_string(port), error);
    if (error || results.empty()) {
        return false;
    }
    _server = results.begin()->endpoint();

    // Our socket, on any free port. Non-blocking: reading never waits.
    _socket.open(asio::ip::udp::v4(), error);
    if (!error) {
        _socket.bind(asio::ip::udp::endpoint(asio::ip::udp::v4(), 0), error);
    }
    if (!error) {
        _socket.non_blocking(true, error);
    }
    if (error) {
        _socket.close(error);
        return false;
    }
    sendLobbyUpdate();
    return true;
}

void UdpConnection::disconnect()
{
    if (!_socket.is_open()) {
        return;
    }
    if (_state != State::Idle) {
        sendLeave();
    }
    std::error_code error;
    _socket.close(error);
    _state = State::Idle;
    _messages.clear();
}

void UdpConnection::setReady(bool ready)
{
    if (ready && _state == State::Idle) {
        _state = State::Joining;
        _connectTimer = 0.0f;
        _connectElapsed = 0.0f;
        sendConnect();
    } else if (!ready && _state == State::Joining) {
        sendLeave(); // the room may already have created our ship
        _state = State::Idle;
    }
    sendLobbyUpdate();
}

void UdpConnection::sendInput(const game::Input &input)
{
    if (_state != State::Playing) {
        return;
    }
    _inputSeq++;
    _lastGameSeq = input.seq;
    net::InputMsg message;
    message.inputSeq = _inputSeq;
    message.mask = game::inputMask(input); // the keys, one bit each
    message.prevMask = _lastMask;          // the previous keys, in case a packet was lost
    message.ackEvent = _lastEvent;
    message.lastServerTick = _lastServerTick;
    _lastMask = message.mask;

    std::vector<std::uint8_t> datagram;
    net::Writer writer(datagram, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::Input, _packetSeq++);
    if (net::encode(message, writer)) {
        send(datagram);
    }
}

void UdpConnection::update(float dt)
{
    if (!_socket.is_open()) {
        return;
    }
    readDatagrams();

    if (_state == State::Joining) {
        _connectElapsed += dt;
        _connectTimer += dt;
        if (_connectElapsed >= kConnectTimeout) {
            fail("No answer from " + _serverName);
        } else if (_connectTimer >= kConnectRetry) {
            _connectTimer = 0.0f;
            sendConnect();
        }
    } else if (_state == State::Playing) {
        _silence += dt;
        if (_silence >= kServerTimeout) {
            fail("Connection lost with " + _serverName);
        }
    }
}

std::vector<ServerMessage> UdpConnection::receive()
{
    std::vector<ServerMessage> messages = _messages;
    _messages.clear();
    return messages;
}

void UdpConnection::sendConnect()
{
    net::ConnectMsg message;
    message.roomInstance = kDirectRoomInstance;
    message.name = _playerName;

    std::vector<std::uint8_t> datagram;
    net::Writer writer(datagram, net::kMaxUdpDatagram);
    net::writeHeader(writer, net::MsgType::Connect, _packetSeq++);
    if (net::encode(message, writer)) {
        send(datagram);
    }
}

void UdpConnection::sendLeave()
{
    for (int i = 0; i < kLeaveCopies; i++) {
        std::vector<std::uint8_t> datagram;
        net::Writer writer(datagram, net::kMaxUdpDatagram);
        net::writeHeader(writer, net::MsgType::Leave, _packetSeq++);
        if (net::encode(net::LeaveMsg{}, writer)) {
            send(datagram);
        }
    }
}

void UdpConnection::send(const std::vector<std::uint8_t> &datagram)
{
    // UDP: a lost packet is not an error, another one will follow.
    std::error_code error;
    _socket.send_to(asio::buffer(datagram), _server, 0, error);
}

void UdpConnection::readDatagrams()
{
    std::array<std::uint8_t, net::kMaxUdpDatagram> buffer{};
    // At most 100 packets per frame, so a broken socket can never block the game.
    for (int i = 0; i < 100 && _socket.is_open(); i++) {
        asio::ip::udp::endpoint from;
        std::error_code error;
        const std::size_t size = _socket.receive_from(asio::buffer(buffer), from, 0, error);
        if (error == asio::error::would_block || error == asio::error::try_again) {
            return; // nothing more to read for now
        }
        // Skip errors (on Windows, "connection reset" when no server runs) and
        // packets that do not come from our server.
        if (!error && from == _server) {
            handleDatagram(buffer.data(), size);
        }
    }
}

void UdpConnection::handleDatagram(const std::uint8_t *data, std::size_t size)
{
    net::PacketHeader header;
    if (net::readHeader(data, size, header) != net::HeaderStatus::Ok) {
        return; // not an R-Type packet
    }
    net::Reader reader(data + net::kHeaderSize, size - net::kHeaderSize);

    if (header.type == net::MsgType::Accept) {
        handleAccept(reader);
        return;
    }
    if (header.type == net::MsgType::Bye) {
        net::ByeMsg bye;
        if (net::decode(reader, bye) && _state != State::Idle) {
            fail(bye.reason == kByeRoomFull ? "The room is full (4 players)"
                                            : "The server closed the connection");
        }
        return;
    }
    if (_state != State::Playing) {
        return;
    }
    _silence = 0.0f; // the server is still there

    if (header.type == net::MsgType::Snapshot) {
        handleSnapshot(reader);
    } else if (header.type == net::MsgType::Spawn || header.type == net::MsgType::Destroy) {
        // The server sends these events again and again until we acknowledge
        // them (ackEvent of INPUT). We do not need their content: every
        // snapshot already has all the entities.
        const std::uint16_t eventSeq = reader.u16();
        if (reader.ok() && eventSeq > _lastEvent) {
            _lastEvent = eventSeq;
        }
    } else if (header.type == net::MsgType::GameEnd) {
        net::GameEndMsg end;
        if (net::decode(reader, end)) {
            if (end.eventSeq > _lastEvent) {
                _lastEvent = end.eventSeq;
            }
            endGame(end.result == kResultVictory);
        }
    }
}

void UdpConnection::handleAccept(net::Reader &reader)
{
    net::AcceptMsg accept;
    // We send CONNECT several times: only the first ACCEPT counts.
    if (_state != State::Joining || !net::decode(reader, accept)) {
        return;
    }
    _state = State::Playing;
    _playerId = accept.playerId;
    _silence = 0.0f;
    _lastServerTick = 0;
    _lastMask = 0;
    _lastEvent = 0;
    _players.clear();

    ServerMessage welcome;
    welcome.type = MessageType::Welcome;
    welcome.playerId = _playerId;
    welcome.snapshotRate = accept.snapshotRate;
    _messages.push_back(welcome);
    ServerMessage start;
    start.type = MessageType::GameStart;
    _messages.push_back(start);
}

void UdpConnection::handleSnapshot(net::Reader &reader)
{
    net::SnapshotMsg snapshot;
    if (!net::decode(reader, snapshot)) {
        return;
    }
    // ClientWorld ignores the snapshots that arrive late.
    _lastServerTick = snapshot.serverTick;
    ServerMessage message = snapshotToMessage(snapshot, _playerId, _playerName);
    // The server acknowledges the number of our INPUT packets (_inputSeq), the
    // game screen wants its own number (input.seq). Both go up by one for each
    // input sent, so "3 packets ago" is the same input in both counts.
    if (snapshot.ackInputSeq > 0 && snapshot.ackInputSeq <= _inputSeq) {
        const std::uint32_t late = _inputSeq - snapshot.ackInputSeq;
        message.ackInput = late < _lastGameSeq ? _lastGameSeq - late : 0;
    }
    _players = message.players;
    _messages.push_back(message);

    // The end of the game is also written in every snapshot: if GAME_END is
    // lost, the game still ends.
    if (snapshot.state == kStateVictory || snapshot.state == kStateDefeat) {
        endGame(snapshot.state == kStateVictory);
    }
}

void UdpConnection::endGame(bool victory)
{
    ServerMessage end;
    end.type = MessageType::GameOver;
    end.victory = victory;
    end.players = _players; // scores of the last snapshot
    _messages.push_back(end);
    // We leave the room. When everybody has left, the server resets it, so
    // "Play again" starts a new game.
    sendLeave();
    _state = State::Idle;
}

void UdpConnection::fail(const std::string &text)
{
    if (_state == State::Playing) {
        sendLeave();
    }
    _state = State::Idle;
    ServerMessage error;
    error.type = MessageType::Error;
    error.text = text;
    _messages.push_back(error);
}

void UdpConnection::sendLobbyUpdate()
{
    PlayerInfo me;
    me.id = _playerId;
    me.name = _playerName;
    me.lives = 3;
    me.ready = _state != State::Idle;
    ServerMessage lobby;
    lobby.type = MessageType::LobbyUpdate;
    lobby.players.push_back(me);
    _messages.push_back(lobby);
}

} // namespace client
