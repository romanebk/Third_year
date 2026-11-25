#include "engine/ecs/Registry.hpp"

#include <limits>
#include <stdexcept>
#include <string>

namespace engine {

Entity Registry::spawnEntity()
{
    Entity::Index index = 0;
    if (!_freeIndices.empty()) {
        index = _freeIndices.back();
        _freeIndices.pop_back();
    } else {
        if (_generations.size() > std::numeric_limits<Entity::Index>::max()) {
            throw std::length_error("entity index space exhausted");
        }
        index = static_cast<Entity::Index>(_generations.size());
        _generations.push_back(0);
        _alive.push_back(false);
    }
    _alive[index] = true;
    ++_aliveCount;
    return {index, _generations[index]};
}

void Registry::killEntity(Entity e)
{
    if (!isAlive(e)) {
        return;
    }
    for (auto &[type, storage] : _storages) {
        storage->erase(e.index());
    }
    _alive[e.index()] = false;
    ++_generations[e.index()];
    _freeIndices.push_back(e.index());
    --_aliveCount;
}

bool Registry::isAlive(Entity e) const noexcept
{
    return e.index() < _alive.size() && _alive[e.index()] &&
           _generations[e.index()] == e.generation();
}

Entity Registry::entityFromIndex(Entity::Index index) const
{
    if (index >= _alive.size() || !_alive[index]) {
        throw std::out_of_range("no alive entity at index " + std::to_string(index));
    }
    return {index, _generations[index]};
}

void Registry::requireAlive(Entity e) const
{
    if (!isAlive(e)) {
        throw DeadEntity(e);
    }
}

} // namespace engine
