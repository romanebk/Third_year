#pragma once

// Where each entity is drawn from in the sprite sheets of sprites.zip
// (client/assets/sprites/r-typesheetN.gif).
//
// The frames of an animation are side by side in the sheet: frame i starts at
// x + i * step. To change a sprite, only this table has to be edited.

#include "game/components.hpp"

#include <string>

namespace client {

struct SpriteInfo {
    std::string sheet; // file name in assets/sprites/
    int x = 0;         // first frame
    int y = 0;
    int width = 0;
    int height = 0;
    int frames = 1;         // number of animation frames
    int step = 0;           // distance between two frames in the sheet
    float frameTime = 0.1f; // seconds per frame
    float scale = 1.0f;     // drawing size
};

// `extra` is the extra field of the entity: for a bonus it says which one it is
// (game::PickupKind), and each kind has its own sprite.
SpriteInfo getSpriteInfo(game::EntityType type, int extra = 0);

// Visual style of an enemy ball: the snapshot `extra` is a game::BulletVisual.
// Values outside the four bosses fall back to the ordinary enemy shot.
game::BulletVisual bossBallVisual(int extra);

// The four bosses of the game. The server still sends a single
// game::EntityType::Boss, so the client picks the sprite from the stage/wave
// that is being played (see bossKindForStage).
enum class BossKind : int { Dobkeratops = 0, Gomander = 1, Warship = 2, Compiler = 3 };
inline constexpr int kBossKindCount = 4;
inline constexpr int kCampaignBossCount = 3;
inline constexpr int kBossEveryEndlessWaves = 5;

// Boss shown at `stage` (from 1, as in Snapshot::stage). Campaign: one boss
// per level, in order (Dobkeratops, Gomander, Warship, then repeat).
// Endless: one boss every five waves, in order (all four bosses, then repeat).
BossKind bossKindForStage(int stage, bool endless);

// Sprite of one boss, and its name for the boss bar / the warning message.
SpriteInfo getBossSpriteInfo(BossKind kind);
const char *bossName(BossKind kind);

// The player ship is special: one row per player color (r-typesheet42.gif,
// 5 frames of 33 x 17), and the frame depends on the vertical speed
// (the ship tilts when it goes up or down).
const int kShipFrameWidth = 33;
const int kShipFrameHeight = 17;
int getShipFrame(float speedY);

} // namespace client
