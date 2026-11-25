#include "engine/ecs/Registry.hpp"

#include <gtest/gtest.h>

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
} // namespace

TEST(Registry, RegisterIsIdempotentAndReturnsSameStorage)
{
    Registry reg;
    auto &a = reg.registerComponent<Position>();
    auto &b = reg.registerComponent<Position>();
    EXPECT_EQ(&a, &b);
    EXPECT_TRUE(reg.isRegistered<Position>());
    EXPECT_FALSE(reg.isRegistered<Velocity>());
}

TEST(Registry, StorageReferenceSurvivesOtherRegistrations)
{
    Registry reg;
    auto *positions = &reg.registerComponent<Position>();
    reg.registerComponent<Velocity>();
    reg.registerComponent<Tag>();
    EXPECT_EQ(positions, &reg.getComponents<Position>());
}

TEST(Registry, UnregisteredComponentThrows)
{
    Registry reg;
    const Entity e = reg.spawnEntity();
    EXPECT_THROW(reg.getComponents<Position>(), engine::ComponentNotRegistered);
    EXPECT_THROW(reg.addComponent(e, Position{}), engine::ComponentNotRegistered);
}

TEST(Registry, SpawnGivesDistinctAliveEntities)
{
    Registry reg;
    const Entity a = reg.spawnEntity();
    const Entity b = reg.spawnEntity();
    EXPECT_NE(a, b);
    EXPECT_TRUE(reg.isAlive(a));
    EXPECT_TRUE(reg.isAlive(b));
    EXPECT_EQ(reg.aliveCount(), 2U);
}

TEST(Registry, AddEmplaceGetRemove)
{
    Registry reg;
    reg.registerComponent<Position>();
    reg.registerComponent<Velocity>();
    const Entity e = reg.spawnEntity();

    reg.addComponent(e, Position{1.0f, 2.0f});
    auto &vel = reg.emplaceComponent<Velocity>(e, 3.0f, 4.0f);
    EXPECT_FLOAT_EQ(vel.vy, 4.0f);

    ASSERT_TRUE(reg.hasComponent<Position>(e));
    EXPECT_FLOAT_EQ(reg.getComponent<Position>(e)->x, 1.0f);

    auto &positions = reg.getComponents<Position>();
    positions[e]->x += 10.0f;
    EXPECT_FLOAT_EQ(reg.getComponent<Position>(e)->x, 11.0f);

    reg.removeComponent<Velocity>(e);
    EXPECT_FALSE(reg.hasComponent<Velocity>(e));
    EXPECT_EQ(reg.getComponent<Velocity>(e), nullptr);
    EXPECT_TRUE(reg.hasComponent<Position>(e));
}

TEST(Registry, KillRemovesAllComponents)
{
    Registry reg;
    reg.registerComponent<Position>();
    reg.registerComponent<Velocity>();
    const Entity e = reg.spawnEntity();
    reg.addComponent(e, Position{});
    reg.addComponent(e, Velocity{});

    reg.killEntity(e);
    EXPECT_FALSE(reg.isAlive(e));
    EXPECT_EQ(reg.aliveCount(), 0U);
    EXPECT_FALSE(reg.getComponents<Position>().contains(e.index()));
    EXPECT_FALSE(reg.getComponents<Velocity>().contains(e.index()));
}

TEST(Registry, KilledIndexIsReusedWithNewGeneration)
{
    Registry reg;
    reg.registerComponent<Position>();
    const Entity old = reg.spawnEntity();
    reg.killEntity(old);
    const Entity fresh = reg.spawnEntity();

    EXPECT_EQ(fresh.index(), old.index());
    EXPECT_NE(fresh.generation(), old.generation());
    EXPECT_FALSE(reg.isAlive(old));
    EXPECT_TRUE(reg.isAlive(fresh));
}

TEST(Registry, StaleHandleCannotTouchNewEntity)
{
    Registry reg;
    reg.registerComponent<Position>();
    const Entity old = reg.spawnEntity();
    reg.killEntity(old);
    const Entity fresh = reg.spawnEntity();
    reg.addComponent(fresh, Position{5.0f, 5.0f});

    EXPECT_THROW(reg.addComponent(old, Position{}), engine::DeadEntity);
    EXPECT_FALSE(reg.hasComponent<Position>(old));
    EXPECT_EQ(reg.getComponent<Position>(old), nullptr);
    reg.removeComponent<Position>(old);
    reg.killEntity(old);
    EXPECT_TRUE(reg.isAlive(fresh));
    EXPECT_FLOAT_EQ(reg.getComponent<Position>(fresh)->x, 5.0f);
}

TEST(Registry, KillTwiceIsHarmless)
{
    Registry reg;
    const Entity e = reg.spawnEntity();
    reg.killEntity(e);
    reg.killEntity(e);
    EXPECT_EQ(reg.aliveCount(), 0U);
    const Entity a = reg.spawnEntity();
    const Entity b = reg.spawnEntity();
    EXPECT_NE(a.index(), b.index());
}

TEST(Registry, EntityFromIndexReturnsCurrentHandle)
{
    Registry reg;
    const Entity e = reg.spawnEntity();
    EXPECT_EQ(reg.entityFromIndex(e.index()), e);
    reg.killEntity(e);
    EXPECT_THROW((void)reg.entityFromIndex(e.index()), std::out_of_range);
    EXPECT_THROW((void)reg.entityFromIndex(999), std::out_of_range);
}

TEST(Registry, ReadsOnDeadEntityDoNotGrowStorage)
{
    Registry reg;
    reg.registerComponent<Position>();
    EXPECT_EQ(reg.getComponent<Position>(Entity{500, 0}), nullptr);
    EXPECT_EQ(reg.getComponents<Position>().size(), 0U);
}

TEST(Registry, ConstAccess)
{
    Registry reg;
    reg.registerComponent<Position>();
    const Entity e = reg.spawnEntity();
    reg.addComponent(e, Position{2.0f, 0.0f});

    const Registry &creg = reg;
    EXPECT_TRUE(creg.hasComponent<Position>(e));
    EXPECT_FLOAT_EQ(creg.getComponent<Position>(e)->x, 2.0f);
    EXPECT_TRUE(creg.getComponents<Position>().contains(e.index()));
}
