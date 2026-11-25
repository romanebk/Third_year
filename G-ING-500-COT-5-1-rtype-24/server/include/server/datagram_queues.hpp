#pragma once

#include <asio/ip/udp.hpp>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <mutex>
#include <vector>

namespace server {

// One datagram received by the network thread, waiting for the game thread.
struct IncomingDatagram {
    std::vector<std::uint8_t> bytes;
    asio::ip::udp::endpoint from;
};

// One datagram prepared by the game thread, waiting for the network thread.
struct OutgoingDatagram {
    std::vector<std::uint8_t> bytes;
    asio::ip::udp::endpoint to;
};

// The only state shared by the two server threads: the network thread pushes
// what it received and takes what must be sent, the game thread does the
// opposite. One mutex protects both queues, so datagrams are never copied
// while another thread is using them.
//
// The queues are bounded. A client that floods the room or a game thread that
// stalls for too long cannot grow the process memory without limit: the oldest
// datagram is dropped, because a fresh INPUT or SNAPSHOT is always more useful
// than a stale one.
class DatagramQueues {
public:
    static constexpr std::size_t kMaxIncoming = 1024;
    static constexpr std::size_t kMaxOutgoing = 4096;

    // False when the datagram was dropped (queue full).
    bool pushIncoming(IncomingDatagram datagram);
    bool pushOutgoing(OutgoingDatagram datagram);

    // Moves the pending datagrams out of the queue, in arrival order.
    std::vector<IncomingDatagram> takeIncoming();
    std::vector<OutgoingDatagram> takeOutgoing();

private:
    std::mutex _mutex;
    std::deque<IncomingDatagram> _incoming;
    std::deque<OutgoingDatagram> _outgoing;
};

} // namespace server
