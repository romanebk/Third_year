#include "world/Prediction.hpp"

#include "game/movement.hpp"
#include "game/player.hpp"
#include "game/setup.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <cmath>

namespace client {

namespace {

// At most 2 seconds of inputs waiting for the server (if it never answers).
const std::size_t kMaxInputs = 120;
// A bigger correction is a jump (respawn...): no smoothing, the ship goes there.
const float kMaxSmoothedError = 60.0f;

engine::Entity createShip(engine::Registry &registry, int playerId)
{
    game::registerGameComponents(registry);
    return game::spawnPlayer(registry, std::clamp(playerId, 0, game::kMaxPlayers - 1));
}

} // namespace

Prediction::Prediction(int playerId) : _ship(createShip(_registry, playerId)) {}

void Prediction::step(const game::Input &input)
{
    // The same movement as the server: keys -> speed -> position -> arena edges.
    if (auto *keys = _registry.getComponent<game::Input>(_ship)) {
        *keys = input;
    }
    game::playerInputSystem(_registry);
    game::integrationSystem(_registry, game::kTickDt);
    game::clampPlayersSystem(_registry);
}

void Prediction::addInput(const game::Input &input)
{
    _inputs.push_back(input);
    if (_inputs.size() > kMaxInputs) {
        _inputs.pop_front();
    }
    step(input);
}

void Prediction::correct(float x, float y, std::uint32_t ackInput, int speedLevel)
{
    const float drawnX = getX();
    const float drawnY = getY();

    // Forget the inputs the server already applied...
    while (!_inputs.empty() && _inputs.front().seq <= ackInput) {
        _inputs.pop_front();
    }
    // ... start again from the server position, and apply the others again.
    if (auto *position = _registry.getComponent<game::Position>(_ship)) {
        *position = game::Position{x, y};
    }
    if (auto *power = _registry.getComponent<game::PowerState>(_ship)) {
        power->speedLevel = static_cast<std::uint8_t>(std::clamp(speedLevel, 0, 255));
    }
    for (const game::Input &input : _inputs) {
        step(input);
    }

    // The ship is drawn where it was, and slides to the corrected position.
    _errorX = 0.0f;
    _errorY = 0.0f;
    if (_ready) {
        _errorX = drawnX - getX();
        _errorY = drawnY - getY();
        if (std::abs(_errorX) > kMaxSmoothedError || std::abs(_errorY) > kMaxSmoothedError) {
            _errorX = 0.0f;
            _errorY = 0.0f;
        }
    }
    _ready = true;
}

void Prediction::reset()
{
    _ready = false;
    _inputs.clear();
    _errorX = 0.0f;
    _errorY = 0.0f;
}

void Prediction::update(float dt)
{
    // At 60 images per second the error loses 1/6 per image: almost gone
    // after a quarter of a second, without a visible jump.
    const float keep = std::max(0.0f, 1.0f - 10.0f * dt);
    _errorX *= keep;
    _errorY *= keep;
}

float Prediction::getX() const
{
    const auto *position = _registry.getComponent<game::Position>(_ship);
    return (position != nullptr ? position->x : 0.0f) + _errorX;
}

float Prediction::getY() const
{
    const auto *position = _registry.getComponent<game::Position>(_ship);
    return (position != nullptr ? position->y : 0.0f) + _errorY;
}

float Prediction::getSpeedY() const
{
    const auto *velocity = _registry.getComponent<game::Velocity>(_ship);
    return velocity != nullptr ? velocity->vy : 0.0f;
}

} // namespace client
