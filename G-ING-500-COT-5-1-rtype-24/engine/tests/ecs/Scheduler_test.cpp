#include "engine/ecs/Registry.hpp"
#include "engine/ecs/Scheduler.hpp"

#include <gtest/gtest.h>
#include <stdexcept>
#include <string>
#include <vector>

using engine::Registry;
using engine::Scheduler;

namespace {
// Each system appends its name, so the tests can check the run order.
Scheduler::System recorder(std::vector<std::string> &log, std::string name)
{
    return [&log, name = std::move(name)](Registry &, float) { log.push_back(name); };
}
} // namespace

TEST(Scheduler, RunsInInsertionOrderByDefault)
{
    std::vector<std::string> log;
    Scheduler s;
    s.add("input", recorder(log, "input"));
    s.add("movement", recorder(log, "movement"));
    s.add("collision", recorder(log, "collision"));
    Registry reg;
    s.run(reg, 0.016f);
    EXPECT_EQ(log, (std::vector<std::string>{"input", "movement", "collision"}));
    EXPECT_EQ(s.names(), log);
}

TEST(Scheduler, OrderBeatsInsertionAndTiesKeepInsertion)
{
    std::vector<std::string> log;
    Scheduler s;
    s.add("render", recorder(log, "render"), 100);
    s.add("a", recorder(log, "a"), 0);
    s.add("early", recorder(log, "early"), -5);
    s.add("b", recorder(log, "b"), 0);
    Registry reg;
    s.run(reg, 0.0f);
    EXPECT_EQ(log, (std::vector<std::string>{"early", "a", "b", "render"}));
}

TEST(Scheduler, PassesRegistryAndDt)
{
    Scheduler s;
    float received = 0.0f;
    Registry *seen = nullptr;
    s.add("probe", [&](Registry &r, float dt) {
        seen = &r;
        received = dt;
    });
    Registry reg;
    s.run(reg, 0.25f);
    EXPECT_EQ(seen, &reg);
    EXPECT_FLOAT_EQ(received, 0.25f);
}

TEST(Scheduler, DisableEnableAndRemove)
{
    std::vector<std::string> log;
    Scheduler s;
    s.add("a", recorder(log, "a"));
    s.add("b", recorder(log, "b"));
    Registry reg;

    EXPECT_TRUE(s.setEnabled("a", false));
    EXPECT_FALSE(s.isEnabled("a"));
    s.run(reg, 0.0f);
    EXPECT_EQ(log, (std::vector<std::string>{"b"}));

    EXPECT_TRUE(s.setEnabled("a", true));
    EXPECT_TRUE(s.remove("b"));
    EXPECT_FALSE(s.contains("b"));
    log.clear();
    s.run(reg, 0.0f);
    EXPECT_EQ(log, (std::vector<std::string>{"a"}));

    EXPECT_FALSE(s.remove("missing"));
    EXPECT_FALSE(s.setEnabled("missing", true));
    EXPECT_EQ(s.size(), 1U);
}

TEST(Scheduler, RejectsBadSystems)
{
    Scheduler s;
    s.add("a", [](Registry &, float) {});
    EXPECT_THROW(s.add("a", [](Registry &, float) {}), std::invalid_argument);
    EXPECT_THROW(s.add("", [](Registry &, float) {}), std::invalid_argument);
    EXPECT_THROW(s.add("empty", Scheduler::System{}), std::invalid_argument);
    EXPECT_EQ(s.size(), 1U);
}

TEST(Scheduler, OneSchedulerDrivesSeveralRegistries)
{
    struct Counter {
        int ticks = 0;
    };
    Scheduler s;
    s.add("count", [](Registry &r, float) {
        for (auto [e, c] : r.view<Counter>()) {
            ++c.ticks;
        }
    });
    Registry r1;
    Registry r2;
    r1.registerComponent<Counter>();
    r2.registerComponent<Counter>();
    const auto e1 = r1.spawnEntity();
    const auto e2 = r2.spawnEntity();
    r1.addComponent(e1, Counter{});
    r2.addComponent(e2, Counter{});
    s.run(r1, 0.0f);
    s.run(r1, 0.0f);
    s.run(r2, 0.0f);
    EXPECT_EQ(r1.getComponent<Counter>(e1)->ticks, 2);
    EXPECT_EQ(r2.getComponent<Counter>(e2)->ticks, 1);
}
