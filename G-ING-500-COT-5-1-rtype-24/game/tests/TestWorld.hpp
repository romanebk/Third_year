#pragma once

// Test fixture: a Registry with every gameplay component registered, plus
// factories for the entity kinds used by the system tests.

#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"
#include "game/setup.hpp"

namespace game_test {

using engine::Entity;
using engine::Registry;
using namespace game;

struct TestWorld {
    Registry registry;

    TestWorld() { registerGameComponents(registry); }

    // R-9 ship: 24x16 hitbox, 1 hp, Team P<playerId>.
    Entity ship(int playerId, float x, float y)
    {
        const Entity e = registry.spawnEntity();
        registry.emplaceComponent<Position>(e, x, y);
        registry.emplaceComponent<Velocity>(e);
        registry.addComponent(e, Health{1, 1});
        registry.addComponent(e, Collider{24.0f, 16.0f, 1, true});
        registry.addComponent(e, static_cast<Team>(playerId));
        registry.emplaceComponent<Input>(e);
        Player player;
        player.playerId = playerId;
        registry.addComponent(e, player);
        registry.emplaceComponent<PowerState>(e);
        return e;
    }

    Entity enemy(float x, float y, int hp = 1, int score = 100)
    {
        const Entity e = registry.spawnEntity();
        registry.emplaceComponent<Position>(e, x, y);
        registry.emplaceComponent<Velocity>(e);
        registry.addComponent(e, Health{hp, hp});
        registry.addComponent(e, Collider{24.0f, 24.0f, 2, true});
        registry.addComponent(e, Team::Enemy);
        Enemy enemy;
        enemy.scoreValue = score;
        registry.addComponent(e, enemy);
        return e;
    }

    Entity shot(Team team, float x, float y, int damage = 1, int ownerId = -1, bool pierce = false)
    {
        const Entity e = registry.spawnEntity();
        registry.emplaceComponent<Position>(e, x, y);
        registry.emplaceComponent<Velocity>(e);
        registry.addComponent(
            e, Collider{8.0f, 8.0f, team == Team::PlayerShot ? std::uint8_t{4} : std::uint8_t{8},
                        true});
        registry.addComponent(e, team);
        Projectile projectile;
        projectile.damage = damage;
        projectile.ownerId = ownerId;
        projectile.pierce = pierce;
        registry.addComponent(e, projectile);
        return e;
    }

    Entity force(int ownerId, float x, float y)
    {
        const Entity e = registry.spawnEntity();
        registry.emplaceComponent<Position>(e, x, y);
        registry.addComponent(e, Collider{16.0f, 16.0f, 0, true});
        registry.addComponent(e, Team::Neutral);
        ForcePod pod;
        pod.ownerId = ownerId;
        registry.addComponent(e, pod);
        return e;
    }

    Position &pos(Entity e) { return *registry.getComponent<Position>(e); }
    Velocity &vel(Entity e) { return *registry.getComponent<Velocity>(e); }
};

} // namespace game_test
