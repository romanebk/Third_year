# R-Type Network Protocol RFC — v1

Owner: Momo (role B) · Status: **frozen, implemented and tested** · Last update: 21/10

This is the wire format for every message exchanged by `r-type_server`,
`r-type_lobby` and `r-type_client`. It is implemented by `network/` and covered
by the unit tests of `network/tests/` and `server/tests/`; wire changes bump
`net::kVersion` (§10).

Normative keywords: MUST, MUST NOT, SHOULD, MAY (RFC 2119).

---

## 1. Scope

- **Lobby over TCP**: login, room list, create/join, chat, start → room address.
- **Game over UDP**: one room = one process = one UDP socket, up to 4 players.
- **Authoritative room server**: the client sends only `Input` and renders
  replicated state (see `docs/documentation_du_projet/game-design.md` §1, §10). No gameplay value ever
  flows client → server except input.

Out of scope for v1 (noted as S3/S4 below): client-side prediction tuning,
bandwidth reduction, quantization.

## 2. Encoding conventions

- All multi-byte integers are **little-endian** (x86/x64 native, memcpy-free
  on receive: decode field by field).
- Floats are IEEE-754 `float` (4 bytes). S4 may quantize positions; the
  change is a version bump (§10).
- Strings: `u8 length` + UTF-8 bytes, **no null terminator**, length excludes
  itself. Max 16 bytes in game messages, 32 bytes in lobby messages, 128 bytes
  for chat.
- Encoders MUST check the destination buffer size; decoders MUST bounds-check
  every field and **drop the packet** (no throw, no UB) on truncation. A
  malformed packet is counted, never fatal.
- No C++ struct is sent as-is: components are POD (see `game/components.hpp`)
  but the wire layout below is explicit and packed, independent of compiler
  padding.
- Maximum UDP datagram size: **1200 bytes** (safe under a 1500-byte MTU with
  UDP+IP overhead). A snapshot that does not fit is reduced by the extractor
  (§7.1); splitting a snapshot over several datagrams is not implemented.

## 3. Transports and ports

| Transport | Endpoint | Purpose |
|---|---|---|
| TCP | port **4242** (default, configurable) | lobby: login, rooms, chat |
| UDP | port **4300**, 4301, ... (one per room process) | in-game packets |

The room's exact `ip:port` is meant to come from the lobby (`ROOM_START`, §8).
In v1 the client still connects directly to the room, without the lobby: run
`r-type_server --port 4300` and `r-type_client --host 127.0.0.1 --port 4300`
(the server keeps the default `--room-instance 1`, which is the value the
client always sends). The lobby is implemented and tested server-side, but the
client does not speak TCP to it yet (§8).

## 4. UDP packet header (8 bytes)

```
 0        1        2        3        4              8
+--------+--------+--------+--------+--------------+------------------+
| 0x52   | 0x54   | ver=1  |  type  |   packetSeq  | payload ...      |
+--------+--------+--------+--------+--------------+------------------+
  'R'      'T'                u8       u32 LE
```

| Offset | Size | Field | Notes |
|---|---|---|---|
| 0 | 2 | magic | `0x52 0x54` ("RT"), reject otherwise |
| 2 | 1 | version | `1` for this RFC; other values → drop |
| 3 | 1 | type | message type, §6 (client→server) / §7 (server→client) |
| 4 | 4 | packetSeq | per-sender counter, +1 per datagram, wraps at 2^32 |

`packetSeq` measures reordering and loss for statistics; **ordering decisions
use `inputSeq` / `serverTick` / `eventSeq`**, not `packetSeq`.

Each direction has its own sequence space. A room instance number (u32,
`--room-instance`, default `1`) is added to `ACCEPT` and echoed by the client in
`CONNECT` so a packet from a previous room instance on the same port is
rejected (port reuse after a crash). The lobby and the room must use the same
instance; the v1 client always sends `1`.

## 5. Reliable events: eventSeq + cumulative ack

Snapshots and inputs are unreliable. **Spawn, destroy and game-end are
reliable**: they ride the same UDP header but carry a `u16 eventSeq` at the
start of the payload.

