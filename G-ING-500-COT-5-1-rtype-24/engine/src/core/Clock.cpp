#include "engine/core/Clock.hpp"

#include <cmath>
#include <stdexcept>

namespace engine {

FixedStep::FixedStep(double step, unsigned maxSteps) : _step(step), _maxSteps(maxSteps)
{
    if (!(step > 0.0)) {
        throw std::invalid_argument("FixedStep: step must be > 0");
    }
    if (maxSteps == 0) {
        throw std::invalid_argument("FixedStep: maxSteps must be > 0");
    }
}

unsigned FixedStep::advance(double elapsed)
{
    if (elapsed > 0.0) {
        _accumulator += elapsed;
    }
    // Rounding (0.25 - 0.1 - 0.1 + 0.05 = 0.0999...) must not lose a step.
    const double tolerance = _step * 1e-9;
    unsigned steps = 0;
    while (_accumulator + tolerance >= _step && steps < _maxSteps) {
        _accumulator -= _step;
        ++steps;
    }
    if (_accumulator + tolerance >= _step) {
        // Too far behind: keep only the part of the current step.
        _accumulator = std::fmod(_accumulator, _step);
    }
    if (_accumulator < 0.0) {
        _accumulator = 0.0;
    }
    return steps;
}

} // namespace engine
