#include "network/handshake.hpp"

namespace net {

namespace {

void writeAccept(std::vector<std::uint8_t> &reply, std::uint32_t packetSeq, std::uint8_t playerId,
                 std::uint32_t roomInstance)
{
    reply.clear();
    Writer w(reply, kMaxUdpDatagram);
    writeHeader(w, MsgType::Accept, packetSeq);
    AcceptMsg accept;
    accept.playerId = playerId;
    accept.tickRate = kTickRate;
    accept.snapshotRate = kSnapshotRate;
    accept.roomInstance = roomInstance;
    encode(accept, w);
}

void writePong(std::vector<std::uint8_t> &reply, std::uint32_t packetSeq, const PingMsg &ping)
{
    reply.clear();
    Writer w(reply, kMaxUdpDatagram);
    writeHeader(w, MsgType::Pong, packetSeq);
    PongMsg pong;
    pong.clientTimeMs = ping.clientTimeMs;
    pong.serverTimeMs = 0; // the room loop will report its own clock
    encode(pong, w);
}

void writeBye(std::vector<std::uint8_t> &reply, std::uint32_t packetSeq, std::uint8_t reason)
{
    reply.clear();
    Writer w(reply, kMaxUdpDatagram);
    writeHeader(w, MsgType::Bye, packetSeq);
    ByeMsg bye;
    bye.reason = reason;
    encode(bye, w);
}

} // namespace

Handshake::Handshake(std::uint32_t roomInstance) : _roomInstance(roomInstance) {}

const Client *Handshake::find(const asio::ip::udp::endpoint &endpoint) const
{
    for (const auto &client : _clients) {
        if (client.endpoint == endpoint) {
            return &client;
        }
    }
    return nullptr;
}

std::uint8_t Handshake::nextPlayerId() const
{
    for (std::uint8_t id = 0; id < kMaxPlayers; ++id) {
        bool used = false;
        for (const auto &client : _clients) {
            if (client.playerId == id) {
                used = true;
                break;
            }
        }
        if (!used) {
            return id;
        }
    }
    return kMaxPlayers; // caller checks the room is not full first
}

bool Handshake::handle(const std::uint8_t *data, std::size_t size,
                       const asio::ip::udp::endpoint &from, std::vector<std::uint8_t> &reply)
{
    PacketHeader header;
    if (readHeader(data, size, header) != HeaderStatus::Ok) {
        ++_rejected;
        return false;
    }

    Reader r(data + kHeaderSize, size - kHeaderSize);

    if (header.type == MsgType::Connect) {
        ConnectMsg connect;
        if (!decode(r, connect) || connect.roomInstance != _roomInstance) {
            ++_rejected;
            return false;
        }
        auto *client = find(from);
        if (client == nullptr) {
            if (_clients.size() >= kMaxPlayers) {
                writeBye(reply, _packetSeq++, kByeRoomFull);
                return true;
            }
            _clients.push_back(Client{from, nextPlayerId(), connect.name});
            client = &_clients.back();
        }
        writeAccept(reply, _packetSeq++, client->playerId, _roomInstance);
        return true;
    }

    if (header.type == MsgType::Ping) {
        PingMsg ping;
        if (!decode(r, ping) || find(from) == nullptr) {
            ++_rejected;
            return false;
        }
        writePong(reply, _packetSeq++, ping);
        return true;
    }

    // INPUT and the other messages belong to the room loop, which does not
    // exist yet. An INPUT from a known player is valid, so it is not counted
    // as rejected.
    if (header.type == MsgType::Input && find(from) != nullptr) {
        return false;
    }
    ++_rejected;
    return false;
}

std::optional<std::uint8_t> Handshake::remove(const asio::ip::udp::endpoint &endpoint)
{
    for (auto it = _clients.begin(); it != _clients.end(); ++it) {
        if (it->endpoint == endpoint) {
            const std::uint8_t playerId = it->playerId;
            _clients.erase(it);
            return playerId;
        }
    }
    return std::nullopt;
}

} // namespace net
