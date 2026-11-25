#include "network/reliable.hpp"

#include <cstdint>
#include <gtest/gtest.h>
#include <vector>

namespace {

using Bytes = std::vector<std::uint8_t>;
using Clock = net::ReliableQueue::Clock;

Bytes payload(std::uint8_t tag)
{
    return Bytes{tag, 0xAA};
}

Clock::time_point at(int milliseconds)
{
    return Clock::time_point{} + std::chrono::milliseconds(milliseconds);
}

} // namespace

TEST(ReliableSequence, ComparesAroundTheWrap)
{
    EXPECT_TRUE(net::isNewer(2, 1));
    EXPECT_FALSE(net::isNewer(1, 1));
    EXPECT_FALSE(net::isNewer(1, 2));
    EXPECT_TRUE(net::isNewer(0, 65535));
    EXPECT_FALSE(net::isNewer(65535, 0));
}

TEST(ReliableQueue, KeepsTheEventUntilItIsAcked)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(1, payload(1), at(0)));
    EXPECT_EQ(queue.pending(), 1u);

    std::vector<Bytes> due;
    queue.collect(at(499), due);
    EXPECT_TRUE(due.empty());

    queue.collect(at(500), due);
    ASSERT_EQ(due.size(), 1u);
    EXPECT_EQ(due.front(), payload(1));

    queue.acknowledge(1);
    EXPECT_EQ(queue.pending(), 0u);
    due.clear();
    queue.collect(at(2000), due);
    EXPECT_TRUE(due.empty());
}

TEST(ReliableQueue, AckIsCumulative)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(1, payload(1), at(0)));
    ASSERT_TRUE(queue.track(2, payload(2), at(0)));
    ASSERT_TRUE(queue.track(3, payload(3), at(0)));

    queue.acknowledge(2);
    EXPECT_EQ(queue.pending(), 1u);

    std::vector<Bytes> due;
    queue.collect(at(500), due);
    ASSERT_EQ(due.size(), 1u);
    EXPECT_EQ(due.front(), payload(3));
}

TEST(ReliableQueue, AckOfZeroKeepsEveryEvent)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(1, payload(1), at(0)));
    queue.acknowledge(0);
    EXPECT_EQ(queue.pending(), 1u);
}

TEST(ReliableQueue, RetransmitsEveryInterval)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(4, payload(4), at(0)));

    std::vector<Bytes> due;
    queue.collect(at(500), due);
    ASSERT_EQ(due.size(), 1u);
    due.clear();
    queue.collect(at(999), due);
    EXPECT_TRUE(due.empty());
    queue.collect(at(1000), due);
    ASSERT_EQ(due.size(), 1u);
}

TEST(ReliableQueue, GivesUpAfterMaxAttempts)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(1, payload(1), at(0)));

    std::vector<Bytes> due;
    for (int attempt = 2; attempt <= net::ReliableQueue::kMaxAttempts; ++attempt) {
        queue.collect(at(attempt * 500), due);
        ASSERT_EQ(due.size(), 1u) << "attempt " << attempt;
        due.clear();
        EXPECT_FALSE(queue.failed()) << "attempt " << attempt;
    }

    queue.collect(at(10000), due);
    EXPECT_TRUE(queue.failed());
    EXPECT_TRUE(due.empty());
}

TEST(ReliableQueue, FailedQueueTakesNoEvent)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(1, payload(1), at(0)));
    std::vector<Bytes> due;
    for (int step = 0; step <= net::ReliableQueue::kMaxAttempts; ++step) {
        queue.collect(at(step * 500), due);
    }
    ASSERT_TRUE(queue.failed());
    EXPECT_FALSE(queue.track(2, payload(2), at(11000)));
}

TEST(ReliableQueue, HoldsAtMostKMaxPending)
{
    net::ReliableQueue queue;
    for (std::uint16_t seq = 1; seq <= net::ReliableQueue::kMaxPending; ++seq) {
        ASSERT_TRUE(queue.track(seq, payload(1), at(0)));
    }
    EXPECT_EQ(queue.pending(), net::ReliableQueue::kMaxPending);
    EXPECT_FALSE(queue.track(33, payload(1), at(0)));
}

TEST(ReliableQueue, RefusesStaleAndEmptyEvents)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(5, payload(5), at(0)));
    EXPECT_FALSE(queue.track(5, payload(5), at(0)));
    EXPECT_FALSE(queue.track(4, payload(4), at(0)));
    EXPECT_FALSE(queue.track(6, {}, at(0)));
    EXPECT_EQ(queue.pending(), 1u);
}

