#include "game/movement.hpp"

#include "game/components.hpp"
#include "game/ecs_helpers.hpp"
#include "game/player.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <cmath>
#include <numbers>
#include <vector>

namespace game {

namespace {

constexpr float kTwoPi = 2.0f * std::numbers::pi_v<float>;

float playerSpeed(engine::Registry &registry, engine::Entity e)
{
    unsigned level = 0;
    if (const auto *power = registry.getComponent<PowerState>(e)) {
        level = std::min<unsigned>(power->speedLevel, kPlayerMaxSpeedLevel);
    }
    return kPlayerBaseSpeed + kPlayerSpeedStep * static_cast<float>(level);
}

bool isCullable(Team team)
{
    return team == Team::Enemy || team == Team::PlayerShot || team == Team::EnemyShot ||
           team == Team::Pickup;
}

bool leftArenaMovingOut(const Position &p, const Velocity &v)
{
    return (p.x < -kCullMargin && v.vx < 0.0f) ||
           (p.x > kArenaWidth + kCullMargin && v.vx > 0.0f) ||
           (p.y < -kCullMargin && v.vy < 0.0f) || (p.y > kArenaHeight + kCullMargin && v.vy > 0.0f);
}

} // namespace

void playerInputSystem(engine::Registry &registry)
{
    forEach<Input, Player, Velocity>(
        registry, [&](engine::Entity e, Input &in, Player &player, Velocity &vel) {
            if (!player.alive) {
                vel = Velocity{};
                return;
            }
            float dx = (in.right ? 1.0f : 0.0f) - (in.left ? 1.0f : 0.0f);
            float dy = (in.down ? 1.0f : 0.0f) - (in.up ? 1.0f : 0.0f);
            const float length = std::sqrt(dx * dx + dy * dy);
            if (length > 0.0f) {
                dx /= length;
                dy /= length;
            }
            const float speed = playerSpeed(registry, e);
            vel.vx = dx * speed;
            vel.vy = dy * speed;
        });
}

void patternSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    forEach<Movement, Velocity, Position>(registry, [&](engine::Entity, Movement &m, Velocity &vel,
                                                        Position &pos) {
        switch (m.type) {
        case MovementType::Straight:
            vel.vx = -m.speed;
            vel.vy = 0.0f;
            break;
        case MovementType::Static:
            vel.vx = -kScrollSpeed;
            vel.vy = 0.0f;
            break;
        case MovementType::Sine: {
            // vy is the exact difference of the sine over this step, so the
            // integrated position follows amp * sin(2*pi*freq*t) with no drift.
            const float w = kTwoPi * m.freq;
            vel.vx = -m.speed;
            vel.vy = m.amp * (std::sin(w * (m.t + dt)) - std::sin(w * m.t)) / dt;
            break;
        }
        case MovementType::Chase: {
            vel.vx = -m.speed;
            vel.vy = 0.0f;
            if (const auto target = nearestAlivePlayer(registry, pos.x, pos.y)) {
                const float diff = target->y - pos.y;
                const float maxStep = kChaseSpeedY * dt;
                vel.vy = std::abs(diff) <= maxStep ? diff / dt : std::copysign(kChaseSpeedY, diff);
            }
            break;
        }
        }
        m.t += dt;
    });
}

void integrationSystem(engine::Registry &registry, float dt)
{
    forEach<Position, Velocity>(registry, [&](engine::Entity, Position &pos, Velocity &vel) {
        pos.x += vel.vx * dt;
        pos.y += vel.vy * dt;
    });
}

void clampPlayersSystem(engine::Registry &registry)
{
    forEach<Position, Player>(registry, [&](engine::Entity e, Position &pos, Player &) {
        float halfW = 0.0f;
        float halfH = 0.0f;
        if (const auto *collider = registry.getComponent<Collider>(e)) {
            halfW = collider->w * 0.5f;
            halfH = collider->h * 0.5f;
        }
        pos.x = std::clamp(pos.x, halfW, kArenaWidth - halfW);
        pos.y = std::clamp(pos.y, halfH, kArenaHeight - halfH);
    });
}

void cullSystem(engine::Registry &registry)
{
    std::vector<engine::Entity> doomed;
    forEach<Position, Velocity, Team>(
        registry, [&](engine::Entity e, Position &pos, Velocity &vel, Team &team) {
            if (isCullable(team) && leftArenaMovingOut(pos, vel)) {
                doomed.push_back(e);
            }
        });
    for (const engine::Entity e : doomed) {
        registry.killEntity(e);
    }
}

void stepMovement(engine::Registry &registry, float dt)
{
    playerInputSystem(registry);
    patternSystem(registry, dt);
    integrationSystem(registry, dt);
    clampPlayersSystem(registry);
    cullSystem(registry);
}

} // namespace game
