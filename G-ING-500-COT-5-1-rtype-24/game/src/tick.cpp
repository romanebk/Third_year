#include "game/tick.hpp"

#include "game/boss.hpp"
#include "game/collision.hpp"
#include "game/enemies.hpp"
#include "game/level.hpp"
#include "game/movement.hpp"
#include "game/player.hpp"
#include "game/shoot.hpp"

namespace game {

namespace {

engine::Scheduler makeGameSystems()
{
    engine::Scheduler systems;
    systems.add("player-timers", playerTimersSystem);
    systems.add("campaign", campaignSystem);
    systems.add("waves", wavesSystem);
    systems.add("enemy-fire", enemyFireSystem);
    systems.add("boss", bossSystem);
    systems.add("shoot", shootSystem);
    systems.add("movement", stepMovement);
    systems.add("collision", [](engine::Registry &registry, float) { collisionSystem(registry); });
    systems.add("lifetime", lifetimeSystem);
    return systems;
}

} // namespace

const engine::Scheduler &gameSystems()
{
    // Built once (thread-safe static init); holds no state, so every room can share it.
    static const engine::Scheduler systems = makeGameSystems();
    return systems;
}

void stepGame(engine::Registry &registry, float dt)
{
    gameSystems().run(registry, dt);
}

RoomState roomState(engine::Registry &registry)
{
    if (allPlayersGameOver(registry)) {
        return RoomState::Defeat;
    }
    return isCampaignCleared(registry) ? RoomState::Victory : RoomState::Playing;
}

} // namespace game
