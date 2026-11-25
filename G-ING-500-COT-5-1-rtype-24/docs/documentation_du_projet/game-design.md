# Game Design — R-Type (Role C, J1)

Owner: Ariel · Status: J1-J5 done (design, components, movement, collisions, shooting, respawn, room tick), waves, enemy fire, the boss, the snapshot extractor, the difficulty rules, Power/Speed pickups, two levels, the campaign and the per-player HUD done. Values are provisional until playtested.

Authoritative model: the room server simulates everything below. The client only sends `Input` and renders replicated `Position` + `EntityType`. No gameplay logic client-side.

## 1. World conventions

- 2D side-scroll, X right, Y down. Logical arena: 960 x 540 units (16:9). Pixels = units for J1-J2; scaling handled by client later.
- **`Position` is the CENTER of the entity**, and a `Collider` `w x h` is an AABB centered on it. The client must draw sprites centered on `Position`.
- Server tick: 60 Hz fixed. All speeds in units/second.
- Scroll: level scrolls left at `scrollSpeed = 60 u/s` (Level 1). Background is client-only; gameplay entities move in world space.
- Player spawn zone: `x = 60`, `y = 198 / 246 / 294 / 342` for `playerId` 0..3 (48 units apart, centered on the arena).
- Friendly fire: OFF. Player bullets never hit players. Enemy bullets never hit enemies.
- Up to 4 players, `playerId 0..3`. Late join spawns with the difficulty's starting lives (§12), 0 score.

## 2. Components (ECS-ready, J2 implements these structs)

All POD, no pointers, no `std::string` inside hot path (for snapshot serialization in S2).

| Component | Fields | Replicated? | Notes |
|---|---|---|---|
| `Position` | `float x, y` | YES | Interpolated on client |
| `Velocity` | `float vx, vy` | no (derived) | Set by movement system |
| `Health` | `int hp, maxHp` | YES (hp only) | 0 = dead |
| `Collider` | `float w, h; uint8_t layer; bool solid` | no | AABB only in S1. Layers: see §6 |
| `Team` | `enum {P0,P1,P2,P3, Enemy, PlayerShot, EnemyShot, Pickup, Neutral}` | YES (1 byte) | Decides who collides with whom |
| `Input` | `bool up,down,left,right,fire,detach; uint32_t seq` | client->server only | `charge` = hold `fire`. `seq` for ack/prediction (S3) |
| `Player` | `int playerId; int lives; int score; float invincibleTimer; float respawnTimer; bool alive` | YES (lives, score, alive) | Score lives here, not separate component |
| `Weapon` | `float cooldown, timer; int damage; float shotSpeed; uint8_t level; float charge` | no | Server-side fire rate. `charge` = seconds `fire` has been held (0 = not held) |
| `Projectile` | `int damage; float lifetime; int ownerId; bool pierce` | no | `lifetime` counts down, kill at 0. `ownerId` = playerId credited with kills (-1 none). `pierce`: survives a hit that kills its target (charged beam) |
| `Lifetime` | `float remaining` | no | Generic TTL (explosions, texts) |
| `Movement` | `enum {Straight, Sine, Static, Chase} type; float t; float amp, freq; float speed` | no | `t` = time since spawn. Enemy patterns only. `Static` scrolls left with the level |
| `Enemy` | `enum {Bink, Patapata, Turret, Carrier} type; int scoreValue; float fireTimer, fireCooldown` | YES (type) | Firing handled by wave system |
| `ForcePod` | `int ownerId; enum {Front, Back, Detached} attach; uint8_t power;` | YES | `power` 1..3. Invincible, blocks shots (§4) |
| `Pickup` | `enum {Power, Speed}` in code; `MissileM`, `ForceItem` planned (§8) | YES (kind) | Dropped by Carriers and some enemies, scrolls left |
| `PowerState` | `uint8_t speedLevel; bool hasMissile; bool hasLaser; uint8_t forcePower` | YES | Per-player upgrades, max levels capped |
| `EntityType` | `enum {Ship, Force, Bink, Patapata, Turret, Carrier, PlayerBullet, EnemyBullet, ChargedBeam, Missile, PickupEnt, Explosion, Boss}` | YES (1 byte) | Tells client which sprite to draw. Avoids sending texture ids |
| `Parent` | `uint32_t parentId; float offX, offY` | no | Temporary until engine hierarchy lands (S3). Used by Force attach |

