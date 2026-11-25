#pragma once

#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"
#include "game/level.hpp"
#include "game/rules.hpp"

namespace game {

// Registers every gameplay component type. Call once per Registry (room or
// client) before running any system or spawning gameplay entities.
inline void registerGameComponents(engine::Registry &registry)
{
    registry.registerComponent<Position>();
    registry.registerComponent<Velocity>();
    registry.registerComponent<Health>();
    registry.registerComponent<Collider>();
    registry.registerComponent<Team>();
    registry.registerComponent<Input>();
    registry.registerComponent<EntityType>();
    registry.registerComponent<Player>();
    registry.registerComponent<PowerState>();
    registry.registerComponent<Movement>();
    registry.registerComponent<Enemy>();
    registry.registerComponent<Projectile>();
    registry.registerComponent<Lifetime>();
    registry.registerComponent<ForcePod>();
    registry.registerComponent<Weapon>();
    registry.registerComponent<Pickup>();
    registry.registerComponent<DropState>();
    registry.registerComponent<LevelRun>();
    registry.registerComponent<Campaign>();
    registry.registerComponent<BossState>();
    registry.registerComponent<NetId>();
    registry.registerComponent<NetIdAllocator>();
    registry.registerComponent<Rules>();
}

} // namespace game
