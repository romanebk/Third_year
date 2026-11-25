#include "engine/asio/AsioNetwork.hpp"

#include <array>
#include <asio/io_context.hpp>
#include <asio/ip/address.hpp>
#include <asio/ip/udp.hpp>
#include <system_error>

namespace engine::asio {

namespace {

constexpr std::size_t kMaxDatagram = 65507; // largest UDP payload over IPv4

// Numeric IPv4 or "localhost" only (no DNS: it could block the game loop).
std::optional<::asio::ip::udp::endpoint> toEndpoint(const NetAddress &address)
{
    std::error_code ec;
    const std::string host = address.host == "localhost" ? "127.0.0.1" : address.host;
    const ::asio::ip::address ip = ::asio::ip::make_address(host, ec);
    if (ec || address.port == 0) {
        return std::nullopt;
    }
    return ::asio::ip::udp::endpoint(ip, address.port);
}

} // namespace

struct AsioNetwork::Impl {
    ::asio::io_context context;
    ::asio::ip::udp::socket socket{context};
    std::array<std::uint8_t, kMaxDatagram> buffer{};

    // Opens an unbound socket on demand, so a client can send without bind().
    bool ensureOpen()
    {
        if (socket.is_open()) {
            return true;
        }
        std::error_code ec;
        socket.open(::asio::ip::udp::v4(), ec);
        if (!ec) {
            socket.non_blocking(true, ec);
        }
        return !ec;
    }
};

AsioNetwork::AsioNetwork() : _impl(std::make_unique<Impl>()) {}

AsioNetwork::~AsioNetwork() = default;

bool AsioNetwork::bind(std::uint16_t port)
{
    close();
    if (!_impl->ensureOpen()) {
        return false;
    }
    std::error_code ec;
    _impl->socket.bind(::asio::ip::udp::endpoint(::asio::ip::udp::v4(), port), ec);
    if (ec) {
        close();
        return false;
    }
    return true;
}

std::uint16_t AsioNetwork::localPort() const
{
    std::error_code ec;
    if (!_impl->socket.is_open()) {
        return 0;
    }
    const auto endpoint = _impl->socket.local_endpoint(ec);
    return ec ? 0 : endpoint.port();
}

bool AsioNetwork::send(const NetAddress &to, std::span<const std::uint8_t> data)
{
    const auto endpoint = toEndpoint(to);
    if (!endpoint || !_impl->ensureOpen()) {
        return false;
    }
    std::error_code ec;
    _impl->socket.send_to(::asio::buffer(data.data(), data.size()), *endpoint, 0, ec);
    return !ec;
}

std::optional<Datagram> AsioNetwork::receive()
{
    if (!_impl->socket.is_open()) {
        return std::nullopt;
    }
    ::asio::ip::udp::endpoint from;
    std::error_code ec;
    const std::size_t size = _impl->socket.receive_from(::asio::buffer(_impl->buffer), from, 0, ec);
    if (ec) {
        return std::nullopt; // would_block (nothing waiting) or a socket error
    }
    Datagram datagram;
    datagram.from = NetAddress{from.address().to_string(), from.port()};
    datagram.data.assign(_impl->buffer.begin(),
                         _impl->buffer.begin() + static_cast<std::ptrdiff_t>(size));
    return datagram;
}

void AsioNetwork::close()
{
    std::error_code ec;
    _impl->socket.close(ec);
}

} // namespace engine::asio
