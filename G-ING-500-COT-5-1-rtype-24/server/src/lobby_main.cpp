#include "network/lobby.hpp"
#include "server/lobby.hpp"

#include <array>
#include <asio/error.hpp>
#include <asio/io_context.hpp>
#include <asio/ip/tcp.hpp>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

struct Options {
    std::uint16_t port = 4242;
    std::uint16_t roomPort = 4300;
    std::uint32_t roomInstance = 1;
    std::string roomHost = "127.0.0.1";
};

void printUsage(const char *program)
{
    std::cerr << "usage: " << program
              << " [--port <tcp-port>] [--room-host <ip>] [--room-port <udp-port>]"
                 " [--room-instance <number>]\n";
}

bool parseOptions(int argc, char **argv, Options &options)
{
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg != "--port" && arg != "--room-host" && arg != "--room-port" &&
            arg != "--room-instance") {
            std::cerr << "r-type_lobby: unknown argument '" << arg << "'\n";
            return false;
        }
        if (i + 1 >= argc) {
            std::cerr << "r-type_lobby: " << arg << " needs a value\n";
            return false;
        }
        const std::string value = argv[++i];
        if (arg == "--room-host") {
            options.roomHost = value;
            continue;
        }
        const auto number = std::stoul(value);
        if (arg == "--room-instance") {
            options.roomInstance = static_cast<std::uint32_t>(number);
            continue;
        }
        if (number > 65535u) {
            std::cerr << "r-type_lobby: port out of range: " << number << '\n';
            return false;
        }
        if (arg == "--port") {
            options.port = static_cast<std::uint16_t>(number);
        } else {
            options.roomPort = static_cast<std::uint16_t>(number);
        }
    }
    return true;
}

bool wouldBlock(const asio::error_code &error)
{
    return error == asio::error::would_block || error == asio::error::try_again;
}

// One accepted TCP connection: the lobby id it was given, the frame rebuilder
// for its stream, and the bytes waiting to be written back.
struct Connection {
    Connection(asio::io_context &context, std::uint32_t lobbyId)
        : socket(context), clientId(lobbyId)
    {
    }

    asio::ip::tcp::socket socket;
    net::FrameReader reader;
    std::uint32_t clientId;
    std::vector<std::uint8_t> outgoing;
};

} // namespace

int main(int argc, char **argv)
{
    try {
        Options options;
        if (!parseOptions(argc, argv, options)) {
            printUsage(argv[0]);
            return 1;
        }

        asio::io_context context;
        asio::ip::tcp::acceptor acceptor(context);
        asio::error_code error;
        acceptor.open(asio::ip::tcp::v4(), error);
        if (!error) {
            acceptor.set_option(asio::ip::tcp::acceptor::reuse_address(true), error);
        }
        if (!error) {
            acceptor.bind(asio::ip::tcp::endpoint(asio::ip::tcp::v4(), options.port), error);
        }
        if (!error) {
            acceptor.listen(asio::socket_base::max_listen_connections, error);
        }
        if (error) {
            std::cerr << "r-type_lobby: cannot listen on TCP port " << options.port << ": "
                      << error.message() << '\n';
            return 1;
        }
        acceptor.non_blocking(true);

        server::Lobby lobby(options.roomPort, options.roomHost, options.roomInstance);
        std::unordered_map<std::uint32_t, std::unique_ptr<Connection>> connections;
        std::array<std::uint8_t, 4096> buffer{};

        std::cout << "r-type_lobby: listening on TCP port " << options.port << ", room "
                  << options.roomHost << ':' << options.roomPort << std::endl;

        const auto queueFrames = [&](const std::vector<server::LobbyOutgoing> &frames) {
            for (const auto &frame : frames) {
                const auto it = connections.find(frame.clientId);
                if (it != connections.end()) {
                    it->second->outgoing.insert(it->second->outgoing.end(), frame.frame.begin(),
                                                frame.frame.end());
                }
            }
        };

        const auto dropConnection =
            [&](std::unordered_map<std::uint32_t, std::unique_ptr<Connection>>::iterator it) {
                const std::uint32_t clientId = it->first;
                connections.erase(it);
                std::vector<server::LobbyOutgoing> out;
                lobby.disconnect(clientId, out);
                queueFrames(out);
                std::cout << "r-type_lobby: client " << clientId << " disconnected" << std::endl;
            };

        for (;;) {
            // 1. Accept every pending TCP connection.
            for (;;) {
                asio::ip::tcp::socket socket(context);
                acceptor.accept(socket, error);
                if (error) {
                    break; // would_block when nobody is waiting
                }
                socket.non_blocking(true);
                asio::error_code ignored;
                socket.set_option(asio::ip::tcp::no_delay(true), ignored);

                const std::uint32_t clientId = lobby.connect();
                auto connection = std::make_unique<Connection>(context, clientId);
                connection->socket = std::move(socket);
                connections.emplace(clientId, std::move(connection));
                std::cout << "r-type_lobby: client " << clientId << " connected" << std::endl;
            }

            // 2. Read what clients sent. A read error or a broken frame is a
            //    disconnect: the lobby never keeps a half-understood stream.
            for (auto it = connections.begin(); it != connections.end();) {
                Connection &connection = *it->second;
                const std::size_t size = connection.socket.read_some(asio::buffer(buffer), error);
                bool drop = false;
                if (error) {
                    drop = !wouldBlock(error);
                } else if (size > 0) {
                    drop = !connection.reader.feed(buffer.data(), size);
                    net::LobbyFrame frame;
                    while (!drop && connection.reader.next(frame)) {
                        std::vector<server::LobbyOutgoing> out;
                        lobby.handle(connection.clientId, frame, out);
                        queueFrames(out);
                    }
                    drop = drop || connection.reader.failed();
                }
                if (drop) {
                    dropConnection(it++);
                } else {
                    ++it;
                }
            }

            // 3. Flush the answers, keeping whatever a slow client could not
            //    take yet for the next iteration.
            for (auto it = connections.begin(); it != connections.end();) {
                Connection &connection = *it->second;
                bool drop = false;
                while (!connection.outgoing.empty()) {
                    const std::size_t written =
                        connection.socket.write_some(asio::buffer(connection.outgoing), error);
                    if (wouldBlock(error)) {
                        break;
                    }
                    if (error) {
                        drop = true;
                        break;
                    }
                    connection.outgoing.erase(connection.outgoing.begin(),
                                              connection.outgoing.begin() +
                                                  static_cast<std::ptrdiff_t>(written));
                }
                if (drop) {
                    dropConnection(it++);
                } else {
                    ++it;
                }
            }

            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
    } catch (const std::exception &exception) {
        std::cerr << "r-type_lobby: " << exception.what() << '\n';
        return 1;
    }
}
