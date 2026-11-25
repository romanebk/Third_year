#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <map>
#include <vector>

namespace net {

// Sequence comparison that survives the u16 wrap (docs/rfc-protocol.md §10):
// true when `candidate` is strictly newer than `reference`.
[[nodiscard]] bool isNewer(std::uint16_t candidate, std::uint16_t reference);

// Sender side of the reliable event stream (§5): keeps the datagrams not
// covered by the cumulative ack yet and hands them back for retransmission
// every 500 ms, at most 10 attempts per event.
class ReliableQueue {
public:
    using Clock = std::chrono::steady_clock;

    static constexpr std::size_t kMaxPending = 32;
    static constexpr int kMaxAttempts = 10;
    static constexpr std::chrono::milliseconds kRetransmitInterval{500};

    // Tracks an encoded datagram. The caller sends it once (the first
    // attempt); collect() returns it again when a retransmission is due.
    bool track(std::uint16_t eventSeq, std::vector<std::uint8_t> datagram, Clock::time_point now);

    // Cumulative ack: forgets every event up to and including `eventSeq`.
    void acknowledge(std::uint16_t eventSeq);

    // Appends the datagrams due for retransmission. Sets failed() when an
    // event reaches kMaxAttempts without being acked.
    void collect(Clock::time_point now, std::vector<std::vector<std::uint8_t>> &out);

    [[nodiscard]] bool failed() const { return _failed; }
    [[nodiscard]] std::size_t pending() const { return _events.size(); }

private:
    struct Event {
        std::uint16_t eventSeq = 0;
        std::vector<std::uint8_t> datagram;
        int attempts = 1;
        Clock::time_point lastSent{};
    };

    std::deque<Event> _events;
    bool _failed = false;
};

// Receiver side of the reliable stream of one sender: events are delivered in
// order, out-of-order ones are buffered (kWindow max). A gap older than the
// window drops the buffer and skips to the new event while asking the caller
// for a full-state resync.
class ReliableReceiver {
public:
    static constexpr std::uint16_t kWindow = 16;

    // Buffers `payload` under `eventSeq` and appends every payload that just
    // became deliverable, in order (usually none or one).
    void receive(std::uint16_t eventSeq, std::vector<std::uint8_t> payload,
                 std::vector<std::vector<std::uint8_t>> &out);

    // Sequence expected next; also the frontier after a resync request.
    [[nodiscard]] std::uint16_t nextSeq() const { return _next; }
    // Highest contiguous sequence received, to piggyback in INPUT/PING.
    [[nodiscard]] std::uint16_t acknowledge() const { return _acked; }
    [[nodiscard]] bool resyncRequested() const { return _resync; }
    void clearResync() { _resync = false; }

private:
    std::map<std::uint16_t, std::vector<std::uint8_t>> _buffered;
    std::uint16_t _next = 1;
    std::uint16_t _acked = 0;
    bool _resync = false;
};

} // namespace net
