#include "Pong.hpp"

#include <algorithm>
#include <cmath>

namespace pong {

namespace {

bool overlaps(const Position &a, const Size &as, const Position &b, const Size &bs)
{
    return a.x < b.x + bs.width && b.x < a.x + as.width && a.y < b.y + bs.height &&
           b.y < a.y + as.height;
}

} // namespace

PongGame::PongGame()
{
    _registry.registerComponent<Position>();
    _registry.registerComponent<Velocity>();
    _registry.registerComponent<Size>();
    _registry.registerComponent<Paddle>();
    _registry.registerComponent<Ball>();

    for (int side = 0; side < 2; ++side) {
        const engine::Entity p = _registry.spawnEntity();
        const float x = side == 0 ? kPaddleMargin : kWidth - kPaddleMargin - kPaddleWidth;
        _registry.addComponent(p, Position{x, (kHeight - kPaddleHeight) / 2.0f});
        _registry.addComponent(p, Velocity{});
        _registry.addComponent(p, Size{kPaddleWidth, kPaddleHeight});
        _registry.addComponent(p, Paddle{side});
        _paddles.at(static_cast<std::size_t>(side)) = p;
    }
    _ball = _registry.spawnEntity();
    _registry.addComponent(_ball, Position{});
    _registry.addComponent(_ball, Velocity{});
    _registry.addComponent(_ball, Size{kBallSize, kBallSize});
    _registry.addComponent(_ball, Ball{});
    serve(1);

    // The rules of Pong, as systems run in this order every step.
    _systems.add("input", [this](engine::Registry &r, float) {
        r.view<Paddle, Velocity>().each([this](engine::Entity, Paddle &paddle, Velocity &vel) {
            const bool up = paddle.side == 0 ? _controls.leftUp : _controls.rightUp;
            const bool down = paddle.side == 0 ? _controls.leftDown : _controls.rightDown;
            vel.y = (down ? kPaddleSpeed : 0.0f) - (up ? kPaddleSpeed : 0.0f);
        });
    });

    _systems.add("movement", [](engine::Registry &r, float dt) {
        for (auto [e, pos, vel] : r.view<Position, Velocity>()) {
            pos.x += vel.x * dt;
            pos.y += vel.y * dt;
        }
    });

    _systems.add("paddle-bounds", [](engine::Registry &r, float) {
        for (auto [e, paddle, pos, size] : r.view<Paddle, Position, Size>()) {
            pos.y = std::clamp(pos.y, 0.0f, kHeight - size.height);
        }
    });

    _systems.add("ball-walls", [](engine::Registry &r, float) {
        for (auto [e, ball, pos, vel, size] : r.view<Ball, Position, Velocity, Size>()) {
            if ((pos.y < 0.0f && vel.y < 0.0f) || (pos.y + size.height > kHeight && vel.y > 0.0f)) {
                vel.y = -vel.y;
                pos.y = std::clamp(pos.y, 0.0f, kHeight - size.height);
            }
        }
    });

    _systems.add("ball-paddles", [this](engine::Registry &r, float) {
        auto &ballPos = *r.getComponent<Position>(_ball);
        auto &ballVel = *r.getComponent<Velocity>(_ball);
        const auto &ballSize = *r.getComponent<Size>(_ball);
        for (auto [e, paddle, pos, size] : r.view<Paddle, Position, Size>()) {
            const bool towards = paddle.side == 0 ? ballVel.x < 0.0f : ballVel.x > 0.0f;
            if (!towards || !overlaps(ballPos, ballSize, pos, size)) {
                continue;
            }
            // Send it back, faster, with an angle that depends on where it hit.
            const float speed = std::hypot(ballVel.x, ballVel.y) * kSpeedUp;
            const float offset =
                ((ballPos.y + ballSize.height / 2.0f) - (pos.y + size.height / 2.0f)) /
                (size.height / 2.0f); // -1 (top) .. 1 (bottom)
            const float angle = std::clamp(offset, -1.0f, 1.0f) * 0.8f;
            const float direction = paddle.side == 0 ? 1.0f : -1.0f;
            ballVel.x = direction * speed * std::cos(angle);
            ballVel.y = speed * std::sin(angle);
            ballPos.x = paddle.side == 0 ? pos.x + size.width : pos.x - ballSize.width;
            _events.enqueue(Bounce{});
        }
    });

    _systems.add("goal", [this](engine::Registry &r, float) {
        const auto &pos = *r.getComponent<Position>(_ball);
        if (pos.x + kBallSize < 0.0f) {
            _events.enqueue(Goal{1});
        } else if (pos.x > kWidth) {
            _events.enqueue(Goal{0});
        }
    });

    // Reacting to a goal is decoupled from detecting it.
    _events.subscribe<Goal>([this](const Goal &goal) {
        int &score = _scores.at(static_cast<std::size_t>(goal.scorer));
        ++score;
        if (score >= kWinningScore) {
            _winner = goal.scorer;
            *_registry.getComponent<Velocity>(_ball) = Velocity{};
            return;
        }
        serve(1 - goal.scorer); // towards the side that conceded
    });
}

void PongGame::serve(int side)
{
    auto &pos = *_registry.getComponent<Position>(_ball);
    auto &vel = *_registry.getComponent<Velocity>(_ball);
    pos = Position{(kWidth - kBallSize) / 2.0f, (kHeight - kBallSize) / 2.0f};
    vel = Velocity{side == 0 ? -kBallSpeed : kBallSpeed, kBallSpeed * 0.35f};
}

void PongGame::step(float dt)
{
    if (finished()) {
        return;
    }
    _systems.run(_registry, dt);
    _events.dispatch(); // goals and bounces found by the systems
}

void PongGame::render(engine::IGraphics &graphics)
{
    const engine::Color background{12, 14, 30, 255};
    const engine::Color white{235, 235, 235, 255};
    const engine::Color dim{90, 96, 130, 255};
    const engine::Color gold{255, 200, 60, 255};

    graphics.clear(background);
    for (float y = 0.0f; y < kHeight; y += 24.0f) { // the net
        graphics.drawRect({kWidth / 2.0f - 2.0f, y + 6.0f, 4.0f, 12.0f}, dim);
    }
    for (auto [e, pos, size] : _registry.view<Position, Size>()) {
        graphics.drawRect({pos.x, pos.y, size.width, size.height}, white);
    }
    // Scores as pips, gold for the winner.
    for (int side = 0; side < 2; ++side) {
        const engine::Color color = _winner == side ? gold : white;
        for (int i = 0; i < score(side); ++i) {
            const float x = side == 0 ? kWidth / 2.0f - 40.0f - static_cast<float>(i) * 16.0f
                                      : kWidth / 2.0f + 28.0f + static_cast<float>(i) * 16.0f;
            graphics.drawRect({x, 16.0f, 10.0f, 10.0f}, color);
        }
    }
}

} // namespace pong
