#include "game/world.hpp"
#include "world/Prediction.hpp"

#include <gtest/gtest.h>

using client::Prediction;

namespace {

// Distance covered by the ship in one tick at the base speed.
const float kStep = game::kPlayerBaseSpeed * game::kTickDt;

game::Input right(std::uint32_t seq)
{
    game::Input input;
    input.right = true;
    input.seq = seq;
    return input;
}

} // namespace

TEST(Prediction, OurShipMovesRightAwayWithOurInputs)
{
    Prediction prediction(0);
    prediction.correct(100.0f, 100.0f, 0, 0);
    for (std::uint32_t seq = 1; seq <= 10; seq++) {
        prediction.addInput(right(seq));
    }
    EXPECT_NEAR(prediction.getX(), 100.0f + 10.0f * kStep, 0.01f);
    EXPECT_NEAR(prediction.getY(), 100.0f, 0.01f);
}

TEST(Prediction, TheInputsTheServerHasNotAppliedArePlayedAgain)
{
    Prediction prediction(0);
    prediction.correct(100.0f, 100.0f, 0, 0);
    for (std::uint32_t seq = 1; seq <= 10; seq++) {
        prediction.addInput(right(seq));
    }
    // The server applied the inputs 1 to 4: the 6 others are played again.
    prediction.correct(100.0f + 4.0f * kStep, 100.0f, 4, 0);
    EXPECT_NEAR(prediction.getX(), 100.0f + 10.0f * kStep, 0.01f);
}

TEST(Prediction, TheServerIsRightAndTheErrorFadesOut)
{
    Prediction prediction(0);
    prediction.correct(100.0f, 100.0f, 0, 0);
    prediction.addInput(right(1));
    // The server says something else (we were hit, pushed...): it wins.
    prediction.correct(120.0f, 130.0f, 1, 0);
    prediction.update(1.0f);
    EXPECT_NEAR(prediction.getX(), 120.0f, 0.01f);
    EXPECT_NEAR(prediction.getY(), 130.0f, 0.01f);
}
