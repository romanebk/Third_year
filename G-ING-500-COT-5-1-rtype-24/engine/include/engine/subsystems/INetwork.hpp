#pragma once

#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <vector>

namespace engine {

// IPv4 address and port, as text: no library type leaks into the game.
struct NetAddress {
    std::string host; // dotted IPv4 ("192.168.1.10") or "localhost"
    std::uint16_t port = 0;

    bool operator==(const NetAddress &other) const = default;
};

struct Datagram {
    NetAddress from;
    std::vector<std::uint8_t> data;
};

// Unreliable datagram transport (UDP), never blocking: the game loop polls it
// every tick. What the bytes mean (the protocol) is the game's business.
// Implementation: engine::asio::AsioNetwork (module engine_asio).
class INetwork {
public:
    INetwork() = default;
    INetwork(const INetwork &) = delete;
    INetwork &operator=(const INetwork &) = delete;
    INetwork(INetwork &&) = delete;
    INetwork &operator=(INetwork &&) = delete;
    virtual ~INetwork() = default;

    // Listens on `port` (0: any free port). False if the port is taken.
    virtual bool bind(std::uint16_t port) = 0;
    // The bound port, or 0 if not bound.
    [[nodiscard]] virtual std::uint16_t localPort() const = 0;

    // Best effort; false if the address is invalid or the send failed.
    virtual bool send(const NetAddress &to, std::span<const std::uint8_t> data) = 0;
    // One received datagram, or std::nullopt if none is waiting.
    virtual std::optional<Datagram> receive() = 0;

    virtual void close() = 0;
};

} // namespace engine
