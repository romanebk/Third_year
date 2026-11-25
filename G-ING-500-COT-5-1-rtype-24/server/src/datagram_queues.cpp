#include "server/datagram_queues.hpp"

#include <iterator>
#include <utility>

namespace server {

namespace {

template <typename Datagram>
void push(std::deque<Datagram> &queue, Datagram datagram, std::size_t capacity)
{
    if (queue.size() >= capacity) {
        queue.pop_front();
    }
    queue.push_back(std::move(datagram));
}

template <typename Datagram>
std::vector<Datagram> take(std::deque<Datagram> &queue)
{
    std::vector<Datagram> datagrams;
    datagrams.reserve(queue.size());
    std::move(queue.begin(), queue.end(), std::back_inserter(datagrams));
    queue.clear();
    return datagrams;
}

} // namespace

bool DatagramQueues::pushIncoming(IncomingDatagram datagram)
{
    std::lock_guard<std::mutex> lock(_mutex);
    const bool kept = _incoming.size() < kMaxIncoming;
    push(_incoming, std::move(datagram), kMaxIncoming);
    return kept;
}

bool DatagramQueues::pushOutgoing(OutgoingDatagram datagram)
{
    std::lock_guard<std::mutex> lock(_mutex);
    const bool kept = _outgoing.size() < kMaxOutgoing;
    push(_outgoing, std::move(datagram), kMaxOutgoing);
    return kept;
}

std::vector<IncomingDatagram> DatagramQueues::takeIncoming()
{
    std::lock_guard<std::mutex> lock(_mutex);
    return take(_incoming);
}

std::vector<OutgoingDatagram> DatagramQueues::takeOutgoing()
{
    std::lock_guard<std::mutex> lock(_mutex);
    return take(_outgoing);
}

} // namespace server
