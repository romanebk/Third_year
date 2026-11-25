#include "game/level.hpp"

#include "game/ecs_helpers.hpp"
#include "game/endless.hpp"
#include "game/enemies.hpp"
#include "game/rules.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string>
#include <utility>

namespace game {

void addGroup(std::vector<SpawnEvent> &events, float time, EnemyType type, float y, int count,
              float interval)
{
    for (int i = 0; i < count; ++i) {
        events.push_back({time + interval * static_cast<float>(i), type, y});
    }
}

std::vector<SpawnEvent> level1()
{
    std::vector<SpawnEvent> events;
    addGroup(events, 2.0f, EnemyType::Bink, 270.0f, 5, 0.7f);
    addGroup(events, 9.0f, EnemyType::Patapata, 180.0f, 6, 0.5f);
    addGroup(events, 14.0f, EnemyType::Patapata, 360.0f, 6, 0.5f);
    addGroup(events, 20.0f, EnemyType::Turret, 60.0f, 1, 0.0f);
    addGroup(events, 22.0f, EnemyType::Turret, 480.0f, 1, 0.0f);
    addGroup(events, 26.0f, EnemyType::Carrier, 140.0f, 2, 1.5f);
    addGroup(events, 32.0f, EnemyType::Bink, 100.0f, 4, 0.6f);
    addGroup(events, 32.0f, EnemyType::Bink, 440.0f, 4, 0.6f);
    addGroup(events, 40.0f, EnemyType::Turret, 270.0f, 1, 0.0f);
    addGroup(events, 42.0f, EnemyType::Patapata, 270.0f, 8, 0.4f);
    addGroup(events, 50.0f, EnemyType::Carrier, 400.0f, 2, 1.5f);
    addGroup(events, 52.0f, EnemyType::Bink, 200.0f, 6, 0.5f);
    addGroup(events, 60.0f, EnemyType::Turret, 70.0f, 1, 0.0f);
    addGroup(events, 60.0f, EnemyType::Turret, 470.0f, 1, 0.0f);
    addGroup(events, 70.0f, EnemyType::Boss, 270.0f, 1, 0.0f);
    return events;
}

std::vector<SpawnEvent> level2()
{
    std::vector<SpawnEvent> events;
    // The walls of the cavern: turrets at the top and the bottom.
    addGroup(events, 2.0f, EnemyType::Turret, 60.0f, 1, 0.0f);
    addGroup(events, 2.0f, EnemyType::Turret, 480.0f, 1, 0.0f);
    addGroup(events, 6.0f, EnemyType::Patapata, 270.0f, 8, 0.35f);
    addGroup(events, 12.0f, EnemyType::Bink, 150.0f, 6, 0.5f);
    addGroup(events, 12.0f, EnemyType::Bink, 390.0f, 6, 0.5f);
    addGroup(events, 18.0f, EnemyType::Turret, 60.0f, 1, 0.0f);
    addGroup(events, 18.0f, EnemyType::Turret, 480.0f, 1, 0.0f);
    addGroup(events, 18.0f, EnemyType::Carrier, 270.0f, 1, 0.0f);
    addGroup(events, 24.0f, EnemyType::Patapata, 150.0f, 6, 0.4f);
    addGroup(events, 24.0f, EnemyType::Patapata, 390.0f, 6, 0.4f);
    addGroup(events, 32.0f, EnemyType::Carrier, 200.0f, 2, 1.0f);
    addGroup(events, 32.0f, EnemyType::Bink, 270.0f, 10, 0.35f);
    addGroup(events, 40.0f, EnemyType::Turret, 60.0f, 1, 0.0f);
    addGroup(events, 40.5f, EnemyType::Turret, 270.0f, 1, 0.0f);
    addGroup(events, 41.0f, EnemyType::Turret, 480.0f, 1, 0.0f);
    addGroup(events, 46.0f, EnemyType::Patapata, 270.0f, 10, 0.3f);
    addGroup(events, 46.0f, EnemyType::Bink, 120.0f, 8, 0.4f);
    addGroup(events, 46.0f, EnemyType::Bink, 420.0f, 8, 0.4f);
    addGroup(events, 56.0f, EnemyType::Carrier, 140.0f, 1, 0.0f);
    addGroup(events, 56.0f, EnemyType::Carrier, 400.0f, 1, 0.0f);
    addGroup(events, 60.0f, EnemyType::Turret, 60.0f, 1, 0.0f);
    addGroup(events, 60.0f, EnemyType::Turret, 160.0f, 1, 0.0f);
    addGroup(events, 60.0f, EnemyType::Turret, 380.0f, 1, 0.0f);
    addGroup(events, 60.0f, EnemyType::Turret, 480.0f, 1, 0.0f);
    addGroup(events, 64.0f, EnemyType::Bink, 270.0f, 12, 0.25f);
    addGroup(events, 72.0f, EnemyType::Patapata, 150.0f, 8, 0.3f);
    addGroup(events, 72.0f, EnemyType::Patapata, 390.0f, 8, 0.3f);
    addGroup(events, 80.0f, EnemyType::Boss, 270.0f, 1, 0.0f);
    return events;
}

int levelCount()
{
    return 2;
}

std::vector<SpawnEvent> levelEvents(int index)
{
    switch (index) {
    case 0:
        return level1();
    case 1:
        return level2();
    default:
        throw std::out_of_range("no such level: " + std::to_string(index));
    }
}

const char *levelName(int index)
{
    switch (index) {
    case 0:
        return "Bydo outpost";
    case 1:
        return "The cavern";
    default:
        throw std::out_of_range("no such level: " + std::to_string(index));
    }
}

engine::Entity loadLevel(engine::Registry &registry, std::vector<SpawnEvent> events)
{
    std::vector<engine::Entity> previous;
    forEach<LevelRun>(registry, [&](engine::Entity e, LevelRun &) { previous.push_back(e); });
    for (const engine::Entity e : previous) {
        registry.killEntity(e);
    }

    std::stable_sort(events.begin(), events.end(),
                     [](const SpawnEvent &a, const SpawnEvent &b) { return a.time < b.time; });
    LevelRun run;
    run.events = std::move(events);

    const engine::Entity director = registry.spawnEntity();
    registry.addComponent(director, std::move(run));
    return director;
}

void wavesSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    std::vector<SpawnEvent> due;
    forEach<LevelRun>(registry, [&](engine::Entity, LevelRun &run) {
        run.time += dt;
        while (run.next < run.events.size() && run.events[run.next].time <= run.time) {
            due.push_back(run.events[run.next]);
            ++run.next;
        }
    });
    if (due.empty()) {
        return;
    }
    int players = 0;
    forEach<Player>(registry, [&](engine::Entity, Player &) { ++players; });
    // Endless: the enemies of a late wave have more hit points.
    float hpScale = 1.0f;
    if (rulesOf(registry).mode == GameMode::Endless) {
        forEach<Campaign>(registry, [&](engine::Entity, Campaign &campaign) {
            hpScale = endlessHpScale(campaign.current);
        });
    }
    for (const SpawnEvent &event : due) {
        const engine::Entity enemy =
            spawnEnemy(registry, event.type, kArenaWidth + kEnemySpawnMargin, event.y, players);
        if (hpScale > 1.0f) {
            if (auto *health = registry.getComponent<Health>(enemy)) {
                health->hp = std::max(
                    1, static_cast<int>(std::ceil(static_cast<float>(health->hp) * hpScale)));
                health->maxHp = health->hp;
            }
        }
    }
}

