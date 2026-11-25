#pragma once

#include <cstddef>
#include <functional>
#include <string>
#include <string_view>
#include <vector>

namespace engine {

class Registry;

// Runs the systems of a game, in a fixed order, once per tick.
//
//   engine::Scheduler systems;
//   systems.add("movement", movementSystem);          // void(Registry &, float dt)
//   systems.add("collision", collisionSystem, 10);    // runs after every order < 10
//   systems.run(registry, dt);
//
// Systems run by increasing `order`, then in the order they were added. Each
// one has a unique name, used to enable, disable or remove it (debug, pause).
// The scheduler holds no game state: one scheduler can drive several registries.
class Scheduler {
public:
    using System = std::function<void(Registry &, float)>;

    // Throws std::invalid_argument if the name is empty or already used, or if
    // `system` is empty.
    void add(std::string name, System system, int order = 0);
    bool remove(std::string_view name);
    bool setEnabled(std::string_view name, bool enabled);

    [[nodiscard]] bool contains(std::string_view name) const;
    [[nodiscard]] bool isEnabled(std::string_view name) const;
    // Names in run order, disabled systems included.
    [[nodiscard]] std::vector<std::string> names() const;
    [[nodiscard]] std::size_t size() const noexcept { return _systems.size(); }

    // Calls every enabled system with (registry, dt), in order.
    void run(Registry &registry, float dt) const;

private:
    struct Entry {
        std::string name;
        System system;
        int order = 0;
        bool enabled = true;
    };

    [[nodiscard]] const Entry *find(std::string_view name) const;
    [[nodiscard]] Entry *find(std::string_view name);

    std::vector<Entry> _systems; // sorted by order, stable for equal orders
};

} // namespace engine
