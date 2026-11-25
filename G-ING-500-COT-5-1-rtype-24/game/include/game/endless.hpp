#ifndef GAME_ENDLESS_HPP
#define GAME_ENDLESS_HPP

#include "game/level.hpp"

#include <vector>

namespace game {

// Endless mode (docs/game-design.md §14): the waves come one after the other for
// ever and get harder. A wave is a list of SpawnEvent like a level, so the same
// systems play it; it is built by a formula, with no random number, so a room
// always plays the same waves.

// The enemies of wave `wave` (0 is the first). More and more enemies, closer
// and closer together, with Turrets from wave 2, a Carrier in every wave (it
// drops a bonus) and a boss every fifth wave (waves 4, 9, 14...). Never more
// than kEndlessMaxGroup enemies in a group. A negative wave counts as 0.
std::vector<SpawnEvent> endlessWave(int wave);

// Factor on the hit points of the enemies and the boss of wave `wave`: 1 for the
// first wave, +10 % per wave, at most kEndlessMaxHpScale.
float endlessHpScale(int wave);

// True for the waves that end with a boss.
bool isEndlessBossWave(int wave);

} // namespace game

#endif // GAME_ENDLESS_HPP
