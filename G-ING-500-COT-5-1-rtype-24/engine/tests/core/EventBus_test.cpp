#include "engine/core/EventBus.hpp"

#include <gtest/gtest.h>
#include <string>
#include <vector>

using engine::EventBus;

namespace {
struct Goal {
    int side = 0;
};
struct Message {
    std::string text;
};
} // namespace

TEST(EventBus, PublishCallsSubscribersOfThatTypeOnly)
{
    EventBus bus;
    std::vector<int> goals;
    int messages = 0;
    bus.subscribe<Goal>([&](const Goal &g) { goals.push_back(g.side); });
    bus.subscribe<Message>([&](const Message &) { ++messages; });

    bus.publish(Goal{1});
    bus.publish(Goal{2});
    EXPECT_EQ(goals, (std::vector<int>{1, 2}));
    EXPECT_EQ(messages, 0);
}

TEST(EventBus, SubscribersRunInSubscriptionOrder)
{
    EventBus bus;
    std::string order;
    bus.subscribe<Goal>([&](const Goal &) { order += 'a'; });
    bus.subscribe<Goal>([&](const Goal &) { order += 'b'; });
    bus.publish(Goal{});
    EXPECT_EQ(order, "ab");
    EXPECT_EQ(bus.subscriberCount<Goal>(), 2U);
}

TEST(EventBus, UnsubscribeStopsDelivery)
{
    EventBus bus;
    int calls = 0;
    const auto token = bus.subscribe<Goal>([&](const Goal &) { ++calls; });
    bus.publish(Goal{});
    EXPECT_TRUE(bus.unsubscribe(token));
    bus.publish(Goal{});
    EXPECT_EQ(calls, 1);
    EXPECT_FALSE(bus.unsubscribe(token));
    EXPECT_EQ(bus.subscriberCount<Goal>(), 0U);
}

TEST(EventBus, PublishWithoutSubscriberIsHarmless)
{
    EventBus bus;
    bus.publish(Message{"nobody listens"});
    EXPECT_EQ(bus.subscriberCount<Message>(), 0U);
}

TEST(EventBus, EnqueuedEventsWaitForDispatch)
{
    EventBus bus;
    std::vector<std::string> seen;
    bus.subscribe<Message>([&](const Message &m) { seen.push_back(m.text); });

    bus.enqueue(Message{"first"});
    bus.enqueue(Message{"second"});
    EXPECT_TRUE(seen.empty());
    EXPECT_EQ(bus.pendingCount(), 2U);

    EXPECT_EQ(bus.dispatch(), 2U);
    EXPECT_EQ(seen, (std::vector<std::string>{"first", "second"}));
    EXPECT_EQ(bus.pendingCount(), 0U);
}

TEST(EventBus, EventsQueuedDuringDispatchWaitForTheNextOne)
{
    EventBus bus;
    int goals = 0;
    bus.subscribe<Goal>([&](const Goal &g) {
        ++goals;
        if (g.side == 0) {
            bus.enqueue(Goal{1}); // a chain reaction must not loop forever
        }
    });
    bus.enqueue(Goal{0});
    EXPECT_EQ(bus.dispatch(), 1U);
    EXPECT_EQ(goals, 1);
    EXPECT_EQ(bus.dispatch(), 1U);
    EXPECT_EQ(goals, 2);
    EXPECT_EQ(bus.dispatch(), 0U);
}

TEST(EventBus, HandlerMayUnsubscribeItselfWhilePublishing)
{
    EventBus bus;
    int calls = 0;
    EventBus::Token token = 0;
    token = bus.subscribe<Goal>([&](const Goal &) {
        ++calls;
        bus.unsubscribe(token);
    });
    bus.publish(Goal{});
    bus.publish(Goal{});
    EXPECT_EQ(calls, 1);
}
