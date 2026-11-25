#include "engine/ecs/Scheduler.hpp"

#include <algorithm>
#include <stdexcept>
#include <utility>

namespace engine {

void Scheduler::add(std::string name, System system, int order)
{
    if (name.empty()) {
        throw std::invalid_argument("system name is empty");
    }
    if (!system) {
        throw std::invalid_argument("system '" + name + "' is empty");
    }
    if (contains(name)) {
        throw std::invalid_argument("system '" + name + "' is already scheduled");
    }
    // After every entry with the same order: equal orders keep insertion order.
    const auto position =
        std::upper_bound(_systems.begin(), _systems.end(), order,
                         [](int value, const Entry &e) { return value < e.order; });
    _systems.insert(position, Entry{std::move(name), std::move(system), order, true});
}

bool Scheduler::remove(std::string_view name)
{
    const auto it = std::find_if(_systems.begin(), _systems.end(),
                                 [name](const Entry &e) { return e.name == name; });
    if (it == _systems.end()) {
        return false;
    }
    _systems.erase(it);
    return true;
}

bool Scheduler::setEnabled(std::string_view name, bool enabled)
{
    Entry *entry = find(name);
    if (entry == nullptr) {
        return false;
    }
    entry->enabled = enabled;
    return true;
}

bool Scheduler::contains(std::string_view name) const
{
    return find(name) != nullptr;
}

bool Scheduler::isEnabled(std::string_view name) const
{
    const Entry *entry = find(name);
    return entry != nullptr && entry->enabled;
}

std::vector<std::string> Scheduler::names() const
{
    std::vector<std::string> result;
    result.reserve(_systems.size());
    for (const Entry &e : _systems) {
        result.push_back(e.name);
    }
    return result;
}

void Scheduler::run(Registry &registry, float dt) const
{
    for (const Entry &e : _systems) {
        if (e.enabled) {
            e.system(registry, dt);
        }
    }
}

const Scheduler::Entry *Scheduler::find(std::string_view name) const
{
    const auto it = std::find_if(_systems.begin(), _systems.end(),
                                 [name](const Entry &e) { return e.name == name; });
    return it == _systems.end() ? nullptr : &*it;
}

Scheduler::Entry *Scheduler::find(std::string_view name)
{
    const auto it = std::find_if(_systems.begin(), _systems.end(),
                                 [name](const Entry &e) { return e.name == name; });
    return it == _systems.end() ? nullptr : &*it;
}

} // namespace engine