TEST(ReliableQueue, CumulativeAckCrossesTheWrap)
{
    net::ReliableQueue queue;
    ASSERT_TRUE(queue.track(65535, payload(1), at(0)));
    ASSERT_TRUE(queue.track(0, payload(2), at(0)));

    queue.acknowledge(65535);
    EXPECT_EQ(queue.pending(), 1u);

    std::vector<Bytes> due;
    queue.collect(at(500), due);
    ASSERT_EQ(due.size(), 1u);
    EXPECT_EQ(due.front(), payload(2));

    queue.acknowledge(0);
    EXPECT_EQ(queue.pending(), 0u);
}

TEST(ReliableReceiver, DeliversInOrder)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(1, payload(1), out);
    ASSERT_EQ(out.size(), 1u);
    EXPECT_EQ(out.front(), payload(1));
    EXPECT_EQ(receiver.acknowledge(), 1u);
    EXPECT_EQ(receiver.nextSeq(), 2u);
    EXPECT_FALSE(receiver.resyncRequested());
}

TEST(ReliableReceiver, IgnoresDuplicates)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(1, payload(1), out);
    out.clear();
    receiver.receive(1, payload(9), out);
    EXPECT_TRUE(out.empty());
    EXPECT_EQ(receiver.acknowledge(), 1u);
}

TEST(ReliableReceiver, BuffersOutOfOrderEvents)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(2, payload(2), out);
    EXPECT_TRUE(out.empty());
    EXPECT_EQ(receiver.acknowledge(), 0u);

    receiver.receive(1, payload(1), out);
    ASSERT_EQ(out.size(), 2u);
    EXPECT_EQ(out[0], payload(1));
    EXPECT_EQ(out[1], payload(2));
    EXPECT_EQ(receiver.acknowledge(), 2u);
}

TEST(ReliableReceiver, OldEventsAfterDeliveryAreIgnored)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(1, payload(1), out);
    receiver.receive(2, payload(2), out);
    out.clear();
    receiver.receive(1, payload(9), out);
    EXPECT_TRUE(out.empty());
    EXPECT_EQ(receiver.acknowledge(), 2u);
}

TEST(ReliableReceiver, GapInsideTheWindowWaits)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(static_cast<std::uint16_t>(1 + net::ReliableReceiver::kWindow), payload(7),
                     out);
    EXPECT_TRUE(out.empty());
    EXPECT_FALSE(receiver.resyncRequested());

    for (std::uint16_t seq = 1; seq <= net::ReliableReceiver::kWindow; ++seq) {
        receiver.receive(seq, payload(static_cast<std::uint8_t>(seq)), out);
    }
    ASSERT_EQ(out.size(), net::ReliableReceiver::kWindow + 1);
    EXPECT_EQ(out.back(), payload(7));
    EXPECT_EQ(receiver.acknowledge(), 1 + net::ReliableReceiver::kWindow);
}

TEST(ReliableReceiver, TooOldGapSkipsAndRequestsResync)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(static_cast<std::uint16_t>(2 + net::ReliableReceiver::kWindow), payload(9),
                     out);
    EXPECT_TRUE(out.empty());
    EXPECT_TRUE(receiver.resyncRequested());
    EXPECT_EQ(receiver.nextSeq(), 3 + net::ReliableReceiver::kWindow);
    EXPECT_EQ(receiver.acknowledge(), 2 + net::ReliableReceiver::kWindow);

    receiver.receive(3 + net::ReliableReceiver::kWindow, payload(10), out);
    ASSERT_EQ(out.size(), 1u);
    EXPECT_EQ(out.front(), payload(10));
    receiver.clearResync();
    EXPECT_FALSE(receiver.resyncRequested());
}

TEST(ReliableReceiver, ResyncDropsTheBufferedGap)
{
    net::ReliableReceiver receiver;
    std::vector<Bytes> out;
    receiver.receive(2, payload(2), out);
    receiver.receive(30, payload(30), out);
    EXPECT_TRUE(receiver.resyncRequested());

    receiver.receive(31, payload(31), out);
    ASSERT_EQ(out.size(), 1u);
    EXPECT_EQ(out.front(), payload(31));
    EXPECT_EQ(receiver.acknowledge(), 31u);
}
