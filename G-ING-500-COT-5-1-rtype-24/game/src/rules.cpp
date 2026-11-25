#include "game/rules.hpp"

#include "game/ecs_helpers.hpp"

#include <algorithm>
#include <cctype>
#include <string>
#include <vector>

namespace game {

Rules rulesFor(Difficulty difficulty)
{
    Rules rules;
    rules.difficulty = difficulty;
    switch (difficulty) {
    case Difficulty::Easy:
        rules.enemyHpScale = 0.5f;
        rules.enemyBulletSpeedScale = 0.75f;
        rules.enemyFireIntervalScale = 1.5f;
        rules.startingLives = 5;
        rules.respawnInvincibility = 3.0f;
        break;
    case Difficulty::Normal:
        break;
    case Difficulty::Hard:
        rules.enemyHpScale = 1.5f;
        rules.enemyBulletSpeedScale = 1.25f;
        rules.enemyFireIntervalScale = 0.75f;
        rules.startingLives = 2;
        rules.respawnInvincibility = 1.5f;
        break;
    }
    return rules;
}

std::optional<Difficulty> parseDifficulty(std::string_view name)
{
    std::string lower(name);
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (lower == "easy") {
        return Difficulty::Easy;
    }
    if (lower == "normal") {
        return Difficulty::Normal;
    }
    if (lower == "hard") {
        return Difficulty::Hard;
    }
    return std::nullopt;
}

const char *difficultyName(Difficulty difficulty)
{
    switch (difficulty) {
    case Difficulty::Easy:
        return "easy";
    case Difficulty::Normal:
        return "normal";
    case Difficulty::Hard:
        return "hard";
    }
    return "normal";
}

std::optional<GameMode> parseMode(std::string_view name)
{
    std::string lower(name);
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (lower == "campaign") {
        return GameMode::Campaign;
    }
    if (lower == "endless") {
        return GameMode::Endless;
    }
    return std::nullopt;
}

const char *modeName(GameMode mode)
{
    return mode == GameMode::Endless ? "endless" : "campaign";
}

void setRules(engine::Registry &registry, const Rules &rules)
{
    std::vector<engine::Entity> previous;
    forEach<Rules>(registry, [&](engine::Entity e, Rules &) { previous.push_back(e); });
    for (const engine::Entity e : previous) {
        registry.killEntity(e);
    }
    const engine::Entity holder = registry.spawnEntity();
    registry.addComponent(holder, rules);
}

Rules rulesOf(engine::Registry &registry)
{
    Rules rules = rulesFor(Difficulty::Normal);
    if (!registry.isRegistered<Rules>()) {
        return rules;
    }
    forEach<Rules>(registry, [&](engine::Entity, Rules &found) { rules = found; });
    return rules;
}

} // namespace game
