// Pong: a second game made with the R-Type engine, to show that the engine is
// generic. Left paddle: W / S. Right paddle: Up / Down. Escape: quit.
//
//   pong                 play in a window (SFML module)
//   pong --headless 600  run 600 steps without a window, print the score

#include "Pong.hpp"
#include "engine/core/Clock.hpp"
#include "engine/core/Logger.hpp"
#include "engine/sfml/SfmlGraphics.hpp"
#include "engine/subsystems/Null.hpp"

#include <exception>
#include <iostream>
#include <string>
#include <string_view>

namespace {

constexpr double kStep = 1.0 / 60.0;

void logGoals(pong::PongGame &game)
{
    game.events().subscribe<pong::Goal>([&game](const pong::Goal &) {
        engine::logger().info("goal: " + std::to_string(game.score(0)) + " - " +
                              std::to_string(game.score(1)));
    });
}

int runHeadless(int steps)
{
    pong::PongGame game;
    logGoals(game);
    engine::NullGraphics graphics; // same game code, no window
    graphics.open(static_cast<unsigned>(pong::kWidth), static_cast<unsigned>(pong::kHeight),
                  "pong");
    for (int i = 0; i < steps && !game.finished(); ++i) {
        game.step(static_cast<float>(kStep));
        game.render(graphics);
        graphics.display();
    }
    std::cout << "pong: " << graphics.frames() << " frames, score " << game.score(0) << " - "
              << game.score(1) << '\n';
    return 0;
}

int runWindow()
{
    engine::sfml::SfmlGraphics graphics; // swap for any other IGraphics
    if (!graphics.open(static_cast<unsigned>(pong::kWidth), static_cast<unsigned>(pong::kHeight),
                       "Pong - built with the R-Type engine")) {
        engine::logger().error("cannot open the window");
        return 1;
    }
    pong::PongGame game;
    logGoals(game);
    engine::FixedStep ticks(kStep);
    engine::Stopwatch watch;

    while (graphics.isOpen()) {
        for (const engine::InputEvent &event : graphics.pollEvents()) {
            const bool escape = event.type == engine::InputEvent::Type::KeyPressed &&
                                event.key == engine::Key::Escape;
            if (event.type == engine::InputEvent::Type::Closed || escape) {
                graphics.close();
            }
        }
        game.setControls({graphics.isKeyDown(engine::Key::W), graphics.isKeyDown(engine::Key::S),
                          graphics.isKeyDown(engine::Key::Up),
                          graphics.isKeyDown(engine::Key::Down)});
        ticks.update(watch.restart(),
                     [&game](double step) { game.step(static_cast<float>(step)); });
        game.render(graphics);
        graphics.display();
    }
    if (game.finished()) {
        engine::logger().info("player " + std::to_string(game.winner() + 1) + " wins");
    }
    return 0;
}

} // namespace

int main(int argc, char **argv)
{
    try {
        if (argc >= 2 && std::string_view(argv[1]) == "--headless") {
            return runHeadless(argc >= 3 ? std::stoi(argv[2]) : 600);
        }
        return runWindow();
    } catch (const std::exception &error) {
        engine::logger().error(error.what());
        return 1;
    }
}