- Server keeps, per client, an unacked-event buffer (max 32 events). Event
  numbers are **per room**, not per client: a client that joins in the middle of
  a game starts at whatever number the room has reached, and its own queue only
  ever holds events created after it joined.
- Client (resp. server for CONNECT) acks **cumulatively**: the highest
  `eventSeq` it has processed. `ReliableReceiver` acks the highest *contiguous*
  one; the v1 client acks the highest one it has seen (it does not reorder
  events). The ack is piggybacked (§6/§7) — no extra packet.
- Retransmit every 500 ms, max 10 attempts; on failure the server disconnects
  that client, the client returns to the connection screen.
- Receiver ignores `eventSeq <= lastAckedEvent` (duplicate) and SHOULD apply
  events in order; `ReliableReceiver` buffers out-of-order events (max 16) and
  reports the gap, which the caller clears by resynchronising on the next full
  snapshot. Snapshots are always full state, so no explicit resync message is
  needed (`DESTROY`/`SPAWN` are cosmetic; see §7.2).

This covers J14 ("fiabilité UDP pour les événements importants"). Events are
only created by the server in v1; if the client ever needs reliable delivery,
it can use the same stream (`CONNECT` is retried until `ACCEPT`, `LEAVE` is
sent three times).

**v1 status**: the server emits `SPAWN` and `DESTROY` whenever an entity
enters or leaves the replicated view (snapshot diff), and `GAME_END` when the
game ends, all on the same stream. Snapshots carry the full state, so a
client that ignores these events still heals on the next snapshot (§7.2); a
client that applies them gets exact lifetimes. `net::ReliableQueue` /
`net::ReliableReceiver` implement this section and are tested in
`network/tests/Reliable_test.cpp` and `Degraded_test.cpp`.

The v1 client (`client/src/network/UdpConnection.cpp`) uses a simplified
receiver: it acks the **highest** `eventSeq` it has seen, applies `GAME_END` as
soon as it arrives (the event number only feeds the ack), and does not buffer
out-of-order events — the next full snapshot repairs everything. `ReliableReceiver`
is available for the ordered version and is what an observer of `SPAWN`/`DESTROY`
would use.

## 6. Client → server messages

| Type | Name | Payload | Notes |
|---|---|---|---|
| 0x01 | `CONNECT` | `u32 lobbyToken, u32 roomInstance, u8 nameLen, name[]` | sent every 500 ms until `ACCEPT`; a repeated CONNECT is idempotent |
| 0x02 | `INPUT` | `u32 inputSeq, u8 mask, u8 prevMask, u16 ackEvent, u32 lastServerTick` | see below |
| 0x03 | `PING` | `u32 clientTimeMs, u16 ackEvent` | RTT measurement |
| 0x04 | `LEAVE` | `u8 reason` | best-effort: the client sends it 3 times, then closes |

`INPUT` (J2/J4, 12 bytes payload):

- `inputSeq`: +1 per input, 60 Hz (matches `kTickDt = 1/60`).
- `mask`: bit order of `game::inputMask` (0=up 1=down 2=left 3=right
  4=fire 5=detach) — **reuse the existing helper, do not invent a second one**.
- `prevMask`: the input of the previous frame. The client fills it (it is the
  field the subject asks for), but the **v1 server does not read it**: a lost
  INPUT simply leaves the previous input in place until the next one arrives
  (≤ 16.7 ms), and the input state is idempotent, so redundancy is only needed
  once prediction/reconciliation exists (S3).
- `ackEvent`: cumulative reliable-event ack (§5).
- `lastServerTick`: newest snapshot the client applied — server-side lag
  stat, and later the base for lag compensation (S3).

Server behavior: apply only `inputSeq > lastAppliedInputSeq` per player
(reject duplicates and reordered old packets — J7). The newest applied
`inputSeq` is echoed in the snapshot (`ackInputSeq`) for client prediction
(J13).

## 7. Server → client messages

