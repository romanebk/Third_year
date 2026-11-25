#include "game/rules.hpp"
#include "network/handshake.hpp"
#include "network/packet.hpp"
#include "network/reliable.hpp"
#include "network/udp_socket.hpp"
#include "server/datagram_queues.hpp"
#include "server/room.hpp"

#include <array>
#include <asio/ip/udp.hpp>
#include <chrono>
#include <csignal>
#include <cstddef>
#include <cstdint>
#include <exception>
#include <iostream>
#include <string>
#include <thread>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

using Clock = std::chrono::steady_clock;

// Set by SIGINT/SIGTERM so both threads stop and main can join them. Only a
// sig_atomic_t is safe to touch from a signal handler.
volatile std::sig_atomic_t g_stop = 0;

void handleSignal(int)
{
    g_stop = 1;
}

struct Options {
    std::uint16_t port = 4300;
    std::uint32_t roomInstance = 1;
    game::Difficulty difficulty = game::Difficulty::Normal;
    game::GameMode mode = game::GameMode::Campaign;
};

void printUsage(const char *program)
{
    std::cerr << "usage: " << program
              << " [--port <udp-port>] [--room-instance <number>]"
                 " [--difficulty easy|normal|hard] [--mode campaign|endless]\n";
}

bool parseOptions(int argc, char **argv, Options &options)
{
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--difficulty") {
            if (i + 1 >= argc) {
                std::cerr << "r-type_server: --difficulty needs a value\n";
                return false;
            }
            const auto difficulty = game::parseDifficulty(argv[++i]);
            if (!difficulty) {
                std::cerr << "r-type_server: unknown difficulty '" << argv[i]
                          << "' (easy, normal or hard)\n";
                return false;
            }
            options.difficulty = *difficulty;
            continue;
        }
        if (arg == "--mode") {
            if (i + 1 >= argc) {
                std::cerr << "r-type_server: --mode needs a value\n";
                return false;
            }
            const auto mode = game::parseMode(argv[++i]);
            if (!mode) {
                std::cerr << "r-type_server: unknown mode '" << argv[i]
                          << "' (campaign or endless)\n";
                return false;
            }
            options.mode = *mode;
            continue;
        }
        if (arg != "--port" && arg != "--room-instance") {
            std::cerr << "r-type_server: unknown argument '" << arg << "'\n";
            return false;
        }
        if (i + 1 >= argc) {
            std::cerr << "r-type_server: " << arg << " needs a value\n";
            return false;
        }
        const auto value = std::stoul(argv[++i]);
        if (arg == "--port") {
            if (value > 65535u) {
                std::cerr << "r-type_server: port out of range: " << value << '\n';
                return false;
            }
            options.port = static_cast<std::uint16_t>(value);
        } else {
            options.roomInstance = static_cast<std::uint32_t>(value);
        }
    }
    return true;
}

