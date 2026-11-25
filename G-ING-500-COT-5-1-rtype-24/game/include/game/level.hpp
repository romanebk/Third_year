#ifndef GAME_LEVEL_HPP
#define GAME_LEVEL_HPP

#include "engine/ecs/Entity.hpp"
#include "engine/ecs/Registry.hpp"
#include "game/components.hpp"

#include <cstddef>
#include <vector>

namespace game {

// One enemy to spawn: `time` seconds after the start of the level, just
// right of the arena, at height `y`.
struct SpawnEvent {
    float time;
    EnemyType type;
    float y;
};

// Server-side state of the running level, kept on a single entity of the
// registry (not replicated, so it does not have to be POD). Events are sorted
// by time; `next` is the first one not spawned yet.
struct LevelRun {
    std::vector<SpawnEvent> events;
    float time = 0.0f;
    std::size_t next = 0;
};

// Appends `count` enemies of one type at the same height, one every
// `interval` seconds starting at `time`.
void addGroup(std::vector<SpawnEvent> &events, float time, EnemyType type, float y, int count,
              float interval);

// The timeline of level 1 (about 70 s): open space, a few turrets, a Carrier
// or two, then the boss. Provisional until playtested.
std::vector<SpawnEvent> level1();

// The timeline of level 2 (about 80 s), "the cavern": more enemies, turrets
// as walls at the top and the bottom, two lines of Patapata and swarms of
// Bink, then the boss. Harder and faster than level 1.
std::vector<SpawnEvent> level2();

// The levels of the game, numbered from 0.
int levelCount();
std::vector<SpawnEvent> levelEvents(int index); // throws std::out_of_range
const char *levelName(int index);               // throws std::out_of_range

// Starts a level in the registry: creates the LevelRun entity (replacing a
// previous one) with the events sorted by time. Needs components registered
// with registerGameComponents().
engine::Entity loadLevel(engine::Registry &registry, std::vector<SpawnEvent> events);

// Advances the level clock and spawns the enemies that are due, with the hit
// points scaled to the number of players in the room. Does nothing if no
// level is loaded.
void wavesSystem(engine::Registry &registry, float dt);

// True when a level is loaded, every event was spawned and no enemy is left.
bool isLevelCleared(engine::Registry &registry);

// A campaign plays the levels one after the other, for the same players (they
// keep their score, lives and upgrades). It is kept on one entity of the
// registry, like the level.
struct Campaign {
    int current = 0;         // index of the level being played
    int count = 1;           // number of levels
    bool clearing = false;   // the level is cleared, waiting before the next one
    float transition = 0.0f; // seconds left of that wait
};

// Starts the campaign at level 0: loads it and creates the Campaign. A room
// that only calls loadLevel() plays a single level, as before.
void startCampaign(engine::Registry &registry);

// Run once per tick. When the level is cleared and another one follows, waits
// kStageClearDelay seconds and then loads the next level.
void campaignSystem(engine::Registry &registry, float dt);

// The stage being played, from 1 (1 as well when there is no campaign).
int currentStage(engine::Registry &registry);

// True when the whole game is won: without a campaign, the loaded level is
// cleared; with one, the last level is cleared.
bool isCampaignCleared(engine::Registry &registry);

} // namespace game

#endif // GAME_LEVEL_HPP
