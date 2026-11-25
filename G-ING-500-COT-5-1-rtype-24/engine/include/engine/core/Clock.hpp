#pragma once

#include <chrono>

namespace engine {

// Measures real time between two calls (steady clock: never jumps back).
//
//   engine::Stopwatch watch;
//   double dt = watch.restart();   // seconds since the previous restart
class Stopwatch {
public:
    Stopwatch() : _start(Clock::now()) {}

    // Seconds since construction or the last restart().
    [[nodiscard]] double elapsed() const
    {
        return std::chrono::duration<double>(Clock::now() - _start).count();
    }

    // Returns elapsed() and starts measuring again.
    double restart()
    {
        const auto now = Clock::now();
        const double seconds = std::chrono::duration<double>(now - _start).count();
        _start = now;
        return seconds;
    }

private:
    using Clock = std::chrono::steady_clock;
    Clock::time_point _start;
};

// Fixed time step: the simulation always advances by the same `step`, whatever
// the frame rate, so the game runs at the same speed on every machine.
//
//   engine::FixedStep ticks(1.0 / 60.0);
//   ticks.update(watch.restart(), [&](double step) { scheduler.run(registry, float(step)); });
//
// At most `maxSteps` steps run per update: after a long freeze the lost time is
// dropped instead of replaying hundreds of steps at once.
class FixedStep {
public:
    // Throws std::invalid_argument if step <= 0 or maxSteps == 0.
    explicit FixedStep(double step, unsigned maxSteps = 5);

    // Adds `elapsed` seconds (negative values are ignored) and returns how many
    // steps are due now.
    unsigned advance(double elapsed);

    // advance(), then calls fn(step) once per due step. Returns the step count.
    template <typename Fn>
    unsigned update(double elapsed, Fn &&fn)
    {
        const unsigned steps = advance(elapsed);
        for (unsigned i = 0; i < steps; ++i) {
            fn(_step);
        }
        return steps;
    }

    [[nodiscard]] double step() const noexcept { return _step; }
    // Fraction of a step already accumulated, in [0, 1): use it to interpolate
    // what is drawn between two simulation steps.
    [[nodiscard]] double alpha() const noexcept { return _accumulator / _step; }
    void reset() noexcept { _accumulator = 0.0; }

private:
    double _step;
    unsigned _maxSteps;
    double _accumulator = 0.0;
};

} // namespace engine
