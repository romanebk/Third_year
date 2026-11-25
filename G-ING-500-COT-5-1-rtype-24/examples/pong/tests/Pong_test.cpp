#include "Pong.hpp"
#include "engine/subsystems/Null.hpp"

#include <gtest/gtest.h>
#include <string>
#include <vector>

using namespace pong;

namespace {
Position &posOf(PongGame &g, engine::Entity e)
{
    return *g.registry().getComponent<Position>(e);
}
Velocity &velOf(PongGame &g, engine::Entity e)
{
    return *g.registry().getComponent<Velocity>(e);
}
constexpr float kDt = 1.0f / 60.0f;
} // namespace

TEST(Pong, RulesAreSystemsInOrder)
{
    PongGame game;
    EXPECT_EQ(game.systems().names(),
              (std::vector<std::string>{"input", "movement", "paddle-bounds", "ball-walls",
                                        "ball-paddles", "goal"}));
}

TEST(Pong, PaddleFollowsControlsAndStaysOnScreen)
{
    PongGame game;
    const engine::Entity left = game.paddle(0);
    const float start = posOf(game, left).y;
    game.setControls({true, false, false, false}); // left up
    game.step(kDt);
    EXPECT_LT(posOf(game, left).y, start);

    for (int i = 0; i < 300; ++i) {
        game.step(kDt);
    }
    EXPECT_FLOAT_EQ(posOf(game, left).y, 0.0f); // clamped at the top
}

TEST(Pong, BallBouncesOnTheTopWall)
{
    PongGame game;
    posOf(game, game.ball()) = {kWidth / 2.0f, 1.0f};
    velOf(game, game.ball()) = {0.0f, -200.0f};
    game.step(kDt);
    EXPECT_GT(velOf(game, game.ball()).y, 0.0f);
}

TEST(Pong, BallBouncesOnAPaddleAndSpeedsUp)
{
    PongGame game;
    int bounces = 0;
    game.events().subscribe<Bounce>([&](const Bounce &) { ++bounces; });
    const Position paddle = posOf(game, game.paddle(0));
    posOf(game, game.ball()) = {paddle.x + kPaddleWidth - 2.0f, paddle.y + kPaddleHeight / 2.0f};
    velOf(game, game.ball()) = {-kBallSpeed, 0.0f};

    game.step(kDt);
    EXPECT_GT(velOf(game, game.ball()).x, kBallSpeed * 0.99f); // sent back to the right
    EXPECT_EQ(bounces, 1);
}

TEST(Pong, MissedBallScoresAndServesAgain)
{
    PongGame game;
    int goals = 0;
    game.events().subscribe<Goal>([&](const Goal &g) {
        ++goals;
        EXPECT_EQ(g.scorer, 1);
    });
    posOf(game, game.ball()) = {-kBallSize - 5.0f, kHeight / 2.0f};
    velOf(game, game.ball()) = {-kBallSpeed, 0.0f};
    game.step(kDt);

    EXPECT_EQ(goals, 1);
    EXPECT_EQ(game.score(1), 1);
    EXPECT_EQ(game.score(0), 0);
    // Back in the middle, served towards the left, who conceded.
    EXPECT_NEAR(posOf(game, game.ball()).x, (kWidth - kBallSize) / 2.0f, 1.0f);
    EXPECT_LT(velOf(game, game.ball()).x, 0.0f);
}

TEST(Pong, FirstToFiveWinsAndTheGameStops)
{
    PongGame game;
    for (int i = 0; i < kWinningScore; ++i) {
        posOf(game, game.ball()) = {kWidth + 5.0f, kHeight / 2.0f};
        game.step(kDt);
    }
    EXPECT_TRUE(game.finished());
    EXPECT_EQ(game.winner(), 0);
    const Position frozen = posOf(game, game.ball());
    game.step(kDt);
    EXPECT_FLOAT_EQ(posOf(game, game.ball()).x, frozen.x);
}

TEST(Pong, RendersThroughAnyIGraphics)
{
    PongGame game;
    engine::NullGraphics graphics;
    graphics.open(800, 480, "pong");
    game.render(graphics);
    // net (20 dashes) + 2 paddles + ball, no score yet
    EXPECT_EQ(graphics.drawCalls(), 23U);
}
