#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>

namespace engine {

// Handle to an entity: an index into component storages plus a generation.
// Indices are recycled when an entity is killed; the generation is bumped on
// each reuse so that a handle to a dead entity is detected as stale.
// An Entity carries no data and no behavior: everything lives in components.
class Entity {
public:
    using Index = std::uint32_t;
    using Generation = std::uint32_t;

    constexpr Entity(Index index, Generation generation) noexcept
        : _index(index), _generation(generation)
    {
    }

    [[nodiscard]] constexpr Index index() const noexcept { return _index; }
    [[nodiscard]] constexpr Generation generation() const noexcept { return _generation; }

    // Implicit so that an Entity can index a SparseArray directly: `positions[e]`.
    constexpr operator std::size_t() const noexcept { return _index; }

    constexpr bool operator==(const Entity &other) const noexcept = default;

private:
    Index _index;
    Generation _generation;
};

} // namespace engine

template <>
struct std::hash<engine::Entity> {
    std::size_t operator()(const engine::Entity &e) const noexcept
    {
        return std::hash<std::uint64_t>{}((static_cast<std::uint64_t>(e.generation()) << 32U) |
                                          e.index());
    }
};
