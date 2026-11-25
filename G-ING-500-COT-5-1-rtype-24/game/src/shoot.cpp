#include "game/shoot.hpp"

#include "game/components.hpp"
#include "game/ecs_helpers.hpp"
#include "game/world.hpp"

#include <algorithm>
#include <vector>

namespace game {

namespace {

struct ShotRequest {
    Position origin;
    float shipHalfWidth;
    int ownerId;
    int damage;
    float speed;
    bool charged;
    float offsetY = 0.0f; // from the ship, for the extra shots of a higher weapon level
    float speedY = 0.0f;
};

// The shots of one tap, by weapon level: 1 shot, 2 parallel shots, then a
// 3-way spread (the straight shot and two angled ones).
void addTapShots(std::vector<ShotRequest> &requests, const Weapon &weapon, const Position &pos,
                 float halfWidth, int ownerId)
{
    const auto shot = [&](float offsetY, float speedY) {
        requests.push_back(
            {pos, halfWidth, ownerId, weapon.damage, weapon.shotSpeed, false, offsetY, speedY});
    };
    if (weapon.level == 0) {
        shot(0.0f, 0.0f);
    } else if (weapon.level == 1) {
        shot(-kTwinShotOffset, 0.0f);
        shot(kTwinShotOffset, 0.0f);
    } else {
        shot(0.0f, 0.0f);
        shot(0.0f, -kSpreadShotVy);
        shot(0.0f, kSpreadShotVy);
    }
}

void spawnShot(engine::Registry &registry, const ShotRequest &request)
{
    const float width = request.charged ? kBeamWidth : kBulletWidth;
    const float height = request.charged ? kBeamHeight : kBulletHeight;

    Projectile projectile;
    projectile.damage = request.damage;
    projectile.lifetime = kShotLifetime;
    projectile.ownerId = request.ownerId;
    projectile.pierce = request.charged;

    // Appears at the nose of the ship, not inside it.
    const engine::Entity shot = registry.spawnEntity();
    registry.addComponent(shot, Position{request.origin.x + request.shipHalfWidth + width * 0.5f,
                                         request.origin.y + request.offsetY});
    registry.addComponent(shot, Velocity{request.speed, request.speedY});
    registry.addComponent(shot, Collider{width, height, kLayerPlayerShot, true});
    registry.addComponent(shot, Team::PlayerShot);
    registry.addComponent(shot,
                          request.charged ? EntityType::ChargedBeam : EntityType::PlayerBullet);
    registry.addComponent(shot, projectile);
}

} // namespace

void shootSystem(engine::Registry &registry, float dt)
{
    if (dt <= 0.0f) {
        return;
    }
    // Spawning inside forEach could reallocate the storages: collect first.
    std::vector<ShotRequest> requests;
    forEach<Weapon, Player, Input, Position>(
        registry, [&](engine::Entity e, Weapon &weapon, Player &player, Input &in, Position &pos) {
            weapon.timer = std::max(0.0f, weapon.timer - dt);
            if (!player.alive) {
                weapon.charge = 0.0f;
                return;
            }
            float halfWidth = 0.0f;
            if (const auto *collider = registry.getComponent<Collider>(e)) {
                halfWidth = collider->w * 0.5f;
            }
            if (in.fire) {
                // First tick of a press: one tap shot if the cooldown is over.
                if (weapon.charge <= 0.0f && weapon.timer <= 0.0f) {
                    addTapShots(requests, weapon, pos, halfWidth, player.playerId);
                    weapon.timer = weapon.cooldown;
                }
                weapon.charge = std::min(weapon.charge + dt, kBeamMaxCharge);
                return;
            }
            // Released: a long enough hold becomes a beam.
            if (weapon.charge >= kBeamMinCharge) {
                const int damage = 1 + static_cast<int>(weapon.charge * kBeamDamagePerSecond);
                requests.push_back({pos, halfWidth, player.playerId, damage, kBeamSpeed, true});
                weapon.timer = weapon.cooldown;
            }
            weapon.charge = 0.0f;
        });
    for (const ShotRequest &request : requests) {
        spawnShot(registry, request);
    }
}

} // namespace game
