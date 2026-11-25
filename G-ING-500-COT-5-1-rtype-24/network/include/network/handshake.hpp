#pragma once

#include "network/packet.hpp"

#include <asio/ip/udp.hpp>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace net {

// One player accepted into the room.
struct Client {
    asio::ip::udp::endpoint endpoint;
    std::uint8_t playerId = 0;
    std::string name;
};

// The CONNECT -> ACCEPT handshake of one room (docs/rfc-protocol.md §6, §7):
// - a CONNECT from a new endpoint gets the next player id and an ACCEPT;
// - the same client sending CONNECT again (it retries until it hears back)
//   gets the same ACCEPT, without creating a second player;
// - a CONNECT when the room is full gets a BYE;
// - a PING from a known client is answered with PONG;
// - everything else, and anything from an unknown endpoint, is dropped
//   without a reply (no amplification, §9).
//
// It has no socket: the caller passes the datagram it just read and sends back
// what handle() returns. That keeps the policy independent and testable.
class Handshake {
public:
    static constexpr std::uint8_t kMaxPlayers = 4;
    static constexpr std::uint8_t kByeRoomFull = 2; // lobby error code

    explicit Handshake(std::uint32_t roomInstance);

    // Returns true when `reply` must be sent back to `from`.
    bool handle(const std::uint8_t *data, std::size_t size, const asio::ip::udp::endpoint &from,
                std::vector<std::uint8_t> &reply);

    // Drops the client at `endpoint` and returns its player id, or nothing when
    // the endpoint is unknown. The id becomes reusable by the next CONNECT.
    std::optional<std::uint8_t> remove(const asio::ip::udp::endpoint &endpoint);

    [[nodiscard]] const std::vector<Client> &clients() const { return _clients; }
    [[nodiscard]] std::size_t playerCount() const { return _clients.size(); }
    [[nodiscard]] std::uint32_t roomInstance() const { return _roomInstance; }
    // Datagrams refused because they were malformed or came from nobody.
    [[nodiscard]] std::uint32_t rejectedCount() const { return _rejected; }

private:
    [[nodiscard]] const Client *find(const asio::ip::udp::endpoint &endpoint) const;
    [[nodiscard]] std::uint8_t nextPlayerId() const;

    std::uint32_t _roomInstance;
    std::uint32_t _packetSeq = 0;
    std::vector<Client> _clients;
    std::uint32_t _rejected = 0;
};

} // namespace net
