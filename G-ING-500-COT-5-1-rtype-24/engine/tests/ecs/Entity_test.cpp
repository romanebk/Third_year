#include "engine/ecs/Entity.hpp"

#include <gtest/gtest.h>
#include <unordered_set>

using engine::Entity;

TEST(Entity, ExposesIndexAndGeneration)
{
    constexpr Entity e{7, 3};
    static_assert(e.index() == 7);
    static_assert(e.generation() == 3);
    EXPECT_EQ(static_cast<std::size_t>(e), 7U);
}

TEST(Entity, EqualityComparesIndexAndGeneration)
{
    EXPECT_EQ((Entity{1, 0}), (Entity{1, 0}));
    EXPECT_NE((Entity{1, 0}), (Entity{1, 1}));
    EXPECT_NE((Entity{1, 0}), (Entity{2, 0}));
}

TEST(Entity, IsHashable)
{
    std::unordered_set<Entity> set{{1, 0}, {1, 1}, {1, 0}};
    EXPECT_EQ(set.size(), 2U);
}