bool isLevelCleared(engine::Registry &registry)
{
    bool loaded = false;
    bool allSpawned = false;
    forEach<LevelRun>(registry, [&](engine::Entity, LevelRun &run) {
        loaded = true;
        allSpawned = run.next >= run.events.size();
    });
    if (!loaded || !allSpawned) {
        return false;
    }
    bool enemyLeft = false;
    forEach<Enemy>(registry, [&](engine::Entity, Enemy &) { enemyLeft = true; });
    return !enemyLeft;
}

void startCampaign(engine::Registry &registry)
{
    std::vector<engine::Entity> previous;
    forEach<Campaign>(registry, [&](engine::Entity e, Campaign &) { previous.push_back(e); });
    for (const engine::Entity e : previous) {
        registry.killEntity(e);
    }
    const bool endless = rulesOf(registry).mode == GameMode::Endless;
    loadLevel(registry, endless ? endlessWave(0) : levelEvents(0));
    Campaign campaign;
    campaign.count = levelCount();
    const engine::Entity holder = registry.spawnEntity();
    registry.addComponent(holder, campaign);
}

void campaignSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    // Endless: there is always a next wave, after a shorter pause.
    const bool endless = rulesOf(registry).mode == GameMode::Endless;
    const float delay = endless ? kEndlessWaveDelay : kStageClearDelay;
    int next = -1;
    forEach<Campaign>(registry, [&](engine::Entity, Campaign &campaign) {
        if (!campaign.clearing) {
            const bool another = endless || campaign.current + 1 < campaign.count;
            if (another && isLevelCleared(registry)) {
                campaign.clearing = true;
                campaign.transition = delay;
            }
            return;
        }
        campaign.transition -= dt;
        if (campaign.transition <= 0.0f) {
            campaign.clearing = false;
            campaign.current += 1;
            next = campaign.current;
        }
    });
    if (next >= 0) {
        // after the loop: it spawns and kills
        loadLevel(registry, endless ? endlessWave(next) : levelEvents(next));
    }
}

int currentStage(engine::Registry &registry)
{
    int stage = 1;
    if (registry.isRegistered<Campaign>()) {
        forEach<Campaign>(
            registry, [&](engine::Entity, Campaign &campaign) { stage = campaign.current + 1; });
    }
    return stage;
}

bool isCampaignCleared(engine::Registry &registry)
{
    if (rulesOf(registry).mode == GameMode::Endless) {
        return false; // an endless game has no victory, only the defeat
    }
    if (!isLevelCleared(registry)) {
        return false;
    }
    bool lastLevel = true;
    if (registry.isRegistered<Campaign>()) {
        forEach<Campaign>(registry, [&](engine::Entity, Campaign &campaign) {
            lastLevel = campaign.current + 1 >= campaign.count;
        });
    }
    return lastLevel;
}

} // namespace game