// The game thread owns every piece of game state (handshake, room, reliable
// queues, player/endpoint maps). It only shares the two datagram queues with
// the network thread.
void runGame(const Options &options, server::DatagramQueues &queues)
{
    net::Handshake handshake(options.roomInstance);
    server::Room room(options.roomInstance, options.difficulty, options.mode);
    std::unordered_map<asio::ip::udp::endpoint, std::uint8_t> endpointToPlayer;
    std::unordered_map<std::uint8_t, asio::ip::udp::endpoint> playerToEndpoint;
    // §5: SPAWN, DESTROY and GAME_END are retransmitted per client until the
    // ack piggybacked in INPUT/PING covers them.
    std::unordered_map<std::uint8_t, net::ReliableQueue> reliable;

    const auto start = Clock::now();
    const auto tickInterval = std::chrono::duration_cast<Clock::duration>(
        std::chrono::duration<double>(1.0 / static_cast<double>(net::kTickRate)));
    const auto snapshotInterval = std::chrono::duration_cast<Clock::duration>(
        std::chrono::duration<double>(1.0 / static_cast<double>(net::kSnapshotRate)));
    auto lastTick = start;
    auto lastSnapshot = start;
    bool roomOver = false;
    bool roomEmpty = true;
    bool simulationStopped = false;
    const auto clientTimeout = std::chrono::seconds(5);
    std::unordered_map<asio::ip::udp::endpoint, Clock::time_point> lastSeen;
    std::vector<std::uint8_t> reply;

    // Hands a datagram to the network thread; this thread never touches the
    // socket itself.
    const auto send = [&](const std::uint8_t *data, std::size_t size,
                          const asio::ip::udp::endpoint &to) {
        server::OutgoingDatagram datagram;
        datagram.bytes.assign(data, data + size);
        datagram.to = to;
        queues.pushOutgoing(std::move(datagram));
    };

    const auto dropClient = [&](const asio::ip::udp::endpoint &from) {
        const auto mapped = endpointToPlayer.find(from);
        if (mapped != endpointToPlayer.end()) {
            const std::uint8_t playerId = mapped->second;
            room.leave(playerId);
            playerToEndpoint.erase(playerId);
            reliable.erase(playerId);
            endpointToPlayer.erase(mapped);
            std::cout << "player " << static_cast<int>(playerId) << " disconnected" << std::endl;
        }
        handshake.remove(from);
        lastSeen.erase(from);
    };

    const auto sendSnapshots = [&]() {
        for (const auto &entry : playerToEndpoint) {
            const auto datagram = room.snapshot(entry.first);
            if (!datagram.empty()) {
                send(datagram.data(), datagram.size(), entry.second);
            }
        }
    };

    const auto sendReliable = [&](const server::ReliableEvent &event, Clock::time_point now) {
        if (event.datagram.empty()) {
            return;
        }
        for (const auto &entry : playerToEndpoint) {
            const auto queue = reliable.find(entry.first);
            if (queue != reliable.end()) {
                queue->second.track(event.eventSeq, event.datagram, now);
            }
            send(event.datagram.data(), event.datagram.size(), entry.second);
        }
    };

    const auto handleDatagram = [&](const std::uint8_t *data, std::size_t size,
                                    const asio::ip::udp::endpoint &from, Clock::time_point now) {
        net::PacketHeader header;
        const auto status = net::readHeader(data, size, header);
        if (status != net::HeaderStatus::Ok) {
            return;
        }

        if (header.type == net::MsgType::Connect) {
            const std::size_t before = handshake.playerCount();
            if (!handshake.handle(data, size, from, reply)) {
                return;
            }
            send(reply.data(), reply.size(), from);
            if (handshake.playerCount() == before || handshake.clients().empty()) {
                // A repeated CONNECT keeps the same player and must also
                // refresh its timeout.
                if (endpointToPlayer.contains(from)) {
                    lastSeen[from] = now;
                }
                return;
            }

            const auto &client = handshake.clients().back();
            if (!room.hasPlayer(client.playerId)) {
                room.join(client.playerId);
            }
            if (!room.hasPlayer(client.playerId)) {
                // Do not keep a handshake slot reserved for a player the
                // room could not create.
                handshake.remove(from);
                std::cerr << "r-type_server: could not create player "
                          << static_cast<int>(client.playerId) << '\n';
                return;
            }
            endpointToPlayer[from] = client.playerId;
            playerToEndpoint[client.playerId] = from;
            reliable.try_emplace(client.playerId);
            lastSeen[from] = now;
            std::cout << "player " << static_cast<int>(client.playerId) << " connected from "
                      << from << std::endl;
            // §7: a joining client gets an immediate full snapshot.
            const auto initial = room.snapshot(client.playerId);
            if (!initial.empty()) {
                send(initial.data(), initial.size(), from);
            }
            return;
        }

        if (header.type == net::MsgType::Leave) {
            const auto it = endpointToPlayer.find(from);
            if (it == endpointToPlayer.end()) {
                return;
            }
            net::LeaveMsg leave;
            net::Reader reader(data + net::kHeaderSize, size - net::kHeaderSize);
            if (net::decode(reader, leave)) {
                dropClient(from);
            }
            return;
        }

        if (header.type == net::MsgType::Input) {
            const auto it = endpointToPlayer.find(from);
            if (it == endpointToPlayer.end()) {
                return;
            }
            net::InputMsg input;
            net::Reader reader(data + net::kHeaderSize, size - net::kHeaderSize);
            if (net::decode(reader, input)) {
                lastSeen[from] = now;
                const auto queue = reliable.find(it->second);
                if (queue != reliable.end()) {
                    queue->second.acknowledge(input.ackEvent);
                }
                room.applyInput(it->second, input);
            }
            return;
        }

        if (header.type == net::MsgType::Ping) {
            const auto it = endpointToPlayer.find(from);
            if (it == endpointToPlayer.end()) {
                return;
            }
            net::PingMsg ping;
            net::Reader reader(data + net::kHeaderSize, size - net::kHeaderSize);
            if (!net::decode(reader, ping)) {
                return;
            }
            lastSeen[from] = now;
            const auto queue = reliable.find(it->second);
            if (queue != reliable.end()) {
                queue->second.acknowledge(ping.ackEvent);
            }
            reply.clear();
            net::Writer writer(reply, net::kMaxUdpDatagram);
            net::writeHeader(writer, net::MsgType::Pong, 0);
            net::PongMsg pong;
            pong.clientTimeMs = ping.clientTimeMs;
            pong.serverTimeMs = static_cast<std::uint32_t>(
                std::chrono::duration_cast<std::chrono::milliseconds>(now - start).count());
            net::encode(pong, writer);
            send(reply.data(), reply.size(), from);
            return;
        }

        // Unknown message types are dropped without a reply.
    };

    while (g_stop == 0) {
        const auto now = Clock::now();

        for (auto &datagram : queues.takeIncoming()) {
            try {
                handleDatagram(datagram.bytes.data(), datagram.bytes.size(), datagram.from, now);
            } catch (const std::exception &error) {
                // A malformed or malicious datagram must never take the room
                // down; drop it and keep serving the other clients.
                std::cerr << "r-type_server: dropped datagram: " << error.what() << '\n';
            }
        }

        // §9: a player that sends no valid datagram for five seconds is
        // dropped and its ship is removed from the room.
        std::vector<asio::ip::udp::endpoint> timedOut;
        for (const auto &entry : lastSeen) {
            if (now - entry.second > clientTimeout) {
                timedOut.push_back(entry.first);
            }
        }
        for (const auto &from : timedOut) {
            std::cout << "player timed out from " << from << std::endl;
            dropClient(from);
        }

        // Fixed 60 Hz simulation; cap catch-up so a long stall does not make
        // the room try to replay hundreds of ticks at once.
        if (!simulationStopped) {
            std::size_t steps = 0;
            while (now - lastTick >= tickInterval && steps < 5) {
                try {
                    room.step();
                } catch (const std::exception &error) {
                    std::cerr << "r-type_server: simulation stopped: " << error.what() << '\n';
                    simulationStopped = true;
                    break;
                }
                lastTick += tickInterval;
                ++steps;
            }
        }
        if (now - lastTick >= tickInterval) {
            lastTick = now;
        }

        // Reliable SPAWN/DESTROY events produced by the ticks just run.
        for (const auto &event : room.takeEvents()) {
            sendReliable(event, now);
        }

        // 20 Hz full snapshots, one datagram per player (their `self` HUD block
        // and input acknowledgement differ).
        if (now - lastSnapshot >= snapshotInterval) {
            sendSnapshots();
            lastSnapshot += snapshotInterval;
            if (now - lastSnapshot >= snapshotInterval) {
                lastSnapshot = now;
            }
        }

        const auto roomState = room.state();
        if (!roomOver && roomState != game::RoomState::Playing) {
            sendReliable(room.gameEnd(), now);
            roomOver = true;
        } else if (roomOver && roomState == game::RoomState::Playing) {
            // Someone joined: the room is already running a new game.
            roomOver = false;
        }
        // Play again: once every player went back to the lobby the room is
        // reset, so the lobby can start a new game on the same instance
        // without restarting the room process.
        const bool empty = room.playerCount() == 0;
        if (empty && !roomEmpty) {
            room.reset();
            roomOver = false;
            simulationStopped = false;
            std::cout << "room reset for the next game" << std::endl;
        }
        roomEmpty = empty;

        // §5: retransmit the unacked reliable events; a client that never acks
        // is dropped (it goes back to the lobby).
        std::vector<std::vector<std::uint8_t>> retransmits;
        std::vector<asio::ip::udp::endpoint> unacked;
        for (auto &entry : reliable) {
            retransmits.clear();
            entry.second.collect(now, retransmits);
            const auto endpoint = playerToEndpoint.find(entry.first);
            if (endpoint != playerToEndpoint.end()) {
                for (const auto &datagram : retransmits) {
                    send(datagram.data(), datagram.size(), endpoint->second);
                }
            }
            if (entry.second.failed() && endpoint != playerToEndpoint.end()) {
                unacked.push_back(endpoint->second);
            }
        }
        for (const auto &from : unacked) {
            std::cout << "player stopped acking reliable events from " << from << std::endl;
            dropClient(from);
        }

        // Keep INPUT/SNAPSHOT latency low without busy-spinning. The network
        // thread reads the socket on its own.
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
}

// The network thread is the only one that touches the socket: it receives
// datagrams into the inbox and sends the outbox prepared by the game thread.
void runNetwork(net::UdpSocket &socket, server::DatagramQueues &queues)
{
    std::array<std::uint8_t, net::kMaxUdpDatagram> buffer{};
    while (g_stop == 0) {
        asio::ip::udp::endpoint from;
        const std::size_t size =
            socket.receiveFor(buffer.data(), buffer.size(), from, std::chrono::milliseconds(2));
        if (size != 0) {
            server::IncomingDatagram datagram;
            datagram.bytes.assign(buffer.begin(), buffer.begin() + size);
            datagram.from = from;
            queues.pushIncoming(std::move(datagram));
        }

        for (auto &datagram : queues.takeOutgoing()) {
            socket.send(datagram.bytes.data(), datagram.bytes.size(), datagram.to);
        }
    }
}

} // namespace

int main(int argc, char **argv)
{
    try {
        Options options;
        if (!parseOptions(argc, argv, options)) {
            printUsage(argv[0]);
            return 1;
        }

        std::signal(SIGINT, handleSignal);
        std::signal(SIGTERM, handleSignal);

        net::UdpSocket socket(options.port);
        server::DatagramQueues queues;

        std::cout << "r-type_server: room instance " << options.roomInstance << " difficulty "
                  << game::difficultyName(options.difficulty) << ", mode "
                  << game::modeName(options.mode) << ", listening on UDP port " << socket.port()
                  << std::endl;

        std::thread networkThread([&] {
            try {
                runNetwork(socket, queues);
            } catch (const std::exception &error) {
                std::cerr << "r-type_server: network thread: " << error.what() << '\n';
                g_stop = 1;
            }
        });
        std::thread gameThread([&] {
            try {
                runGame(options, queues);
            } catch (const std::exception &error) {
                std::cerr << "r-type_server: game thread: " << error.what() << '\n';
                g_stop = 1;
            }
        });
        networkThread.join();
        gameThread.join();
        return 0;
    } catch (const std::exception &error) {
        std::cerr << "r-type_server: " << error.what() << '\n';
        return 1;
    }
}
