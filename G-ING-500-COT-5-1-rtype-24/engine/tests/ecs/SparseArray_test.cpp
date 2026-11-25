#include "engine/ecs/SparseArray.hpp"

#include <gtest/gtest.h>
#include <string>

using engine::SparseArray;

namespace {
struct Vec2 {
    float x = 0.0f;
    float y = 0.0f;
    Vec2() = default;
    Vec2(float px, float py) : x(px), y(py) {}
};
} // namespace

TEST(SparseArray, StartsEmpty)
{
    SparseArray<int> arr;
    EXPECT_EQ(arr.size(), 0U);
    EXPECT_FALSE(arr.contains(0));
}

TEST(SparseArray, InsertGrowsAndLeavesHolesEmpty)
{
    SparseArray<int> arr;
    arr.insertAt(3, 42);
    ASSERT_EQ(arr.size(), 4U);
    EXPECT_FALSE(arr[0]);
    EXPECT_FALSE(arr[2]);
    ASSERT_TRUE(arr[3]);
    EXPECT_EQ(*arr[3], 42);
}

TEST(SparseArray, InsertOverwritesExistingSlot)
{
    SparseArray<std::string> arr;
    arr.insertAt(0, std::string("a"));
    arr.insertAt(0, std::string("b"));
    EXPECT_EQ(*arr[0], "b");
}

TEST(SparseArray, EmplaceConstructsInPlace)
{
    SparseArray<Vec2> arr;
    auto &slot = arr.emplaceAt(1, 2.0f, 3.0f);
    ASSERT_TRUE(slot);
    EXPECT_FLOAT_EQ(slot->x, 2.0f);
    EXPECT_FLOAT_EQ(arr[1]->y, 3.0f);
}

TEST(SparseArray, EraseEmptiesSlotAndIgnoresOutOfRange)
{
    SparseArray<int> arr;
    arr.insertAt(0, 1);
    arr.erase(0);
    EXPECT_FALSE(arr.contains(0));
    arr.erase(100);
    EXPECT_EQ(arr.size(), 1U);
}

TEST(SparseArray, ConstAccessOutOfRangeIsEmptyAndDoesNotGrow)
{
    SparseArray<int> arr;
    const auto &carr = arr;
    EXPECT_FALSE(carr[50]);
    EXPECT_EQ(arr.size(), 0U);
}

TEST(SparseArray, MutableAccessAllowsInPlaceModification)
{
    SparseArray<Vec2> arr;
    arr.insertAt(0, Vec2{1.0f, 1.0f});
    arr[0]->x += 4.0f;
    EXPECT_FLOAT_EQ(arr[0]->x, 5.0f);
}

TEST(SparseArray, IteratesOverAllSlots)
{
    SparseArray<int> arr;
    arr.insertAt(0, 1);
    arr.insertAt(2, 3);
    int sum = 0;
    int filled = 0;
    for (const auto &slot : arr) {
        if (slot) {
            sum += *slot;
            ++filled;
        }
    }
    EXPECT_EQ(sum, 4);
    EXPECT_EQ(filled, 2);
}