J2 delivered: `Position, Velocity, Health, Collider, Team, Input` + tests.
J3-J4 added: `Player, PowerState, Movement, Enemy, Projectile, Lifetime, ForcePod, EntityType`.
J5 added: `Weapon`. Snapshot added: `NetId`, `NetIdAllocator` (network identity, see §10).
Pickups added: `Pickup`, `DropState`. Still to add: `Parent` (S3).

What we deliberately DON'T have in S1: rotation (all AABB axis-aligned), physics engine, quadtree (linear scan is fine for <200 entities), scripting.

## 3. Player ship (R-9)

- Speed base: 220 u/s. `SpeedS` pickup: +40 u/s per level, max 3 levels (220/260/300).
- HP: 1 (one hit = death, classic R-Type). `Health{1,1}`. Invincibility bypasses this.
- Fire:
  - Tap `fire`: normal shot, `cooldown 0.15s`, `damage 1`, speed `500 u/s` rightward, TTL 2s.
  - Hold `fire`: charge meter 0..2s. Release: beam `damage = 1 + charge*3` (max ~7), wider collider, pierces weak enemies.
  - `MissileM` (planned, not implemented): would add 1 homing-ish missile per shot going slightly up/down, `damage 1`, `cooldown 0.5s`.
- Hitbox: `24 x 16` (smaller than sprite, forgiving). Sprite ~32x24.
- Death: explosion, lose one weapon level and one speed level, keep score (no Force to drop in v1).

## 4. The Force (designed, not implemented yet)

Core differentiator, designed in J1; the components exist (`ForcePod`,
`EntityType::Force`) but no system spawns or moves a Force in v1. The rules:

- One Force per player max. Picked via `ForceItem` pickup (orange ball).
- States:
  - `Front`: offset `(+28, 0)` from ship. Adds its own gun (same cooldown as ship, `damage 1`, doubles DPS).
  - `Back`: offset `(-28, 0)`. Same fire, covers rear (shots go left).
  - `Detached`: free entity, keeps last velocity + player nudge via `fire` direction? S1 simplification: drifts with scroll + sine, auto-fires forward. Re-attach on contact with owner (`detach` key toggles).
- `power` 1..3 via `PowerP` pickups while Force owned: L1 = 1 bullet, L2 = 2 angled bullets, L3 = 2 bullets + rear bullet.
- Force is INVINCIBLE and destroys `EnemyShot` on contact (absorbs). It also deals contact damage `3` to enemies (ram).
- If owner dies, Force detaches and drifts left at scroll speed for 5s, then despawns if not reclaimed.

## 5. Bydos (enemies)

S2 spawns these from a level timeline file. Stats tuned for 1-4 players (HP scales: `hp *= 1 + 0.25*(players-1)`, rounded up).

| Type | HP | Speed | Pattern | Fire | Score | Sprite hint |
|---|---|---|---|---|---|---|
| `Bink` (Bug) | 1 | 140 left | Straight, slight chase Y toward nearest player | none | 100 | small crab |
| `Patapata` | 1 | 120 left + sine (`amp 60, freq 2Hz`) | Sine | none (ram) | 150 | flapping |
| `Turret` (Cancer) | 3 | 0 (scrolls with level) | Static, aims at nearest player | aimed shot every 2.0s, speed 200 | 300 | wall-mounted |
| `Carrier` (Capsule) | 2 | 80 left | Straight | none, drops a `Pickup` on death (alternates Power and Speed, §8) | 200 | container |
| `Dobkeratops` (Boss, implemented) | 120 + 20/player | slow horizontal drift | 2 phases: P1 aimed shots, P2 enrage (faster, spread) | spread 3-way every 1.2s | 5000 | big serpent |

- Contact with player/Force = `damage 1` to player (Force takes 0, enemy takes 3).
- Enemy bullets: `8x8`, speed 200, `damage 1`, TTL 4s. The boss balls are the same `EnemyBullet` with a visual variant in `extra` (`BulletVisual::Dobkeratops`, `Gomander`, `Warship`, `Compiler`); the behaviour does not change.
- Kill awards score to killer (`playerId` from bullet owner). Ram kills by Force award owner.

Not implemented: ground turrets with terrain collision, and the boss tail attack (both were cut to keep the scope). Level 2 uses the same enemy types as level 1.

## 6. Collisions (AABB, server only)

