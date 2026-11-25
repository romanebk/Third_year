#pragma once

#include <cstddef>
#include <optional>
#include <utility>
#include <vector>

namespace engine {

// Storage for one component type, indexed by entity index.
// Slot i holds the component of entity i, or std::nullopt if it has none.
//
// Growth: writing at an index past the end grows the array. Indices come from
// the Registry, so the size is bounded by the highest entity index ever spawned.
// References to slots are invalidated when the array grows (like std::vector).
template <typename Component>
class SparseArray {
public:
    using value_type = std::optional<Component>;
    using reference_type = value_type &;
    using const_reference_type = const value_type &;
    using container_t = std::vector<value_type>;
    using size_type = typename container_t::size_type;
    using iterator = typename container_t::iterator;
    using const_iterator = typename container_t::const_iterator;

    // Non-const access grows the array so the slot always exists.
    reference_type operator[](size_type idx)
    {
        ensureSize(idx);
        return _data[idx];
    }

    // Const access never grows: out-of-range reads as an empty slot.
    const_reference_type operator[](size_type idx) const
    {
        static const value_type empty{};
        return idx < _data.size() ? _data[idx] : empty;
    }

    [[nodiscard]] bool contains(size_type idx) const noexcept
    {
        return idx < _data.size() && _data[idx].has_value();
    }

    reference_type insertAt(size_type idx, const Component &component)
    {
        ensureSize(idx);
        _data[idx] = component;
        return _data[idx];
    }

    reference_type insertAt(size_type idx, Component &&component)
    {
        ensureSize(idx);
        _data[idx] = std::move(component);
        return _data[idx];
    }

    template <typename... Args>
    reference_type emplaceAt(size_type idx, Args &&...args)
    {
        ensureSize(idx);
        _data[idx].emplace(std::forward<Args>(args)...);
        return _data[idx];
    }

    void erase(size_type idx) noexcept
    {
        if (idx < _data.size()) {
            _data[idx].reset();
        }
    }

    void clear() noexcept { _data.clear(); }

    [[nodiscard]] size_type size() const noexcept { return _data.size(); }

    iterator begin() noexcept { return _data.begin(); }
    const_iterator begin() const noexcept { return _data.begin(); }
    const_iterator cbegin() const noexcept { return _data.cbegin(); }
    iterator end() noexcept { return _data.end(); }
    const_iterator end() const noexcept { return _data.end(); }
    const_iterator cend() const noexcept { return _data.cend(); }

private:
    void ensureSize(size_type idx)
    {
        if (idx >= _data.size()) {
            _data.resize(idx + 1);
        }
    }

    container_t _data;
};

} // namespace engine
