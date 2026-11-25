#include "game/pickups.hpp"

#include "game/ecs_helpers.hpp"
#include "game/world.hpp"

#include <cstdint>
#include <vector>

namespace game {

namespace {

// DropState lives on one entity of the registry, created on first use.
DropState &dropState(engine::Registry &registry)
{
    std::vector<engine::Entity> holders;
    forEach<DropState>(registry, [&](engine::Entity e, DropState &) { holders.push_back(e); });
    if (!holders.empty()) {
        return *registry.getComponent<DropState>(holders.front());
    }
    const engine::Entity holder = registry.spawnEntity();
    registry.addComponent(holder, DropState{});
    return *registry.getComponent<DropState>(holder);
}

// A well-mixed 32-bit value for each counter value (the splitmix32 mixer).
std::uint32_t mix(std::uint32_t counter)
{
    std::uint32_t z = counter + 0x9E3779B9u;
    z = (z ^ (z >> 16)) * 0x85EBCA6Bu;
    z = (z ^ (z >> 13)) * 0xC2B2AE35u;
    return z ^ (z >> 16);
}

} // namespace

engine::Entity spawnPickup(engine::Registry &registry, PickupKind kind, float x, float y)
{
    const engine::Entity e = registry.spawnEntity();
    registry.addComponent(e, Position{x, y});
    registry.addComponent(e, Velocity{-kPickupDriftSpeed, 0.0f});
    registry.addComponent(e, Collider{kPickupWidth, kPickupHeight, kLayerPickup, true});
    registry.addComponent(e, Team::Pickup);
    registry.addComponent(e, EntityType::PickupEnt);
    registry.addComponent(e, Pickup{kind});
    return e;
}

std::optional<PickupKind> rollDrop(engine::Registry &registry, EnemyType type)
{
    switch (type) {
    case EnemyType::Carrier: {
        DropState &state = dropState(registry);
        const PickupKind kind = state.carrierDrops % 2 == 0 ? PickupKind::Power : PickupKind::Speed;
        state.carrierDrops += 1;
        return kind;
    }
    case EnemyType::Bink:
    case EnemyType::Patapata: {
        DropState &state = dropState(registry);
        const std::uint32_t value = mix(state.rolls);
        state.rolls += 1;
        // the top 24 bits decide whether it drops, one other bit which kind
        const float chance = static_cast<float>(value >> 8) / 16777216.0f;
        if (chance >= kRandomDropChance) {
            return std::nullopt;
        }
        return (value & 1u) == 0 ? PickupKind::Power : PickupKind::Speed;
    }
    case EnemyType::Turret:
    case EnemyType::Boss:
        return std::nullopt;
    }
    return std::nullopt;
}

void applyPickup(engine::Registry &registry, engine::Entity ship, PickupKind kind)
{
    bool used = false;
    switch (kind) {
    case PickupKind::Power:
        if (auto *weapon = registry.getComponent<Weapon>(ship); weapon != nullptr) {
            if (weapon->level < kWeaponMaxLevel) {
                weapon->level += 1;
                used = true;
            }
        }
        break;
    case PickupKind::Speed:
        if (auto *power = registry.getComponent<PowerState>(ship); power != nullptr) {
            if (power->speedLevel < kPlayerMaxSpeedLevel) {
                power->speedLevel += 1;
                used = true;
            }
        }
        break;
    }
    if (!used) {
        if (auto *player = registry.getComponent<Player>(ship)) {
            player->score += kPickupBonusScore;
        }
    }
}

} // namespace game