Layers (bitmask, J14 refines): `Player(1), Enemy(2), PlayerShot(4), EnemyShot(8), Pickup(16)`.

Implementation notes (J4): the rules are selected from `Team` (+ presence of `ForcePod` for the Force), not from `layer` yet. `Collider::solid == false` means "ignored by collision". Dead players (`Player::alive == false`) do not collide. Touching edges do not count as overlap.

Pairs tested per tick:
- `PlayerShot` vs `Enemy`
- `EnemyShot` vs `Player` (skip if `invincibleTimer > 0`), vs `ForcePod` (absorb, no damage)
- `Enemy` vs `Player` (both take 1; an invincible player takes none but still damages the enemy), vs `ForcePod` (enemy takes 3, Force takes 0)
- `Player` vs `Pickup` (apply effect, destroy pickup)
- `PlayerShot` vs `EnemyShot`: cancel each other (a piercing beam survives, the enemy shot dies)
- `PlayerShot` vs `Enemy`: a piercing shot survives only if it killed the enemy; two shots in the same tick both count until the enemy dies
- Player pickups: implemented (§8): `PlayerCollectsPickup` applies the effect and destroys the pickup; a dead ship and the Force do not collect

Resolution = damage + destroy, no bounce. Linear scan O(n²) capped at ~200 entities is fine (~40k checks/tick).

## 7. Score / lives / win / lose

- Start: `rulesOf(registry).startingLives` lives (5 easy, 3 normal, 2 hard, §12), 0 score, no upgrades.
- Kill scores §5. Charge-beam overkill gives no bonus (keep simple).
- Extra life every 10,000 pts (max 5 stock) is **planned, not implemented**: score is kept but never grants a life in v1.
- Death: `lives--`, `alive=false`, `respawnTimer=2.0s`. Respawn at `x=60, y=270+offset` with the difficulty's invincibility (3 s easy, 2 s normal, 1.5 s hard, §12) and blinking. Upgrades partially lost (§3).
- Game over (per player): `lives < 0` → spectate. Room ends in defeat when ALL players game-over AND no respawn pending.
- Victory (DONE): the last level of the campaign is cleared (boss dead, nothing left) → `VICTORY`, freeze scroll, game-over screen. A single-level room wins when its level is cleared.
- Disconnect (B handles): ship removed, Force drifts 5s then removed, score kept for session.

## 8. Pickups

Implemented in `game/pickups.hpp`: `spawnPickup`, `rollDrop`, `applyPickup`. A pickup is an entity with `Pickup{kind}`, `Team::Pickup`, `EntityType::PickupEnt`, a 16x16 collider (layer 16) and a velocity of `-kScrollSpeed`: it drifts left with the level and the cull system removes it when it leaves the arena. A ship collects it by touching it (the collision rule `PlayerCollectsPickup`); a dead ship and the Force do not. If two ships touch it in the same tick, only the first gets it.

**Drops** (when an enemy is killed, at the place where it died):

- `Carrier`: always, alternating Power and Speed.
- `Bink`, `Patapata`: 8% (`kRandomDropChance`), kind chosen at random.
- `Turret` and the boss: never.

The random choice is a deterministic sequence kept in the registry (`DropState`), so a room replays the same drops from the same start.

**Kinds in the game today**

| Kind | Effect | Cap |
|---|---|---|
| `Power` | weapon level +1: 1 shot, then 2 parallel shots (`+/- 7` on Y), then a 3-way spread (the straight shot and two at `+/- 90` u/s on Y) | level 2 |
| `Speed` | ship speed +1 level (220 / 260 / 300 u/s) | level 3 |

A ship already at the cap gets `kPickupBonusScore` (300) points instead; the pickup is still consumed. The charged beam does not depend on the weapon level.

**On death** a ship loses one weapon level and one speed level (never below 0) and keeps its score (§3). An invincible ship loses nothing.

**Network**: a pickup is replicated like any entity (`EntityType::PickupEnt`); its snapshot `extra` is the kind (0 = Power, 1 = Speed), so the client can draw two different sprites.

**Later**, with the weapons they unlock: `MissileM` (enables missiles, lost on death), `ForceItem` (grants the Force, +500 pts if already owned) and the Force power for `Power` (§4). The magnet (a pickup within 40u of a ship drifts toward it) is not done.

## 9. Systems roadmap (for A + C sync)

