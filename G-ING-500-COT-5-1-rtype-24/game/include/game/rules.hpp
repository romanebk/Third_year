#ifndef GAME_RULES_HPP
#define GAME_RULES_HPP

#include "engine/ecs/Registry.hpp"

#include <optional>
#include <string_view>

namespace game {

// Difficulty of a room (docs/game-design.md §12). It scales numbers, never
// code: a room loads its rules once and every system reads them.
enum class Difficulty { Easy, Normal, Hard };

// How a room is played (docs/game-design.md §14). Campaign: the two levels, then
// the victory. Endless: waves that never stop and get harder; the game only
// ends when every player is out, so the goal is a high score.
enum class GameMode { Campaign, Endless };

// The numbers that depend on the difficulty. `Normal` is the base game and is
// what a room uses when no rules were set.
struct Rules {
    Difficulty difficulty = Difficulty::Normal;
    GameMode mode = GameMode::Campaign;
    float enemyHpScale = 1.0f;           // multiplies the hit points of enemies and the boss
    float enemyBulletSpeedScale = 1.0f;  // multiplies the speed of enemy and boss bullets
    float enemyFireIntervalScale = 1.0f; // multiplies the time between two enemy shots
    int startingLives = 3;
    float respawnInvincibility = 2.0f; // seconds of invincibility after a respawn
};

// Easy: fewer hit points, slower and rarer enemy bullets, more lives, longer
// invincibility. Hard is the opposite.
Rules rulesFor(Difficulty difficulty);

// "easy", "normal" or "hard" (any letter case); empty for anything else.
std::optional<Difficulty> parseDifficulty(std::string_view name);
const char *difficultyName(Difficulty difficulty);

// "campaign" or "endless" (any letter case); empty for anything else.
std::optional<GameMode> parseMode(std::string_view name);
const char *modeName(GameMode mode);

// Sets the rules of the room: stored on one entity of the registry, replacing
// the previous ones. Call it once after registerGameComponents(), before the
// first player or enemy is spawned (spawnPlayer and spawnEnemy read the rules
// when they create an entity). Needs registerGameComponents().
void setRules(engine::Registry &registry, const Rules &rules);

// The rules of the room: the ones given to setRules(), or `Normal` when none
// were set (or when the components were not registered).
Rules rulesOf(engine::Registry &registry);

} // namespace game

#endif // GAME_RULES_HPP
