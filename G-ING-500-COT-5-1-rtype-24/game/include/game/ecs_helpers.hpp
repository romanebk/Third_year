#pragma once

// Iteration helper over the engine Registry, kept so the systems call sites
// stay the same: it forwards to the engine view (engine/ecs/View.hpp).

#include "engine/ecs/Registry.hpp"

#include <utility>

namespace game {

// Calls fn(entity, First&, Rest&...) for every alive entity that has all the
// listed components. The callback must NOT add components or spawn entities
// (that may reallocate the storages being iterated); it may modify the
// components it receives. Collect entities and kill/spawn after the loop.
template <typename First, typename... Rest, typename Fn>
void forEach(engine::Registry &registry, Fn &&fn)
{
    registry.view<First, Rest...>().each(std::forward<Fn>(fn));
}

} // namespace game