| Type | Name | Payload | Reliable |
|---|---|---|---|
| 0x80 | `ACCEPT` | `u8 playerId, u8 tickRate, u8 snapshotRate, u32 serverTick, u32 roomInstance` | no (client re-`CONNECT`s) |
| 0x81 | `SNAPSHOT` | `u32 serverTick, u32 ackInputSeq, u16 ackEvent, u8 state, u8 selfLen, self[], u8 playerCount, hud[]×playerCount, u8 count, entity[]×count` | no |
| 0x82 | `SPAWN` | `u16 eventSeq, u32 serverTick, entity[16]` | **yes** |
| 0x83 | `DESTROY` | `u16 eventSeq, u32 serverTick, u16 netId, u8 reason` | **yes** |
| 0x84 | `GAME_END` | `u16 eventSeq, u32 serverTick, u8 result, u8 reasonLen, reason[]` | **yes** |
| 0x85 | `PONG` | `u32 clientTimeMs, u32 serverTimeMs` | no |
| 0x86 | `BYE` | `u8 reason` | no (timeout is the fallback) |

`state` in `SNAPSHOT`: 0 = playing, 1 = victory (scroll frozen), 2 = defeat.
`self[]` is the per-client HUD block, `selfLen` = 9 bytes in v1:

```
u8 lives | i32 score | u8 alive | u8 speedLevel | u8 forcePower | u8 flags
```

`flags` bit 0 = game over (spectator), bit 1 = has missile, bit 2 = has
Force, bit 3 = endless mode (the stage bits then carry a wave number),
bits 4-7 = current campaign stage or endless wave (`1..15`, `0` is never
sent). Stage and mode are global to the room, so they are only in `self[]`,
not in `hud[]`: a client shows "LEVEL n" when bit 3 is clear and "WAVE n"
otherwise. The four stage bits cap the value at `15`: campaign levels always
fit, but an endless wave `16` or later is sent as `15` ("WAVE 15") until a
dedicated field is added; accepted as a v1 limitation. A joining client
receives `ACCEPT`, an immediate full `SNAPSHOT`, then one snapshot per 20 Hz
tick. `serverTick` in `ACCEPT` is written as 0 in v1;
snapshots carry the authoritative tick.

`hud[]` is the HUD of **every** player in the room (at most 4, sorted by
`playerId`), so each client can show the scores of all the players and not
only its own `self[]` block. One row is 8 bytes:

```
u8 playerId | u8 lives | i32 score | u8 alive | u8 flags
```

`flags` uses bits 0-2 of `self[]`. `self[]` stays the local, per-client block;
`hud[]` is identical for everybody.

### 7.1 Entity record (16 bytes, packed)

```
u16 netId | u8 type | u8 team | f32 x | f32 y | u8 hp | u8 extra | u16 flags
```

(`u16 flags`: bit 0 = reserved for the S4 quantized-position variant, the
rest undefined-but-zero in v1.)

| Field | Source | Replicated |
|---|---|---|
| `netId` | server-assigned u16 (§7.2) | — |
| `type` | `game::EntityType` (1 byte) | yes |
| `x`, `y` | `Position.x`, `Position.y`, center of the AABB | yes |
| `team` | `game::Team` (1 byte) | yes |
| `hp` | `Health.hp` clamped ≥ 0 (0 = dying) | yes |
| `extra` | depends on `type`: `Ship` = `Player.lives`, `Force` = `ForcePod.power`, `Boss` = phase (1, then 2), `EnemyBullet` = `BulletVisual` (0 ordinary shot, 1 Dobkeratops, 2 Gomander, 3 Warship, 4 Compiler), `PickupEnt` = `PickupKind` (0 Power, 1 Speed), anything else = 0 | yes |
| `flags` | v1: all zero. S4 sets bit 0 on a quantized-position record | no |

All boss balls stay `EntityType::EnemyBullet` with `Team::EnemyShot` and the
same damage; `extra` only selects their sprite. This reuses the existing free
byte, so there is no new entity type and no protocol version bump.

This refines `docs/documentation_du_projet/game-design.md` §10: its fields sum to 15 B, not the ~12 B
stated there (`x,y` alone are 8 B); we keep `extra` at 1 B as in §2 of that
doc and pad to 16 B with `flags` so records are aligned and extensible.
50 entities → **863 B** snapshot (8 B header + 55 B fixed part + 800 B of
records), under the 1200 B cap.

### 7.2 netId

