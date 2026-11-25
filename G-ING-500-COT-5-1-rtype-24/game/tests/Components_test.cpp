#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

#include <cstdint>
#include <gtest/gtest.h>
#include <type_traits>

using engine::Entity;
using engine::Registry;
using game::Collider;
using game::Health;
using game::Input;
using game::Position;
using game::Team;
using game::Velocity;

TEST(Components, HaveSaneDefaults)
{
    const Position p;
    EXPECT_FLOAT_EQ(p.x, 0.0f);
    EXPECT_FLOAT_EQ(p.y, 0.0f);
    const Velocity v;
    EXPECT_FLOAT_EQ(v.vx, 0.0f);
    EXPECT_FLOAT_EQ(v.vy, 0.0f);
    const Health h;
    EXPECT_EQ(h.hp, 1);
    EXPECT_EQ(h.maxHp, 1);
    const Collider c;
    EXPECT_FLOAT_EQ(c.w, 0.0f);
    EXPECT_FLOAT_EQ(c.h, 0.0f);
    EXPECT_TRUE(c.solid);
    const Input in;
    EXPECT_EQ(game::inputMask(in), 0u);
    EXPECT_EQ(in.seq, 0u);
}

TEST(Components, StayPodSerializable)
{
    // The network layer memcpys these into snapshots.
    static_assert(std::is_trivially_copyable_v<Position>);
    static_assert(std::is_trivially_copyable_v<Velocity>);
    static_assert(std::is_trivially_copyable_v<Health>);
    static_assert(std::is_trivially_copyable_v<Collider>);
    static_assert(std::is_trivially_copyable_v<Input>);
    static_assert(sizeof(Team) == 1, "Team must fit in 1 byte on the wire");
    static_assert(static_cast<std::uint8_t>(Team::Neutral) == 8);
}

TEST(Components, InputMaskRoundTrips)
{
    Input in;
    in.up = true;
    in.fire = true;
    in.detach = true;
    in.seq = 42;
    EXPECT_EQ(game::inputMask(in), 1u | 16u | 32u);
    const Input back = game::inputFromMask(game::inputMask(in), 42);
    EXPECT_TRUE(back.up);
    EXPECT_FALSE(back.down);
    EXPECT_FALSE(back.left);
    EXPECT_FALSE(back.right);
    EXPECT_TRUE(back.fire);
    EXPECT_TRUE(back.detach);
    EXPECT_EQ(back.seq, 42u);
}

TEST(Components, MatchGameDesignValues)
{
    // R-9 defaults from docs/game-design.md §3.
    const Position spawn{60.0f, 270.0f};
    EXPECT_FLOAT_EQ(spawn.x, 60.0f);
    EXPECT_FLOAT_EQ(spawn.y, 270.0f);
    const Collider ship{24.0f, 16.0f, 1, true};
    EXPECT_FLOAT_EQ(ship.w, 24.0f);
    EXPECT_FLOAT_EQ(ship.h, 16.0f);
    EXPECT_EQ(ship.layer, 1u);
    const Health oneShot{1, 1};
    EXPECT_EQ(oneShot.hp, oneShot.maxHp);
}

TEST(Components, PlugIntoEngineRegistry)
{
    Registry registry;
    registry.registerComponent<Position>();
    registry.registerComponent<Velocity>();
    registry.registerComponent<Health>();
    registry.registerComponent<Collider>();
    registry.registerComponent<Team>();
    registry.registerComponent<Input>();

    const Entity ship = registry.spawnEntity();
    registry.emplaceComponent<Position>(ship, 60.0f, 270.0f);
    registry.emplaceComponent<Velocity>(ship, 220.0f, 0.0f);
    registry.addComponent(ship, Health{1, 1});
    registry.addComponent(ship, Collider{24.0f, 16.0f, 1, true});
    registry.addComponent(ship, Team::P0);
    registry.emplaceComponent<Input>(ship);

    const auto *pos = registry.getComponent<Position>(ship);
    ASSERT_NE(pos, nullptr);
    EXPECT_FLOAT_EQ(pos->x, 60.0f);
    EXPECT_FLOAT_EQ(pos->y, 270.0f);
    EXPECT_TRUE(registry.hasComponent<Health>(ship));
    const auto *team = registry.getComponent<Team>(ship);
    ASSERT_NE(team, nullptr);
    EXPECT_EQ(*team, Team::P0);

    registry.killEntity(ship);
    EXPECT_FALSE(registry.isAlive(ship));
    EXPECT_EQ(registry.getComponent<Position>(ship), nullptr);
    EXPECT_FALSE(registry.hasComponent<Health>(ship));
}
