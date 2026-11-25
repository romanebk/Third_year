#include "network/reliable.hpp"

#include <utility>

namespace net {

bool isNewer(std::uint16_t candidate, std::uint16_t reference)
{
    return static_cast<std::int16_t>(candidate - reference) > 0;
}

bool ReliableQueue::track(std::uint16_t eventSeq, std::vector<std::uint8_t> datagram,
                          Clock::time_point now)
{
    if (datagram.empty() || _failed || _events.size() >= kMaxPending) {
        return false;
    }
    if (!_events.empty() && !isNewer(eventSeq, _events.back().eventSeq)) {
        return false; // duplicate or stale sequence
    }
    Event event;
    event.eventSeq = eventSeq;
    event.datagram = std::move(datagram);
    event.lastSent = now;
    _events.push_back(std::move(event));
    return true;
}

void ReliableQueue::acknowledge(std::uint16_t eventSeq)
{
    while (!_events.empty() && !isNewer(_events.front().eventSeq, eventSeq)) {
        _events.pop_front();
    }
}

void ReliableQueue::collect(Clock::time_point now, std::vector<std::vector<std::uint8_t>> &out)
{
    if (_failed) {
        return;
    }
    for (auto &event : _events) {
        if (now - event.lastSent < kRetransmitInterval) {
            continue;
        }
        if (event.attempts >= kMaxAttempts) {
            _failed = true;
            return;
        }
        ++event.attempts;
        event.lastSent = now;
        out.push_back(event.datagram);
    }
}

void ReliableReceiver::receive(std::uint16_t eventSeq, std::vector<std::uint8_t> payload,
                               std::vector<std::vector<std::uint8_t>> &out)
{
    if (!isNewer(eventSeq, _acked)) {
        return; // duplicate or already delivered
    }
    if (eventSeq != _next) {
        if (static_cast<std::uint16_t>(eventSeq - _next) > kWindow) {
            // Too old to wait for: drop the buffer, let the caller resync
            // from the next full snapshot, and restart the frontier here.
            _buffered.clear();
            _resync = true;
            _acked = eventSeq;
            _next = static_cast<std::uint16_t>(eventSeq + 1);
            return;
        }
        _buffered.insert_or_assign(eventSeq, std::move(payload));
        return;
    }
    out.push_back(std::move(payload));
    _acked = eventSeq;
    _next = static_cast<std::uint16_t>(eventSeq + 1);
    while (true) {
        const auto it = _buffered.find(_next);
        if (it == _buffered.end()) {
            break;
        }
        out.push_back(std::move(it->second));
        _acked = _next;
        _next = static_cast<std::uint16_t>(_next + 1);
        _buffered.erase(it);
    }
}

} // namespace net