- `u16`, allocated by the room server, unique among the alive entities of the
  room. The counter wraps at 65535 → 1, skipping 0 and every id currently in
  use; an id is therefore reused only once its entity is gone and the counter
  has wrapped (tested in `game/tests/Snapshot_test.cpp`). If every id is in
  use, the extractor throws `std::runtime_error`; `Room::snapshot()` and
  `Room::collectEvents()` catch it, skip that snapshot and retry on the next
  tick, so the room keeps running. This needs 65 535 live entities at once: a
  level peaks at about 30 and a snapshot carries at most 71.
- Client maps `netId → local entity`. A `SPAWN` for an existing `netId` is
  ignored (duplicate). An entity the client knows nothing about in a
  `SNAPSHOT` is created (missed `SPAWN` = self-healing: snapshots are full
  state, not deltas).

## 8. Lobby TCP frames and messages

TCP is a stream: **every frame is `u16 length` (of type+payload) + `u8 type`
+ payload**, max frame 1024 bytes. Types 0x01-0x7F client→lobby,
0x80-0xFF lobby→client.

| Type | Name | Payload |
|---|---|---|
| 0x01 | `LOGIN` | `u8 nameLen, name[≤16]` |
| 0x02 | `LIST_ROOMS` | — |
| 0x03 | `CREATE_ROOM` | `u8 nameLen, name[≤32]` |
| 0x04 | `JOIN_ROOM` | `u16 roomId` |
| 0x05 | `LEAVE_ROOM` | — |
| 0x06 | `SET_READY` | `u8 ready` |
| 0x07 | `CHAT` | `u8 len, text[≤128]` |
| 0x08 | `START` | — (host only) |
| 0x09 | `PING` | `u32 clientTimeMs` |

| Type | Name | Payload |
|---|---|---|
| 0x80 | `LOGIN_OK` | `u32 clientId` |
| 0x81 | `ROOM_LIST` | `u8 count`, then per room: `u16 roomId, u8 nameLen, name, u8 players, u8 maxPlayers, u8 state` |
| 0x82 | `ROOM_UPDATE` | `u16 roomId, u8 count`, then per player: `u32 clientId, u8 nameLen, name, u8 ready, u8 isHost` (broadcast on every change) |
| 0x83 | `CHAT_MSG` | `u32 fromClientId, u8 fromNameLen, name, u8 len, text` |
| 0x84 | `ROOM_START` | `u8 ipLen, ip[≤15], u16 udpPort, u32 lobbyToken, u32 roomInstance` (J12: "renvoi de l'ip:port de la salle") |
| 0x85 | `ROOM_CLOSED` | `u8 reason` |
| 0x86 | `ERROR` | `u8 code, u8 len, text` |
| 0x87 | `PONG` | `u32 clientTimeMs` |

Flow: `LOGIN → LOGIN_OK` → (`LIST_ROOMS` | `CREATE_ROOM` | `JOIN_ROOM`) →
`ROOM_UPDATE` → `SET_READY` → host `START` → the lobby announces the room
process in `ROOM_START` → every client opens UDP and sends `CONNECT` (§6) →
`ACCEPT` → play. On `GAME_END` or disconnect, the client comes back to the
waiting room (the TCP connection stays open in the design). The host may
`START` the same room again for the next game; the room process resets its
world once it is empty, so both sides keep the same room instance.

v1 simplifications:

- the room process is started next to the lobby with the same
  `--room-instance` and a matching port (`--room-port` in the lobby, `--port`
  in the room); the lobby does not spawn it;
- `lobbyToken` is informational (the room validates `roomInstance` only);
- one room can be started per lobby process at a time; starting another one
  answers `ERROR/ShuttingDown`;
- `START` does not require every player to be ready — the host can start at
  any time, and players who are not in the room yet join later over UDP;
- **the v1 client does not use the lobby**: it connects directly to the UDP
  room and never reads `ROOM_START`. `server/src/lobby_main.cpp` and
  `network/tests/Lobby_test.cpp` exercise the whole TCP flow end to end.

Error codes (v1): 1 = bad name, 2 = room full, 3 = room not found, 4 = not
host, 5 = name taken, 6 = server shutting down.

