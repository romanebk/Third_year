#pragma once

#include <asio/io_context.hpp>
#include <asio/ip/udp.hpp>
#include <chrono>
#include <cstddef>
#include <cstdint>

namespace net {

// Simplest UDP endpoint: bind one port, then receive or send a single datagram
// at a time, synchronously. Socket errors are swallowed (a failed receive
// returns 0) because a room must never die on a network error.
class UdpSocket {
public:
    // Binds 0.0.0.0:`port`; port 0 asks the OS for a free one.
    explicit UdpSocket(std::uint16_t port);

    // Blocks until one datagram arrives. Returns its size, or 0 on a socket
    // error or on an empty datagram. A datagram larger than `capacity` is
    // truncated to it.
    std::size_t receive(std::uint8_t *buffer, std::size_t capacity, asio::ip::udp::endpoint &from);

    // Waits at most `timeout` for one datagram. Returns its size, or 0 when no
    // datagram arrived, on an empty datagram, or on a socket error. Used by the
    // room loop to keep ticking while it also listens for client packets.
    std::size_t receiveFor(std::uint8_t *buffer, std::size_t capacity,
                           asio::ip::udp::endpoint &from, std::chrono::milliseconds timeout);

    // Best effort: a lost reply is not fatal, the client retries its CONNECT.
    void send(const std::uint8_t *data, std::size_t size, const asio::ip::udp::endpoint &to);

    // The bound port (useful when 0 was requested).
    [[nodiscard]] std::uint16_t port() const;

private:
    asio::io_context _context;
    asio::ip::udp::socket _socket;
};

} // namespace net