- J3 `movement` (DONE): `stepMovement` = input -> pattern -> integration -> clamp players -> cull (entities outside the arena by > 64u AND moving outward).
- J4 `collision + damage` (DONE): `collisionSystem` = detect + apply (hp--, kill score credited to `ownerId`, player death: lives--, alive=false, respawnTimer 2s, `Explosion` with Lifetime 0.4s), `lifetimeSystem`.
- J5 `shoot` (DONE): `shootSystem` = tap `fire` spawns one `PlayerBullet` at the nose of the ship (`12x4`, 500 u/s, damage 1, cooldown 0.15s, no auto-fire). Holding `fire` charges the `Weapon` (cap 2s); releasing after >= 0.4s spawns a piercing `ChargedBeam` (`40x12`, 600 u/s, damage `1 + charge*3`, so 2 to 7). A dead ship loses its charge. Shots carry `ownerId = playerId`.
- J5 `respawn` (DONE): `playerTimersSystem` counts the invincibility down, revives a dead ship after `respawnTimer` (full hp, spawn position, difficulty-dependent invincibility, §12) while `lives >= 0`, and keeps it dead otherwise. `allPlayersGameOver` is true when every player is dead with `lives < 0`. `spawnPlayer(registry, id)` builds a complete ship, `playerSpawnPosition(id)` gives its spawn point (y = 198, 246, 294, 342).
- Room loop (DONE): the server only calls `stepGame(registry, dt)` (dt = 1/60), which runs `playerTimersSystem` -> `wavesSystem` -> `enemyFireSystem` -> `bossSystem` -> `shootSystem` -> `stepMovement` -> `collisionSystem` -> `lifetimeSystem`.
- Pickups (DONE, `game/pickups.hpp`): see §8. Not done yet: missiles, Force guns and their pickups.
- S2 `waves` (DONE, in code): `spawnEnemy(registry, type, x, y, playerCount)` builds a Bydos with the §5 stats (Bink: Chase 140, Patapata: Sine amp 60 / 2 Hz / 120, Turret: Static, 3 hp, Carrier: Straight 80). HP scale with the players of the room (`scaledEnemyHp`, x1.25 per extra player, rounded up). A level is a list of `SpawnEvent{time, type, y}` (`addGroup` builds a line of N enemies; `level1()` is 70 s, `level2()` 80 s, §13), loaded with `loadLevel` into a `LevelRun` entity; `wavesSystem` spawns what is due at `x = 960 + 32`, just outside the arena. `isLevelCleared` is true when everything spawned and no enemy is left.
- S2 `enemy fire` (DONE): `enemyFireSystem`: an enemy with `fireCooldown > 0` (only the Turret, every 2 s) shoots an `EnemyBullet` (8x8, 200 u/s, damage 1, 4 s) aimed at the closest alive player (`nearestAlivePlayer`, shared with the Bink chase). It waits while off screen or while nobody is alive.
- S4 `boss` (DONE, simplified): `EnemyType::Boss`, `BossState{phase, arrived, t, fireTimer}`, `bossSystem`. Hp `120 + 20 per extra player` (`bossHp`), `96x96`, score 5000, last event of `level1()` (t = 70 s). It scrolls in at 80 u/s, stops at `x = 780` (it does not shoot before), then hovers on a slow drift (`40` units on X at 0.15 Hz, `120` on Y at 0.2 Hz) driven by its velocity, so it never drifts away. Phase 1: one aimed shot every 1.5 s. Phase 2 (hp <= half, never reverts): hover 1.5x faster, 3-way spread (aimed, +/- 0.35 rad) every 1.2 s. Differences with the table in §5: the drift is on both axes and there is no tail attack yet.
- Room end (DONE): `roomState(registry)` returns `Victory` when the campaign is cleared (last level cleared, `isCampaignCleared`), `Defeat` when every player is game over (it wins over Victory), else `Playing`. The server stops the room on anything but `Playing`.
- Not done yet: loading a timeline from a file (the YAML in the roadmap), the boss tail attack, a stats screen.

## 10. Network mapping

The wire format is owned by `docs/documentation_du_projet/rfc-protocol.md` (v1, implemented). In short:
per entity per snapshot, `netId(2B) + type(1B) + team(1B) + x,y(8B) + hp(1B) +
extra(1B) + flags(2B)` = 16 B (RFC §7.1), plus a 55 B fixed part that carries
the tick, the input ack and the HUD of every player. Input goes client → server
as `inputSeq(4B) + mask(1B) + prevMask(1B) + ackEvent(2B) + lastServerTick(4B)`
at 60 Hz. Bandwidth and the S4 optimisations are in RFC §11.