## 9. Disconnects and timeouts

| Side | Trigger | Action |
|---|---|---|
| Server | no valid UDP from a player for **5 s** | drop the player and kill their ship (`DESTROY` follows, §5; the ship leaves the next snapshot) |
| Server | TCP closed or read error in lobby | remove from room, `ROOM_UPDATE` (v1 has no idle timeout: a client that stops sending but keeps the socket open stays logged in) |
| Server | wrong `roomInstance` | drop silently (anti-stale; `lobbyToken` is informational in v1, §8) |
| Client | no packet from the server for **5 s** | local "Connection lost" message, back to the connection screen (there is no lobby connection in the v1 client) |
| Client | TCP closed | back to the connection screen, close UDP |

Every packet from an unknown endpoint (no `CONNECT` accepted) is dropped
without reply (no amplification).

## 10. Sequencing, stale packets, versioning

- **Snapshot**: apply only if `serverTick > lastAppliedTick`, else drop
  (reordered/duplicated old snapshot — J7). `serverTick` increments at
  60 Hz (`kTickDt`); the server sends a snapshot on its own 20 Hz timer
  (`kSnapshotRate`), independently of the tick loop.
- **Input**: apply only if `inputSeq > lastAppliedInputSeq`.
- **Events**: cumulative ack + in-order apply (§5).
- **version / roomInstance / magic** mismatch: drop silently.
- Wire changes after the freeze **MUST** bump the version byte and this
  document's number; both sides simply drop mismatched versions.

## 11. Bandwidth budget

Per client, worst case (v1, full snapshots, no quantization):

| Direction | Formula | Result |
|---|---|---|
| Up | INPUT (8 hdr + 12 payload + 28 UDP/IP) = 48 B × 60 Hz | **~2.9 KB/s** |
| Down, N=30 | (8 + 55 + 30×16 + 28) = 571 B × 20 Hz | **~11.4 KB/s** |
| Down, N=50 | (8 + 55 + 50×16 + 28) = 891 B × 20 Hz | **~17.8 KB/s** |

(snapshot fixed part = 55 B: serverTick 4 + ackInputSeq 4 + ackEvent 2 +
state 1 + selfLen 1 + self 9 + playerCount 1 + 4 HUD rows × 8 + count 1;
+28 B UDP/IP per packet. With the HUD rows, a full snapshot still fits the
1200 B cap with 71 entity records.)

The annex target is **5 KB/s** (test J17). v1 full snapshots cannot reach
it: read as a total budget, at 20 Hz the whole packet budget is 250 B, of
which 58 B are headers → 192 B → 12 entities as-is (16 after quantizing to
12 B), and the uplink alone already takes ~2.9 KB/s. Read as a per-direction
downlink budget it is ~2.1 KB/s → ~3 entities per full snapshot. The target
is therefore reachable only through the S4 items below
(`feature/net-bandwidth`):

1. Quantize `pos` to `u16` world coordinates (arena 960×540 fits): entity
   record 16 → 12 B. (~−25 %)
2. Send far/scroll-only entities (`Movement::Static` off-screen) at 10 Hz in
   alternate snapshots. (~−30 %)
3. Delta snapshots: keep full state every 20th tick (keyframe), positions-only
   in between (needs `netId`-indexed change tracking).
4. Raise the input rate reduction first: INPUT at 30 Hz with 2-frame
   redundancy keeps latency at 33 ms while halving the uplink.

The formulas above are arithmetic, not measurements: the netem run in §12
checks behaviour under loss and latency, not throughput, and the S4 items are
not implemented.

## 12. Degraded-network test matrix (subject annex)

| Test | Tool | Expectation |
|---|---|---|
| 2 % loss + duplication | `tc qdisc add dev lo root netem loss 2% duplicate 1%` | no crash, gameplay degrades softly: full snapshots self-heal entities, `SPAWN`/`DESTROY` retransmit, a lost INPUT just holds the previous key state until the next one |
| latency > 150 ms | `netem delay 150ms` | no input rejection storm; the ship reacts one RTT later (v1 has no client prediction, S3) |
| bandwidth 5 KB/s | `netem rate 5kbit` (or `tbf`) | graceful: snapshots drop, no queue growth, late packets dropped by the stale rules (§10) |

