#pragma once

#include "engine/subsystems/INetwork.hpp"

#include <memory>

namespace engine::asio {

// INetwork over a non-blocking Asio UDP socket (IPv4). Asio stays an
// implementation detail (Pimpl): this header includes no Asio header.
// Addresses are numeric IPv4 or "localhost": no DNS lookup, which could block
// the game loop.
class AsioNetwork final : public INetwork {
public:
    AsioNetwork();
    ~AsioNetwork() override;

    bool bind(std::uint16_t port) override;
    [[nodiscard]] std::uint16_t localPort() const override;
    bool send(const NetAddress &to, std::span<const std::uint8_t> data) override;
    std::optional<Datagram> receive() override;
    void close() override;

private:
    struct Impl;
    std::unique_ptr<Impl> _impl;
};

} // namespace engine::asio
