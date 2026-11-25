#include "game/endless.hpp"

#include "game/world.hpp"

#include <algorithm>
#include <array>

namespace game {

namespace {

// Heights where the groups appear (inside the arena, with room for the sine of the Patapata).
constexpr std::array<float, 5> kHeights = {100.0f, 180.0f, 270.0f, 360.0f, 440.0f};

float heightFor(int wave, int slot)
{
    return kHeights[static_cast<std::size_t>((wave + slot) % static_cast<int>(kHeights.size()))];
}

int growing(int base, int wave, int every)
{
    return std::min(base + wave / every, kEndlessMaxGroup);
}

} // namespace

bool isEndlessBossWave(int wave)
{
    return wave >= 0 && wave % kEndlessBossEvery == kEndlessBossEvery - 1;
}

float endlessHpScale(int wave)
{
    return std::min(1.0f + kEndlessHpPerWave * static_cast<float>(std::max(wave, 0)),
                    kEndlessMaxHpScale);
}

std::vector<SpawnEvent> endlessWave(int wave)
{
    wave = std::max(wave, 0);
    // Enemies come closer together as the waves go by, down to a minimum.
    const float gap = std::max(0.25f, 0.6f - 0.02f * static_cast<float>(wave));

    std::vector<SpawnEvent> events;
    addGroup(events, 1.0f, EnemyType::Bink, heightFor(wave, 0), growing(4, wave, 2), gap);
    addGroup(events, 7.0f, EnemyType::Patapata, heightFor(wave, 2), growing(5, wave, 2), gap);
    addGroup(events, 13.0f, EnemyType::Carrier, heightFor(wave, 1), growing(1, wave, 4), 1.2f);
    if (wave >= 2) {
        addGroup(events, 16.0f, EnemyType::Turret, 60.0f, 1 + std::min(wave / 3, 2), 1.5f);
        addGroup(events, 17.0f, EnemyType::Turret, 480.0f, 1 + std::min(wave / 3, 2), 1.5f);
    }
    addGroup(events, 20.0f, EnemyType::Bink, heightFor(wave, 3), growing(3, wave, 2), gap);
    if (isEndlessBossWave(wave)) {
        addGroup(events, 28.0f, EnemyType::Boss, 270.0f, 1, 0.0f);
    }
    return events;
}

} // namespace game