What exists in CI: unit tests in `network/tests/` (encode/decode round-trip,
truncation, stale rejection, ack/retransmit) and an **in-process degraded link**
(`Degraded_test.cpp`: a deterministic lossy/reordering endpoint, run in CI)
that checks CONNECT retries get through and that reliable events converge.

### 12.1 Measured netem run (v1, 2026-10-27)

Setup: `r-type_server` from `feat/server-multithread` and a headless client in
a Docker container (Ubuntu 24.04, `CAP_NET_ADMIN`), with the loopback qdisc

```
tc qdisc add dev lo root netem loss 2% delay 150ms
```

The qdisc is on `lo`, so the 150 ms delay applies in both directions (~300 ms
RTT). The client sends one CONNECT, INPUT at 60 Hz, acks the reliable events
and records what it receives; the run lasts 20 s.

| Metric | Result |
|---|---|
| CONNECT | 1 attempt, 302 ms |
| SNAPSHOT | 397 received, 19.8/s (99 % of the 400 expected) |
| stale or duplicate snapshots | 0 |
| INPUT | 1200 sent, 60.0/s |
| SPAWN | 27 datagrams, 26 unique -> 1 retransmission |
| DESTROY | 21 datagrams, 17 unique -> 4 retransmissions |
| client timeout | none; LEAVE -> `player 0 disconnected` + `room reset` |
| qdisc counters | 1633 packets, 37 dropped (2.3 %), no backlog at the end |

The test client acks the contiguous event prefix (not the highest sequence
seen). A lost reliable datagram therefore stops the ack at the hole and the server
retransmits it after 500 ms: this run shows 1 SPAWN and 4 DESTROY retransmits,
all delivered. Full snapshots are self-healing: the missing snapshots cost at
most one 50 ms visual update, and the received server ticks never went
backwards.

Complementary run at 20 % loss (10 s, same 150 ms delay): CONNECT needed 3
attempts and 2.3 s, SNAPSHOT fell to 16.2/s (81 % of 200), 3 SPAWN
retransmissions were observed, INPUT stayed at 60/s, no snapshot was stale,
and the LEAVE still produced `player 0 disconnected` + `room reset`.

## 13. Message list summary (the thing we freeze)

Client → server: `CONNECT, INPUT, PING, LEAVE` (4 types).
Server → client: `ACCEPT, SNAPSHOT, SPAWN, DESTROY, GAME_END, PONG, BYE`
(7 types).
Lobby: 9 client→lobby, 8 lobby→client.

Everything not in this list does not exist on the wire: no position from the
client, no chat over UDP, no texture ids (client maps `EntityType` and
`BulletVisual` locally).

## 14. Design decisions frozen in v1

These were open questions in the draft; v1 answers them as follows and the code
implements the answers.

1. **`extra` semantics per `EntityType`**: `Ship` = `Player.lives`, `Force` =
   `ForcePod.power`, `Boss` = phase, `EnemyBullet` = `BulletVisual` (0 ordinary
   shot, 1..4 the boss variants), `PickupEnt` = `PickupKind`, anything else =
   0 (§7.1). No enemy score tier on the wire.
2. **netId width**: `u16`, assigned per room by the game layer; the counter
   wraps and skips the ids in use (tested). If every id is in use (65 535 live
   entities, far beyond the ~30 a level needs), the extractor throws and the
   server stops with an error: this case is not handled.
3. **Input redundancy vs input ack-only**: `prevMask` stays in the INPUT
   (reserved for prediction in S3). The v1 server ignores it and keeps the
   last input when a sequence is missing, which is enough because inputs are
   idempotent state.
4. **Snapshot rate**: 20 Hz fixed for v1, on a dedicated timer; the 10 Hz
   far-entity rule is an S4 optimisation, not implemented.
5. **Socket library**: standalone Asio (header-only, CPM-fetched). It changes
   no wire byte, so the RFC is independent of it.
6. **`Position` quantization**: the wire keeps `f32` until S4
   (`docs/documentation_du_projet/game-design.md` §11); the 71-record cap already fits the 1200 B
   datagram.
