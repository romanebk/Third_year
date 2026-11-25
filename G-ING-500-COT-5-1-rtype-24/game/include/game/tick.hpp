#ifndef GAME_TICK_HPP
#define GAME_TICK_HPP

#include "engine/ecs/Registry.hpp"
#include "engine/ecs/Scheduler.hpp"

namespace game {

// The gameplay systems, in run order: player timers -> campaign -> waves ->
// enemy fire -> boss -> shoot -> movement -> collision -> lifetime.
const engine::Scheduler &gameSystems();

// One authoritative simulation step of a room (docs/game-design.md §9), the
// only function the server loop has to call: runs gameSystems() once. dt is in
// seconds (kTickDt). Waves only act if a level was loaded (loadLevel or
// startCampaign).
void stepGame(engine::Registry &registry, float dt);

enum class RoomState { Playing, Victory, Defeat };

// How the room stands: Defeat when every player is game over, Victory when
// the game is won (the boss of the last level is dead and nothing is left), else
// Playing. Defeat wins if both are true. The server checks it after each
// stepGame and stops the room on anything but Playing.
RoomState roomState(engine::Registry &registry);

} // namespace game

#endif // GAME_TICK_HPP
