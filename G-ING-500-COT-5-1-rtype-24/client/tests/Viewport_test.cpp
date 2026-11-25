#include "render/Viewport.hpp"

#include <gtest/gtest.h>

using client::letterboxViewport;

namespace {

constexpr float kW = 960.0f;
constexpr float kH = 540.0f;

} // namespace

TEST(Viewport, AWindowWithTheShapeOfTheGameIsFilledCompletely)
{
    for (const sf::Vector2u size : {sf::Vector2u{960, 540}, sf::Vector2u{1280, 720},
                                    sf::Vector2u{1920, 1080}, sf::Vector2u{3840, 2160}}) {
        const sf::FloatRect view = letterboxViewport(size, kW, kH);
        EXPECT_NEAR(view.position.x, 0.0f, 1e-5f);
        EXPECT_NEAR(view.position.y, 0.0f, 1e-5f);
        EXPECT_NEAR(view.size.x, 1.0f, 1e-5f);
        EXPECT_NEAR(view.size.y, 1.0f, 1e-5f);
    }
}

TEST(Viewport, AWiderWindowGetsBarsOnTheLeftAndTheRight)
{
    // 21:9 ultrawide: 2560 x 1080 (ratio 2.37) against 16:9 (1.78): 75 % of the width.
    const sf::FloatRect view = letterboxViewport({2560, 1080}, kW, kH);

    EXPECT_NEAR(view.size.x, 0.75f, 1e-4f);
    EXPECT_FLOAT_EQ(view.size.y, 1.0f);
    EXPECT_NEAR(view.position.x, 0.125f, 1e-4f);
    EXPECT_FLOAT_EQ(view.position.y, 0.0f);
}

TEST(Viewport, ATallerWindowGetsBarsAboveAndBelow)
{
    // A square window: the game is 56.25 % of the height, centered.
    const sf::FloatRect view = letterboxViewport({1000, 1000}, kW, kH);

    EXPECT_FLOAT_EQ(view.size.x, 1.0f);
    EXPECT_NEAR(view.size.y, 0.5625f, 1e-4f);
    EXPECT_FLOAT_EQ(view.position.x, 0.0f);
    EXPECT_NEAR(view.position.y, (1.0f - 0.5625f) / 2.0f, 1e-4f);
}

TEST(Viewport, TheDrawnAreaKeepsTheProportionsOfTheGame)
{
    for (const sf::Vector2u size :
         {sf::Vector2u{640, 360}, sf::Vector2u{1500, 700}, sf::Vector2u{700, 1500},
          sf::Vector2u{3440, 1440}, sf::Vector2u{801, 599}}) {
        const sf::FloatRect view = letterboxViewport(size, kW, kH);
        const float pixelsWide = view.size.x * static_cast<float>(size.x);
        const float pixelsHigh = view.size.y * static_cast<float>(size.y);
        EXPECT_NEAR(pixelsWide / pixelsHigh, kW / kH, 1e-3f) << size.x << "x" << size.y;
    }
}

TEST(Viewport, TheDrawnAreaIsCenteredAndInsideTheWindow)
{
    for (const sf::Vector2u size : {sf::Vector2u{640, 360}, sf::Vector2u{1500, 700},
                                    sf::Vector2u{700, 1500}, sf::Vector2u{3440, 1440}}) {
        const sf::FloatRect view = letterboxViewport(size, kW, kH);
        EXPECT_GE(view.position.x, 0.0f);
        EXPECT_GE(view.position.y, 0.0f);
        EXPECT_LE(view.position.x + view.size.x, 1.0f + 1e-5f);
        EXPECT_LE(view.position.y + view.size.y, 1.0f + 1e-5f);
        // equal bars on both sides
        EXPECT_NEAR(view.position.x, 1.0f - (view.position.x + view.size.x), 1e-5f);
        EXPECT_NEAR(view.position.y, 1.0f - (view.position.y + view.size.y), 1e-5f);
    }
}

TEST(Viewport, AnEmptyWindowGivesTheWholeWindow)
{
    for (const sf::Vector2u size :
         {sf::Vector2u{0, 0}, sf::Vector2u{0, 720}, sf::Vector2u{1280, 0}}) {
        const sf::FloatRect view = letterboxViewport(size, kW, kH);
        EXPECT_FLOAT_EQ(view.size.x, 1.0f);
        EXPECT_FLOAT_EQ(view.size.y, 1.0f);
        EXPECT_FLOAT_EQ(view.position.x, 0.0f);
        EXPECT_FLOAT_EQ(view.position.y, 0.0f);
    }
}

TEST(Viewport, AnInvalidGameAreaGivesTheWholeWindow)
{
    const sf::FloatRect view = letterboxViewport({1280, 720}, 0.0f, 540.0f);

    EXPECT_FLOAT_EQ(view.size.x, 1.0f);
    EXPECT_FLOAT_EQ(view.size.y, 1.0f);
}

TEST(CoverRect, AnImageWithTheShapeOfTheAreaFillsItExactly)
{
    const sf::FloatRect rect = client::coverRect({1920.0f, 1080.0f}, {1280.0f, 720.0f});
    EXPECT_NEAR(rect.position.x, 0.0f, 1e-3f);
    EXPECT_NEAR(rect.position.y, 0.0f, 1e-3f);
    EXPECT_NEAR(rect.size.x, 1280.0f, 1e-3f);
    EXPECT_NEAR(rect.size.y, 720.0f, 1e-3f);
}

TEST(CoverRect, ATallerAreaCropsTheSidesAndKeepsTheProportions)
{
    const sf::FloatRect rect = client::coverRect({1600.0f, 900.0f}, {800.0f, 800.0f});
    EXPECT_NEAR(rect.size.y, 800.0f, 1e-3f);
    EXPECT_NEAR(rect.size.x / rect.size.y, 1600.0f / 900.0f, 1e-4f);
    EXPECT_LT(rect.position.x, 0.0f);
    EXPECT_NEAR(rect.position.x + rect.size.x / 2.0f, 400.0f, 1e-3f);
}

TEST(CoverRect, AWiderAreaCropsTheTopAndTheBottom)
{
    // Ultrawide window: the picture is scaled to the width.
    const sf::FloatRect rect = client::coverRect({1376.0f, 768.0f}, {2560.0f, 1080.0f});
    EXPECT_NEAR(rect.size.x, 2560.0f, 1e-2f);
    EXPECT_GE(rect.size.y, 1080.0f);
    EXPECT_LE(rect.position.y, 0.0f);
}

TEST(CoverRect, AnEmptyImageGivesTheArea)
{
    const sf::FloatRect rect = client::coverRect({0.0f, 0.0f}, {640.0f, 360.0f});
    EXPECT_EQ(rect.size.x, 640.0f);
    EXPECT_EQ(rect.size.y, 360.0f);
}