### 10.1 Snapshot extractor (DONE, `game/snapshot.hpp`)

`collectSnapshot(registry, maxEntities = 71)` is the only call the room needs to build a snapshot. It returns a `Snapshot { state, entities, players, stage }` that does not depend on the network library: the network layer copies the fields into its `EntityRecord` (docs/documentation_du_projet/rfc-protocol.md §7.1) and HUD rows.

- **`netId`**: `assignNetIds` gives every entity with an `EntityType` a `NetId` from a counter (1..65535, wraps, skips 0 and the ids in use). A ship keeps its id across deaths and respawns; an id is reused only after the counter wraps (RFC §7.2).
- **Entities**: every entity with `Position` + `EntityType`, sorted by `netId`. A dead ship is not listed (the client shows it again when it respawns). `team` = `Team` (Neutral if none), `hp` = `Health::hp` clamped to 0..255 (0 without `Health`).
- **`extra`** (RFC §7.1): `Ship` = lives, `Force` = `ForcePod::power`, `Boss` = phase (1 or 2), `PickupEnt` = kind (0 Power, 1 Speed), `EnemyBullet` = visual variant (`BulletVisual`: 0 ordinary enemy shot, 1 Dobkeratops, 2 Gomander, 3 Warship, 4 Compiler), anything else 0. The behaviour is the same for every bullet (damage > 0, `EnemyShot`); only the sprite changes. The boss bar needs the max hp, which the wire does not carry: the client keeps the first `hp` it sees for the boss.
- **Players**: one `SnapshotPlayer` per player (not only the receiver): `lives` (0 when out), `score`, `alive`, `speedLevel`, `forcePower`, `gameOver` (dead with no life left), `hasMissile`, `hasForce`. The wire carries every score; the v1 client still displays only its own (it ignores `hud[]`, see `client/README.md` §7).
- **`state`** is the `RoomState` of `roomState()`: 0 playing, 1 victory, 2 defeat.
- **Size**: 8 B header + 55 B fixed part (includes the 4 HUD rows) + 16 B per entity must stay under 1200 B, so at most **71 entities** (`net::kMaxSnapshotEntities`; a test keeps the two constants equal). Over the cap, the least important are dropped: ships, boss, Force, enemies and enemy bullets first, then pickups, player shots, explosions last.
- **`diffSnapshots(previous, current)`** gives the spawned entities and the destroyed netIds, to send the reliable SPAWN / DESTROY events of the RFC (the destroy reason is not known to the game layer).

## 11. Decisions taken for J2 (was: open questions)

1. ECS API: answered by A (`Registry::getComponent<T>(e)`, `SparseArray` of `optional`). No views / system runner yet: `game/ecs_helpers.hpp::forEach` is a temporary stand-in.
2. Fixed point vs float in protocol: float for J1-J2; quantization is S4 only (RFC §11).
3. Graphic lib: SFML (client, D). `EntityType` → sprite table lives in the client.
4. `Parent`: still a planned component; the Force attach will need a hierarchy or a raw `uint32_t` parent. Not used in v1.

## 12. Difficulty (rules of a room)

A room has one difficulty. It scales numbers, never code, and it is the accessibility option of the gameplay (an easier game for motor or cognitive needs, see `docs/documentation_du_projet/accessibility.md`).

`game/rules.hpp`: `Difficulty { Easy, Normal, Hard }`, `Rules`, `rulesFor(difficulty)`, `setRules(registry, rules)`, `rulesOf(registry)`, `parseDifficulty("easy"|"normal"|"hard")`, `difficultyName`. A room that never calls `setRules` plays `Normal`, which is the base game described in §3 to §8.

| Rule | Easy | Normal | Hard | Used by |
|---|---|---|---|---|
| Enemy and boss hit points | x0.5 | x1 | x1.5 | `spawnEnemy` (rounded up, at least 1; stacks with the player count of §5) |
| Enemy and boss bullet speed | x0.75 | x1 | x1.25 | `enemyFireSystem`, `bossSystem` |
| Time between two enemy shots | x1.5 | x1 | x0.75 | `spawnEnemy` (Turret), `bossSystem` |
| Lives at the start | 5 | 3 | 2 | `spawnPlayer` |
| Invincibility after a respawn | 3 s | 2 s | 1.5 s | `playerTimersSystem` |

