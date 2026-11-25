#include "game/player.hpp"

#include "game/ecs_helpers.hpp"
#include "game/rules.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <stdexcept>
#include <string>

namespace game {

std::optional<Position> nearestAlivePlayer(engine::Registry &registry, float x, float y)
{
    std::optional<Position> best;
    float bestDist = 0.0f;
    forEach<Player, Position>(registry, [&](engine::Entity, Player &player, Position &pos) {
        if (!player.alive) {
            return;
        }
        const float dx = pos.x - x;
        const float dy = pos.y - y;
        const float dist = dx * dx + dy * dy;
        if (!best || dist < bestDist) {
            best = pos;
            bestDist = dist;
        }
    });
    return best;
}

Position playerSpawnPosition(int playerId)
{
    // Centered on the arena: ids 0..3 give y = 198, 246, 294, 342.
    const float offset = (static_cast<float>(playerId) - 1.5f) * kPlayerSpawnSpacing;
    return Position{kPlayerSpawnX, kPlayerSpawnY + offset};
}

engine::Entity spawnPlayer(engine::Registry &registry, int playerId)
{
    if (playerId < 0 || playerId >= kMaxPlayers) {
        throw std::out_of_range("player id out of range: " + std::to_string(playerId));
    }
    Player player;
    player.playerId = playerId;
    player.lives = rulesOf(registry).startingLives;

    const engine::Entity ship = registry.spawnEntity();
    registry.addComponent(ship, playerSpawnPosition(playerId));
    registry.addComponent(ship, Velocity{});
    registry.addComponent(ship, Health{1, 1});
    registry.addComponent(ship, Collider{kPlayerWidth, kPlayerHeight, 1, true});
    registry.addComponent(ship, static_cast<Team>(playerId));
    registry.addComponent(ship, Input{});
    registry.addComponent(ship, player);
    registry.addComponent(ship, PowerState{});
    registry.addComponent(ship, Weapon{});
    registry.addComponent(ship, EntityType::Ship);
    return ship;
}

void playerTimersSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    const Rules rules = rulesOf(registry);
    forEach<Player, Position, Health>(
        registry, [&](engine::Entity e, Player &player, Position &pos, Health &health) {
            if (player.alive) {
                player.invincibleTimer = std::max(0.0f, player.invincibleTimer - dt);
                return;
            }
            if (player.lives < 0) {
                return; // game over: stays dead
            }
            player.respawnTimer -= dt;
            if (player.respawnTimer > 0.0f) {
                return;
            }
            player.alive = true;
            player.respawnTimer = 0.0f;
            player.invincibleTimer = rules.respawnInvincibility;
            health.hp = health.maxHp;
            pos = playerSpawnPosition(player.playerId);
            if (auto *velocity = registry.getComponent<Velocity>(e)) {
                *velocity = Velocity{};
            }
        });
}

bool allPlayersGameOver(engine::Registry &registry)
{
    bool any = false;
    bool allOver = true;
    forEach<Player>(registry, [&](engine::Entity, Player &player) {
        any = true;
        if (player.alive || player.lives >= 0) {
            allOver = false;
        }
    });
    return any && allOver;
}

} // namespace game
