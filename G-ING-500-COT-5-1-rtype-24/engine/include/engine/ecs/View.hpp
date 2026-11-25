#pragma once

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/SparseArray.hpp"

#include <algorithm>
#include <cstddef>
#include <iterator>
#include <limits>
#include <tuple>
#include <utility>

namespace engine {

class Registry;

// Iterates over the alive entities that have ALL the listed components.
//
//   for (auto [e, pos, vel] : registry.view<Position, Velocity>()) { pos.x += vel.vx * dt; }
//   registry.view<Position, Velocity>().each([](Entity e, Position &pos, Velocity &vel) { ... });
//
// Each storage is looked up once, when the view is created. While iterating,
// do not add components of a viewed type, spawn or kill entities: collect them
// and act after the loop (same rule as SparseArray references). Modifying the
// components you receive is fine. A component type may appear only once.
template <typename... Components>
class View {
    static_assert(sizeof...(Components) > 0, "a view needs at least one component type");

public:
    using value_type = std::tuple<Entity, Components &...>;

    class iterator {
    public:
        using iterator_category = std::forward_iterator_tag;
        using value_type = View::value_type;
        using difference_type = std::ptrdiff_t;
        using reference = value_type;
        using pointer = void;

        iterator() = default;
        iterator(const View *view, std::size_t index) : _view(view), _index(index) { skip(); }

        value_type operator*() const { return _view->at(_index); }

        iterator &operator++()
        {
            ++_index;
            skip();
            return *this;
        }

        iterator operator++(int)
        {
            iterator copy = *this;
            ++*this;
            return copy;
        }

        bool operator==(const iterator &other) const { return position() == other.position(); }

    private:
        // An index past the current end compares equal to end(), even if a
        // storage size changed: the loop cannot run past the data.
        [[nodiscard]] std::size_t position() const { return std::min(_index, _view->limit()); }

        void skip()
        {
            while (_index < _view->limit() && !_view->matches(_index)) {
                ++_index;
            }
        }

        const View *_view = nullptr;
        std::size_t _index = 0;
    };

    View(Registry &registry, SparseArray<Components> &...storages)
        : _registry(&registry), _storages(&storages...)
    {
    }

    [[nodiscard]] iterator begin() const { return iterator(this, 0); }
    [[nodiscard]] iterator end() const
    {
        return iterator(this, std::numeric_limits<std::size_t>::max());
    }

    // Calls fn(Entity, Components &...) for every matching entity.
    template <typename Fn>
    void each(Fn &&fn) const
    {
        for (std::size_t i = 0; i < limit(); ++i) {
            if (matches(i)) {
                std::apply(fn, at(i));
            }
        }
    }

    // Number of matching entities (walks the storages).
    [[nodiscard]] std::size_t count() const
    {
        std::size_t n = 0;
        for (std::size_t i = 0; i < limit(); ++i) {
            n += matches(i) ? 1U : 0U;
        }
        return n;
    }

private:
    // No index past the smallest storage can have every component.
    [[nodiscard]] std::size_t limit() const
    {
        return std::min({std::get<SparseArray<Components> *>(_storages)->size()...});
    }

    [[nodiscard]] bool matches(std::size_t i) const
    {
        return (std::get<SparseArray<Components> *>(_storages)->contains(i) && ...);
    }

    [[nodiscard]] value_type at(std::size_t i) const;

    Registry *_registry;
    std::tuple<SparseArray<Components> *...> _storages;
};

} // namespace engine