The rules are read when an entity is created (`spawnPlayer`, `spawnEnemy`), so `setRules` must be called once after `registerGameComponents` and before the first player or enemy. Implemented: the solo client picks the difficulty in its Settings menu; the server picks it with `--difficulty easy|normal|hard` (default `normal`), and a room keeps it for its lifetime. The protocol does not carry the difficulty yet (`CREATE_ROOM` only has a name), so an online player cannot choose it.

## 13. Levels and the campaign

`game/level.hpp`. Two levels, played one after the other:

| | Level 1, "Bydo outpost" | Level 2, "The cavern" |
|---|---|---|
| Length | 70 s (boss at 70 s) | 80 s (boss at 80 s) |
| Feel | open space, a few turrets | turrets as walls at the top and the bottom, two lines of Patapata, swarms of Bink |
| Pace | calm start, then groups | busier from the first seconds, 4 turrets at once near the end |
| Boss | the boss (§5) | the same boss, after a longer fight |

`levelCount()`, `levelEvents(index)`, `levelName(index)` list them; a level is a list of `SpawnEvent` (§9). On a snapshot, a typical run needs about 30 entities, well under the 71 that fit in a datagram.

**Campaign (implemented).** `startCampaign(registry)` loads level 1 and creates a `Campaign{current, count, clearing, transition}` on one entity. `campaignSystem` (run by `stepGame`, before the waves) watches the level: when it is cleared and another one follows, it waits `kStageClearDelay` (4 s), then loads the next level. The players keep their score, lives and upgrades; nothing else is reset. `roomState` is `Victory` only when the **last** level is cleared (`isCampaignCleared`). A room that never calls `startCampaign` and only `loadLevel` plays a single level.

Both the server room (`server/src/room.cpp`) and the solo client (`client/src/network/LocalServer.cpp`) call `startCampaign`, so a solo game and a network room both play the two levels.

**Network.** `Snapshot::stage` is the level being played (from 1). It is on the wire in bits 4-7 of the `flags` byte of the `self` block (bit 0 game over, bit 1 missile, bit 2 Force), so the format did not change (RFC §7). `net::snapshotStage(self)` decodes it; the client can then change its background and music at each stage.

**To play the campaign** the room calls `startCampaign(registry)` instead of `loadLevel(registry, level1())`; it does: `Room::join` calls it when the first player joins a new or reset room, and `LocalServer::startGame` calls it for the solo game.


## 14. Endless mode

`game/endless.hpp`. A room is played in one of two modes, set with `Rules::mode` (`GameMode::Campaign` or `GameMode::Endless`): `r-type_server --mode campaign|endless`, or the **Mode** line of the settings for a solo game. The default is the campaign (§13).

In endless mode the waves never stop and get harder; there is **no victory**, the game only ends when every player is out (the defeat of §7), so the goal is a high score.

| | Campaign | Endless |
|---|---|---|
| What is played | level 1, level 2 | wave 0, 1, 2, ... without end |
| End | victory when the boss of the last level is dead | defeat only (every player out) |
| Pause between two parts | 4 s | 3 s (`kEndlessWaveDelay`) |
| Hit points | base value (times the difficulty, §12) | base value times `endlessHpScale(wave)`: +10 % per wave, at most x4 |
| Boss | at the end of each level | every fifth wave (waves 4, 9, 14...) |

`endlessWave(wave)` builds the `SpawnEvent` list of a wave with a formula (no random number: a room always plays the same waves): a group of Bink, a line of Patapata, at least one Carrier (it drops a bonus), a second group of Bink, and Turrets from the third wave. The groups grow with the wave (never more than `kEndlessMaxGroup` = 12 in a line) and the enemies come closer together, down to 0.25 s. The same systems as the campaign play it: `startCampaign` loads wave 0 in endless mode, and `campaignSystem` loads the next one when the wave is cleared; `Campaign::current` is the wave number and `Snapshot::stage` is `current + 1`.
`wavesSystem` multiplies the hit points of the enemies it spawns by `endlessHpScale`, boss included. `isCampaignCleared` is always false in endless mode, so `roomState` never answers `Victory`.

---
Next: game events for sounds that the client cannot guess from a snapshot; then missiles, the Force, a stats screen and levels from data files.
