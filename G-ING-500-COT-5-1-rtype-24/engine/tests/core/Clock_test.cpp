#include "engine/core/Clock.hpp"

#include <gtest/gtest.h>
#include <stdexcept>

using engine::FixedStep;

TEST(FixedStep, CountsWholeStepsAndKeepsTheRest)
{
    FixedStep ticks(0.1);
    EXPECT_EQ(ticks.advance(0.25), 2U);
    EXPECT_NEAR(ticks.alpha(), 0.5, 1e-9);
    EXPECT_EQ(ticks.advance(0.05), 1U); // 0.05 left + 0.05 = one more step
    EXPECT_NEAR(ticks.alpha(), 0.0, 1e-9);
}

TEST(FixedStep, SmallFramesAccumulate)
{
    FixedStep ticks(1.0 / 60.0);
    unsigned total = 0;
    for (int frame = 0; frame < 144; ++frame) { // one second at 144 frames per second
        total += ticks.advance(1.0 / 144.0);
    }
    EXPECT_EQ(total, 60U); // rounding must not lose a step
}

TEST(FixedStep, UpdateCallsTheStepFunction)
{
    FixedStep ticks(0.5);
    double simulated = 0.0;
    const unsigned steps = ticks.update(1.2, [&](double step) { simulated += step; });
    EXPECT_EQ(steps, 2U);
    EXPECT_DOUBLE_EQ(simulated, 1.0);
}

TEST(FixedStep, LongFreezeIsCappedAndForgotten)
{
    FixedStep ticks(0.1, 5);
    EXPECT_EQ(ticks.advance(10.0), 5U); // not 100 steps
    EXPECT_LT(ticks.alpha(), 1.0);      // the backlog was dropped
    EXPECT_EQ(ticks.advance(0.0), 0U);
}

TEST(FixedStep, NegativeTimeIsIgnoredAndResetClears)
{
    FixedStep ticks(0.1);
    EXPECT_EQ(ticks.advance(-1.0), 0U);
    ticks.advance(0.05);
    ticks.reset();
    EXPECT_DOUBLE_EQ(ticks.alpha(), 0.0);
}

TEST(FixedStep, RejectsInvalidSettings)
{
    EXPECT_THROW(FixedStep(0.0), std::invalid_argument);
    EXPECT_THROW(FixedStep(-1.0), std::invalid_argument);
    EXPECT_THROW(FixedStep(0.1, 0), std::invalid_argument);
}

TEST(Stopwatch, MeasuresForwardTime)
{
    engine::Stopwatch watch;
    const double first = watch.restart();
    EXPECT_GE(first, 0.0);
    EXPECT_GE(watch.elapsed(), 0.0);
}
