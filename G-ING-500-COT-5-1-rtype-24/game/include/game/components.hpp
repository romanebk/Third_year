#pragma once

// J2 gameplay components: POD structs, no ECS dependency.
// Full semantics in docs/game-design.md. All types are trivially
// copyable so the network layer (S2) can memcpy them into snapshots.

#include <cstdint>

namespace game {

struct Position {
    float x = 0.0f;
    float y = 0.0f;
};

struct Velocity {
    float vx = 0.0f;
    float vy = 0.0f;
};

struct Health {
    int hp = 1;
    int maxHp = 1;
};

struct Collider {
    float w = 0.0f;
    float h = 0.0f;
    // Bitmask, see docs/game-design.md §6. AABB only in S1.
    // Player=1, Enemy=2, PlayerShot=4, EnemyShot=8, Pickup=16.
    std::uint8_t layer = 0;
    bool solid = true;
};

enum class Team : std::uint8_t {
    P0 = 0,
    P1 = 1,
    P2 = 2,
    P3 = 3,
    Enemy = 4,
    PlayerShot = 5,
    EnemyShot = 6,
    Pickup = 7,
    Neutral = 8
};

// Client -> server input. `charge` is derived server-side by holding
// `fire`, so it is not sent. `seq` is used for ack/prediction (S3).
struct Input {
    bool up = false;
    bool down = false;
    bool left = false;
    bool right = false;
    bool fire = false;
    bool detach = false;
    std::uint32_t seq = 0;
};

// 1-byte network mask for Input (seq sent separately as uint32).
// Bit order: 0=up 1=down 2=left 3=right 4=fire 5=detach.
inline std::uint8_t inputMask(const Input &in)
{
    const unsigned mask = (in.up ? 1u : 0u) | (in.down ? 2u : 0u) | (in.left ? 4u : 0u) |
                          (in.right ? 8u : 0u) | (in.fire ? 16u : 0u) | (in.detach ? 32u : 0u);
    return static_cast<std::uint8_t>(mask);
}

inline Input inputFromMask(std::uint8_t mask, std::uint32_t seq)
{
    Input in;
    in.up = (mask & 1u) != 0;
    in.down = (mask & 2u) != 0;
    in.left = (mask & 4u) != 0;
    in.right = (mask & 8u) != 0;
    in.fire = (mask & 16u) != 0;
    in.detach = (mask & 32u) != 0;
    in.seq = seq;
    return in;
}

// --- J3/J4 components (docs/game-design.md §2) ---------------------------

// Tells the client which sprite to draw (replicated, 1 byte).
enum class EntityType : std::uint8_t {
    Ship,
    Force,
    Bink,
    Patapata,
    Turret,
    Carrier,
    PlayerBullet,
    EnemyBullet,
    ChargedBeam,
    Missile,
    PickupEnt,
    Explosion,
    Boss
};

// One per player ship. Score and lives live here (§7).
struct Player {
    int playerId = 0;
    int lives = 3;
    int score = 0;
    float invincibleTimer = 0.0f;
    float respawnTimer = 0.0f;
    bool alive = true;
};

// Per-player upgrades (§3, §8).
struct PowerState {
    std::uint8_t speedLevel = 0;
    bool hasMissile = false;
    bool hasLaser = false;
    std::uint8_t forcePower = 0;
};

// Enemy trajectory (§5). `Static` scrolls with the level.
enum class MovementType : std::uint8_t { Straight, Sine, Static, Chase };

struct Movement {
    MovementType type = MovementType::Straight;
    float t = 0.0f; // time since spawn, advanced by the pattern system
    float amp = 0.0f;
    float freq = 0.0f; // Hz
    float speed = 0.0f;
};

enum class EnemyType : std::uint8_t { Bink, Patapata, Turret, Carrier, Boss };

struct Enemy {
    EnemyType type = EnemyType::Bink;
    int scoreValue = 0;
    float fireTimer = 0.0f;
    float fireCooldown = 0.0f;
};

// State of the boss (§5): it enters from the right, then hovers and shoots.
// `phase` is 1, then 2 (enraged) once it is at half health.
struct BossState {
    std::uint8_t phase = 1;
    bool arrived = false;
    float t = 0.0f; // hover clock, runs faster in phase 2
    float fireTimer = 0.0f;
};

// What a pickup gives (docs/game-design.md §8). The missile and Force items
// come with those weapons.
enum class PickupKind : std::uint8_t { Power, Speed };

// A bonus floating in the arena, collected by touching it with a ship.
struct Pickup {
    PickupKind kind = PickupKind::Power;
};

// Server-side state of the drops, kept on one entity of the registry: a
// counter that feeds the (deterministic) random drops of Bink and Patapata,
// and the number of Carrier drops so far (they alternate the kinds).
struct DropState {
    std::uint32_t rolls = 0;
    std::uint32_t carrierDrops = 0;
};

// Network identity of a replicated entity (u16 on the wire, docs/rfc-protocol.md
// §7.2). Added by assignNetIds(); never reused while the room lives.
struct NetId {
    std::uint16_t value = 0;
};

// Server-side counter behind NetId, kept on one entity of the registry.
struct NetIdAllocator {
    std::uint16_t next = 1; // 0 is never handed out
};

// Visual variant of an EnemyBullet, replicated in SnapshotEntity::extra. The
// behaviour is the same for every ball (an EnemyShot with damage > 0): only
// the sprite changes on the client. 0 is the ordinary enemy shot; 1..4 are the
// special balls of the four bosses, in sprite order.
enum class BulletVisual : std::uint8_t {
    Normal = 0,
    Dobkeratops = 1,
    Gomander = 2,
    Warship = 3,
    Compiler = 4,
};

// Player or enemy bullet. `ownerId` is the playerId credited with kills
// (-1 = nobody). A piercing shot survives a hit that kills its target.
// `visual` only matters for EnemyBullet (the snapshot `extra` byte).
struct Projectile {
    int damage = 1;
    float lifetime = 2.0f;
    int ownerId = -1;
    bool pierce = false;
    BulletVisual visual = BulletVisual::Normal;
};

// Generic time-to-live (explosions, texts).
struct Lifetime {
    float remaining = 0.0f;
};

// Server-side fire control of a ship (§3). `timer` counts down to the next
// allowed tap shot; `charge` is the time `fire` has been held (0 = not held).
struct Weapon {
    float cooldown = 0.15f;
    float timer = 0.0f;
    int damage = 1;
    float shotSpeed = 500.0f;
    std::uint8_t level = 0;
    float charge = 0.0f;
};

enum class ForceAttach : std::uint8_t { Front, Back, Detached };

// The Force (§4): invincible, absorbs enemy shots, rams enemies.
struct ForcePod {
    int ownerId = 0;
    ForceAttach attach = ForceAttach::Front;
    std::uint8_t power = 1;
};

} // namespace game
