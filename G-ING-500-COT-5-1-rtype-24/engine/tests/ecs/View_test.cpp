#include "engine/ecs/Registry.hpp"

#include <gtest/gtest.h>
#include <vector>

using engine::Entity;
using engine::Registry;

namespace {
struct Position {
    float x = 0.0f;
    float y = 0.0f;
};

struct Velocity {
    float vx = 0.0f;
    float vy = 0.0f;
};

struct Tag {};

Registry makeRegistry()
{
    Registry reg;
    reg.registerComponent<Position>();
    reg.registerComponent<Velocity>();
    reg.registerComponent<Tag>();
    return reg;
}
} // namespace

TEST(View, VisitsOnlyEntitiesWithEveryComponent)
{
    Registry reg = makeRegistry();
    const Entity both = reg.spawnEntity();
    const Entity onlyPos = reg.spawnEntity();
    const Entity onlyVel = reg.spawnEntity();
    reg.addComponent(both, Position{1.0f, 2.0f});
    reg.addComponent(both, Velocity{3.0f, 4.0f});
    reg.addComponent(onlyPos, Position{});
    reg.addComponent(onlyVel, Velocity{});

    std::vector<Entity> seen;
    for (auto [e, pos, vel] : reg.view<Position, Velocity>()) {
        seen.push_back(e);
        EXPECT_FLOAT_EQ(pos.x, 1.0f);
        EXPECT_FLOAT_EQ(vel.vy, 4.0f);
    }
    ASSERT_EQ(seen.size(), 1U);
    EXPECT_EQ(seen[0], both);
}

TEST(View, ModificationsGoToTheRegistry)
{
    Registry reg = makeRegistry();
    const Entity e = reg.spawnEntity();
    reg.addComponent(e, Position{0.0f, 0.0f});
    reg.addComponent(e, Velocity{2.0f, -1.0f});

    for (auto [entity, pos, vel] : reg.view<Position, Velocity>()) {
        pos.x += vel.vx;
        pos.y += vel.vy;
    }
    EXPECT_FLOAT_EQ(reg.getComponent<Position>(e)->x, 2.0f);
    EXPECT_FLOAT_EQ(reg.getComponent<Position>(e)->y, -1.0f);
}

TEST(View, EachGivesTheEntityAndComponents)
{
    Registry reg = makeRegistry();
    const Entity a = reg.spawnEntity();
    const Entity b = reg.spawnEntity();
    reg.addComponent(a, Position{1.0f, 0.0f});
    reg.addComponent(b, Position{2.0f, 0.0f});

    float sum = 0.0f;
    std::vector<Entity> seen;
    reg.view<Position>().each([&](Entity e, Position &pos) {
        seen.push_back(e);
        sum += pos.x;
    });
    EXPECT_FLOAT_EQ(sum, 3.0f);
    EXPECT_EQ(seen, (std::vector<Entity>{a, b}));
}

TEST(View, SkipsKilledEntitiesAndGivesCurrentHandles)
{
    Registry reg = makeRegistry();
    const Entity dead = reg.spawnEntity();
    reg.addComponent(dead, Position{});
    reg.killEntity(dead);
    const Entity reborn = reg.spawnEntity(); // reuses the slot, new generation
    reg.addComponent(reborn, Position{});

    std::vector<Entity> seen;
    for (auto [e, pos] : reg.view<Position>()) {
        seen.push_back(e);
    }
    ASSERT_EQ(seen.size(), 1U);
    EXPECT_EQ(seen[0], reborn);
    EXPECT_NE(seen[0], dead);
}

TEST(View, EmptyAndCount)
{
    Registry reg = makeRegistry();
    EXPECT_EQ((reg.view<Position, Velocity>().count()), 0U);
    EXPECT_TRUE(reg.view<Position>().begin() == reg.view<Position>().end());

    for (int i = 0; i < 5; ++i) {
        const Entity e = reg.spawnEntity();
        reg.addComponent(e, Position{});
        if (i % 2 == 0) {
            reg.addComponent(e, Tag{});
        }
    }
    EXPECT_EQ(reg.view<Position>().count(), 5U);
    EXPECT_EQ((reg.view<Position, Tag>().count()), 3U);
}

TEST(View, UnregisteredComponentThrows)
{
    Registry reg;
    reg.registerComponent<Position>();
    EXPECT_THROW(((void)reg.view<Position, Velocity>()), engine::ComponentNotRegistered);
}

TEST(View, CollectThenKillAfterTheLoop)
{
    Registry reg = makeRegistry();
    for (int i = 0; i < 4; ++i) {
        const Entity e = reg.spawnEntity();
        reg.addComponent(e, Position{static_cast<float>(i), 0.0f});
    }
    std::vector<Entity> doomed;
    reg.view<Position>().each([&](Entity e, Position &pos) {
        if (pos.x >= 2.0f) {
            doomed.push_back(e);
        }
    });
    for (const Entity e : doomed) {
        reg.killEntity(e);
    }
    EXPECT_EQ(reg.view<Position>().count(), 2U);
    EXPECT_EQ(reg.aliveCount(), 2U);
}
