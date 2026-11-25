#pragma once

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/SparseArray.hpp"
#include "engine/ecs/View.hpp"

#include <cstddef>
#include <memory>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <typeindex>
#include <typeinfo>
#include <unordered_map>
#include <utility>
#include <vector>

namespace engine {

// Thrown when accessing a component type that was never registered.
class ComponentNotRegistered : public std::logic_error {
public:
    explicit ComponentNotRegistered(const std::type_info &type)
        : std::logic_error(std::string("component not registered: ") + type.name())
    {
    }
};

// Thrown when writing a component on a dead (or stale) entity.
class DeadEntity : public std::logic_error {
public:
    explicit DeadEntity(Entity e)
        : std::logic_error("entity " + std::to_string(e.index()) + " (generation " +
                           std::to_string(e.generation()) + ") is not alive")
    {
    }
};

// Owns entities and one SparseArray per registered component type.
//
// Rules:
// - Component types must be registered before use (registerComponent<T>()).
// - Writing on a dead entity throws DeadEntity; reading or removing is a no-op.
// - A SparseArray reference returned by getComponents<T>() stays valid for the
//   Registry's lifetime; references to individual slots do not (see SparseArray).
// - Not thread-safe: a Registry is owned by a single thread (the game loop).
class Registry {
public:
    template <typename Component>
    SparseArray<Component> &registerComponent()
    {
        auto [it, inserted] = _storages.try_emplace(std::type_index(typeid(Component)));
        if (inserted) {
            it->second = std::make_unique<Storage<Component>>();
        }
        return static_cast<Storage<Component> &>(*it->second).data;
    }

    template <typename Component>
    [[nodiscard]] bool isRegistered() const
    {
        return _storages.contains(std::type_index(typeid(Component)));
    }

    template <typename Component>
    SparseArray<Component> &getComponents()
    {
        return storage<Component>().data;
    }

    template <typename Component>
    const SparseArray<Component> &getComponents() const
    {
        return storage<Component>().data;
    }

    Entity spawnEntity();
    void killEntity(Entity e);
    [[nodiscard]] bool isAlive(Entity e) const noexcept;
    // Current handle for an index in use, e.g. when iterating over a SparseArray.
    [[nodiscard]] Entity entityFromIndex(Entity::Index index) const;
    [[nodiscard]] std::size_t aliveCount() const noexcept { return _aliveCount; }

    template <typename Component>
    Component &addComponent(Entity e, Component &&component)
    {
        requireAlive(e);
        return *getComponents<std::remove_cvref_t<Component>>().insertAt(
            e.index(), std::forward<Component>(component));
    }

    template <typename Component, typename... Args>
    Component &emplaceComponent(Entity e, Args &&...args)
    {
        requireAlive(e);
        return *getComponents<Component>().emplaceAt(e.index(), std::forward<Args>(args)...);
    }

    template <typename Component>
    void removeComponent(Entity e)
    {
        if (isAlive(e)) {
            getComponents<Component>().erase(e.index());
        }
    }

    template <typename Component>
    [[nodiscard]] bool hasComponent(Entity e) const
    {
        return isAlive(e) && getComponents<Component>().contains(e.index());
    }

    // nullptr if the entity is dead or has no such component.
    template <typename Component>
    Component *getComponent(Entity e)
    {
        auto &components = getComponents<Component>();
        return hasComponent<Component>(e) ? &*components[e.index()] : nullptr;
    }

    template <typename Component>
    const Component *getComponent(Entity e) const
    {
        const auto &components = getComponents<Component>();
        return hasComponent<Component>(e) ? &*components[e.index()] : nullptr;
    }

    // Alive entities that have all of `Components` (see View). Every type must
    // be registered: an unregistered one throws ComponentNotRegistered.
    template <typename... Components>
    View<Components...> view()
    {
        return View<Components...>(*this, getComponents<Components>()...);
    }

private:
    struct IStorage {
        IStorage() = default;
        IStorage(const IStorage &) = delete;
        IStorage &operator=(const IStorage &) = delete;
        IStorage(IStorage &&) = delete;
        IStorage &operator=(IStorage &&) = delete;
        virtual ~IStorage() = default;
        virtual void erase(std::size_t idx) noexcept = 0;
    };

    template <typename Component>
    struct Storage final : IStorage {
        void erase(std::size_t idx) noexcept override { data.erase(idx); }
        SparseArray<Component> data;
    };

    template <typename Component>
    Storage<Component> &storage() const
    {
        auto it = _storages.find(std::type_index(typeid(Component)));
        if (it == _storages.end()) {
            throw ComponentNotRegistered(typeid(Component));
        }
        return static_cast<Storage<Component> &>(*it->second);
    }

    void requireAlive(Entity e) const;

    std::unordered_map<std::type_index, std::unique_ptr<IStorage>> _storages;
    std::vector<Entity::Generation> _generations; // current generation per index
    std::vector<bool> _alive;                     // liveness per index
    std::vector<Entity::Index> _freeIndices;      // recycled indices (LIFO)
    std::size_t _aliveCount = 0;
};

// Defined here because it needs the complete Registry. A slot that holds a
// component belongs to an alive entity (killEntity clears every storage).
template <typename... Components>
typename View<Components...>::value_type View<Components...>::at(std::size_t i) const
{
    return value_type(_registry->entityFromIndex(static_cast<Entity::Index>(i)),
                      *(*std::get<SparseArray<Components> *>(_storages))[i]...);
}

} // namespace engine
