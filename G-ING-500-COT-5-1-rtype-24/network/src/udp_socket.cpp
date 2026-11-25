#include "network/udp_socket.hpp"

#include <asio/steady_timer.hpp>
#include <system_error>

namespace net {

UdpSocket::UdpSocket(std::uint16_t port)
    : _socket(_context, asio::ip::udp::endpoint(asio::ip::udp::v4(), port))
{
}

std::size_t UdpSocket::receive(std::uint8_t *buffer, std::size_t capacity,
                               asio::ip::udp::endpoint &from)
{
    try {
        return _socket.receive_from(asio::buffer(buffer, capacity), from);
    } catch (const std::system_error &) {
        return 0;
    }
}

std::size_t UdpSocket::receiveFor(std::uint8_t *buffer, std::size_t capacity,
                                  asio::ip::udp::endpoint &from, std::chrono::milliseconds timeout)
{
    std::size_t received = 0;
    bool finished = false;

    asio::steady_timer timer(_context);
    timer.expires_after(timeout);
    timer.async_wait([this, &finished](const std::error_code &error) {
        if (!error && !finished) {
            std::error_code ignored;
            _socket.cancel(ignored);
        }
    });

    _socket.async_receive_from(
        asio::buffer(buffer, capacity), from,
        [&finished, &received, &timer](const std::error_code &error, std::size_t size) {
            if (!error) {
                received = size;
            }
            finished = true;
            std::error_code ignored;
            timer.cancel(ignored);
        });

    _context.restart();
    _context.run();
    return received;
}

void UdpSocket::send(const std::uint8_t *data, std::size_t size, const asio::ip::udp::endpoint &to)
{
    try {
        _socket.send_to(asio::buffer(data, size), to);
    } catch (const std::system_error &) {
        // UDP is unreliable: the client retries its CONNECT or times out.
    }
}

std::uint16_t UdpSocket::port() const
{
    return _socket.local_endpoint().port();
}

} // namespace net
