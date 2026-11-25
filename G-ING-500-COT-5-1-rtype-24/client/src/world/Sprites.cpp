#include "world/Sprites.hpp"

namespace client {

game::BulletVisual bossBallVisual(int extra)
{
    if (extra <= static_cast<int>(game::BulletVisual::Normal) ||
        extra > static_cast<int>(game::BulletVisual::Compiler)) {
        return game::BulletVisual::Normal;
    }
    return static_cast<game::BulletVisual>(extra);
}

BossKind bossKindForStage(int stage, bool endless)
{
    const int index = stage > 0 ? stage - 1 : 0;
    if (endless) {
        // The boss waves are stages 5, 10, 15... (wave 4, 9, 14...).
        return static_cast<BossKind>((index / kBossEveryEndlessWaves) % kBossKindCount);
    }
    return static_cast<BossKind>(index % kCampaignBossCount);
}

SpriteInfo getBossSpriteInfo(BossKind kind)
{
    //                 sheet                 x    y    w   h  frames step time  scale
    switch (kind) {
    case BossKind::Gomander:
        // Gomander: the eye opens on the first two frames of r-typesheet32.
        return {"r-typesheet32.gif", 2, 2, 256, 140, 2, 260, 0.25f, 0.75f};
    case BossKind::Warship:
        // The huge mothership of r-typesheet37, one 594 x 191 frame.
        return {"r-typesheet37.gif", 0, 0, 594, 191, 1, 0, 0.1f, 0.55f};
    case BossKind::Compiler:
        // Compiler: the two "parents" frames of r-typesheet38.
        return {"r-typesheet38.gif", 2, 2, 176, 144, 2, 189, 0.25f, 1.0f};
    case BossKind::Dobkeratops:
    default:
        // Dobkeratops, the historical boss (4 frames of 155 x 203).
        return {"r-typesheet30.gif", 27, 3, 155, 203, 4, 162, 0.2f, 0.8f};
    }
}

const char *bossName(BossKind kind)
{
    switch (kind) {
    case BossKind::Gomander:
        return "GOMANDER";
    case BossKind::Warship:
        return "WARSHIP";
    case BossKind::Compiler:
        return "COMPILER";
    case BossKind::Dobkeratops:
    default:
        return "DOBKERATOPS";
    }
}

SpriteInfo getSpriteInfo(game::EntityType type, int extra)
{
    //                 sheet                 x    y    w   h  frames step time  scale
    switch (type) {
    case game::EntityType::Ship:
        return {"r-typesheet42.gif", 66, 0, 33, 17, 1, 33, 0.1f, 1.5f};
    case game::EntityType::Force:
        return {"r-typesheet30a.gif", 1, 3, 32, 28, 3, 34, 0.1f, 1.0f};
    case game::EntityType::Bink:
        return {"r-typesheet5.gif", 0, 0, 33, 36, 8, 33, 0.1f, 1.0f};
    case game::EntityType::Patapata:
        return {"r-typesheet3.gif", 1, 2, 16, 14, 12, 17, 0.08f, 1.5f};
    case game::EntityType::Turret:
        return {"r-typesheet11.gif", 1, 1, 32, 32, 6, 33, 0.15f, 1.0f};
    case game::EntityType::Carrier:
        return {"r-typesheet7.gif", 1, 1, 32, 32, 6, 33, 0.15f, 1.0f};
    case game::EntityType::PlayerBullet:
    case game::EntityType::Missile:
        return {"r-typesheet1.gif", 249, 105, 16, 8, 1, 0, 0.1f, 1.0f};
    case game::EntityType::ChargedBeam:
        return {"r-typesheet1.gif", 249, 105, 16, 8, 1, 0, 0.1f, 2.5f};
    case game::EntityType::EnemyBullet:
        return {"r-typesheet1.gif", 259, 276, 14, 12, 1, 0, 0.1f, 1.0f};
    case game::EntityType::PickupEnt:
        if (extra == static_cast<int>(game::PickupKind::Speed)) {
            // Speed: green and orange capsule.
            return {"r-typesheet16.gif", 1, 13, 16, 9, 4, 17, 0.1f, 1.5f};
        }
        // Power: orange orb.
        return {"r-typesheet12.gif", 1, 2, 16, 16, 6, 17, 0.1f, 1.0f};
    case game::EntityType::Explosion:
        return {"r-typesheet44.gif", 162, 1, 32, 32, 4, 33, 0.1f, 1.0f};
    case game::EntityType::Boss:
        // Without a stage, the default boss is Dobkeratops; GameScreen uses
        // getBossSpriteInfo(bossKindForStage(...)) to draw the others.
        return getBossSpriteInfo(BossKind::Dobkeratops);
    }
    return {"r-typesheet5.gif", 0, 0, 33, 36, 1, 33, 0.1f, 1.0f};
}

int getShipFrame(float speedY)
{
    // Frames: 0-1 going down, 2 straight, 3-4 going up.
    if (speedY < -150.0f) {
        return 4;
    }
    if (speedY < -10.0f) {
        return 3;
    }
    if (speedY > 150.0f) {
        return 0;
    }
    if (speedY > 10.0f) {
        return 1;
    }
    return 2;
}

} // namespace client
