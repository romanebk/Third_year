# R-Type runbook

How to build, start, verify and troubleshoot the game. This is the operational
companion of `README.md` (overview), `docs/documentation_du_projet/rfc-protocol.md` (wire format) and
`client/README.md` (client, in French).

Everything below runs from the repository root.

## 1. Quick reference

| What | Value |
|---|---|
| Game room (UDP) | `r-type_server`, default port **4300** |
| Lobby (TCP) | `r-type_lobby`, default port **4242** |
| Client | `r-type_client`, default server port **4300** |
| Max players per room | **4** |
| Tick / snapshot rate | 60 Hz simulation, 20 snapshots/s |
| Server silence timeout | **5 s** without a valid datagram |
| Client give-up time | **5 s** (CONNECT retries, then "No answer") |
| Room instance | **1** (the client always sends 1) |
| Settings file | `client.cfg` next to where the client is launched |

| Binary | Built at |
|---|---|
| `r-type_server` | `build/<preset>/server/r-type_server` |
| `r-type_lobby` | `build/<preset>/server/r-type_lobby` |
| `r-type_client` | `build/<preset>/client/r-type_client` |

### Launch script

`scripts/rtype.sh` wraps the commands of this runbook (build if needed, server, clients, several players on one PC, or players on other PCs):

| Command | What it does |
|---|---|
| `scripts/rtype.sh solo` | play alone (no server needed) |
| `scripts/rtype.sh local 3` | the server and 3 clients (1 to 4) on this PC, each client with its own settings file |
| `scripts/rtype.sh host` | the server for players on **other PCs**: prints the address and the steps to give them, and opens your own client |
| `scripts/rtype.sh join 192.168.1.10 Alexis` | join the server of another PC |
| `scripts/rtype.sh check 192.168.1.10` | from another PC: test that the server answers (it sends a real `CONNECT`, then leaves) |
| `scripts/rtype.sh firewall` | open the UDP port on this PC (shows `sudo ufw allow 4300/udp` and asks before running it) |
| `scripts/rtype.sh test` | build, then run all the tests |
| `scripts/rtype.sh server` / `client [host] [name]` | only the server / only one client |

Settings are environment variables: `DIFFICULTY=easy|normal|hard`, `PORT=4300`, `PRESET=ci` (or `debug`, `release`), and `DRY_RUN=1` to print the commands without running them. The script builds the game first if the programs are missing, and stops the server when the last client window is closed (or on Ctrl+C). In the waiting room, press **Ready** in every window. Linux and bash only.

## 2. Build

Requirements: CMake 3.20+, a C++20 compiler, Git. SFML 3.0.2, standalone Asio
and GoogleTest are downloaded by CPM at configure time.

```sh
export CPM_SOURCE_CACHE=~/.cache/CPM   # optional, avoids re-downloading
cmake --preset debug                    # or: ci (Release + warnings as errors)
cmake --build --preset debug -j"$(nproc)"
```

Server only, without SFML: add `-DRTYPE_BUILD_CLIENT=OFF` at configure time.

## 3. Addresses and ports

The server and the lobby listen on **all interfaces** (`0.0.0.0`): there is no
bind-address option, so exposure is controlled by the firewall. The client
resolves **IPv4** addresses and hostnames (`localhost` works).

| Scenario | Server command | Client `--host` |
|---|---|---|
| Same machine | `--port 4300` | `127.0.0.1` or `localhost` |
| LAN | `--port 4300` | the server's LAN IPv4, e.g. `192.168.1.10` |
| Internet | `--port 4300` + UDP port-forward | the router's public IP or a DNS name |

Find the LAN address:

```sh
ip -4 -o addr show scope global     # Linux: e.g. wlan0 192.168.1.10/24
ipconfig                            # Windows: "IPv4 Address"
```

Open the firewall on the server machine:

```sh
sudo ufw allow 4300/udp             # game room
sudo ufw allow 4242/tcp             # lobby, only if it is used
# Windows (admin PowerShell):
# New-NetFirewallRule -DisplayName "R-Type UDP" -Direction Inbound -Protocol UDP -LocalPort 4300 -Action Allow
```

Notes:

- `--room-host` (lobby) is **only the address advertised to lobby clients** in
  `ROOM_START`. It defaults to `127.0.0.1`; set it to the address players can
  reach, otherwise they are told to connect to themselves.
- The v1 client does not use the lobby: it connects straight to the UDP room.
- Two clients on the same machine work (each uses its own ephemeral UDP port).
- For several rooms, start one `r-type_server` per port (`4300`, `4301`, ...);
  the client always sends `roomInstance = 1`, so keep `--room-instance 1`.
  A lobby process can start only one room at a time.

## 4. Solo game

Shortcut: `scripts/rtype.sh solo`.

No server, no network:

```sh
build/debug/client/r-type_client
```

Main menu → **Solo game** → **Ready**. The client embeds a local server
(`client/src/network/LocalServer.cpp`) that runs the same campaign at 60 Hz.
Difficulty is chosen in **Settings** (Easy / Normal / Hard).

The window can be resized (drag a border or maximize it); the game keeps its
16:9 shape, centered, with black bars on a wider or taller window. **F11**
switches to fullscreen and back.

## 5. Online game (LAN)

Shortcuts: `scripts/rtype.sh local 3` (3 players on this PC), `scripts/rtype.sh host` on the server PC then `scripts/rtype.sh join <address> <name>` on the others.

Start the room first, then the lobby on the server machine:

```sh
build/debug/server/r-type_server --port 4300 --room-instance 1 --difficulty normal
build/debug/server/r-type_lobby  --port 4242 --room-host 192.168.1.10 --room-port 4300
```

On each player machine:

```sh
build/debug/client/r-type_client --host 192.168.1.10 --port 4300 --name Alexis
```

Then **Connect** → **Ready**. The first player who is Ready starts the campaign
(level 1, then level 2); later players join the running game with a new ship.

Expected output, one line per terminal event:

```
# terminal of r-type_server
r-type_server: room instance 1 difficulty normal, mode campaign, listening on UDP port 4300
player 0 connected from 192.168.1.20:52344      # when a client presses Connect

# terminal of r-type_lobby (optional: the v1 client does not use it)
r-type_lobby: listening on TCP port 4242, room 192.168.1.10:4300
```

## 6. Verify it works

On the server machine:

```sh
ss -lunp | grep 4300        # UDP room is bound
ss -ltnp | grep 4242        # TCP lobby is bound
```

In the game: move with the arrows, fire with Space, the score increases, shots
and explosions play sounds. Kill the boss to finish level 1; the campaign ends
after level 2.

With two players: both ships appear, `P1`/`P2` labels, each client shows its
own score (see limitations). A client that closes the window sends `LEAVE`;
the server logs `player N disconnected`. When the last player leaves, the
server logs `room reset for the next game`.

## 7. Lifecycle and operations

- **Start order**: room, then lobby. The lobby does not check that the room is
  running; it only advertises its address.
- **Stop**: `Ctrl+C` in each terminal. There is no daemon and nothing to clean
  up; clients show "Connection lost" within 5 s.
- **Restart**: run the same commands. The room starts a fresh campaign at
  level 1 with the same difficulty.
- **Next game**: at the end of a game, every client sends `LEAVE`; once the
  room is empty it resets. **Play again** returns to the waiting room, then
  **Ready** starts a new campaign.
- **Logs**: both servers write to stdout/stderr. Keep a copy with:
  `... 2>&1 | tee room.log`.
- **No persistence**: scores, lives and rooms live in memory only. Only client
  settings (`client.cfg`) survive a restart.
- **Mode** is fixed when the room starts (`--mode campaign|endless`): the campaign
  has 2 levels and a victory, endless has waves that never stop and only ends when
  every player is out.
- **Difficulty** is fixed when the room starts (`--difficulty`); it cannot be
  changed from the client.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "No answer from `<host>:4300`" after ~5 s | server not running, wrong IP/port, firewall, or the client targets `127.0.0.1` from another machine | start `r-type_server`, check `--host`/`--port`, open UDP 4300 |
| "Connection lost with `<host>:4300`" | server stopped or crashed; no packet for 5 s; Wi-Fi dropped | check the server terminal, restart the room, reconnect |
| "The room is full (4 players)" | four players already joined | wait for a slot; the 5th client is refused |
| Client stays on the connection screen, no error | CONNECT is being retried; wrong port or one-way UDP | verify the room port; test from the same machine first |
| Client exits with code 84 | invalid `--port`, unknown option | `r-type_client --help` |
| Server prints `usage:` and exits 1 | unknown option, missing value, bad difficulty | use `--difficulty easy|normal|hard` and `--mode campaign|endless` |
| Server exits with a bind error | UDP port already in use | `ss -lunp | grep 4300`, choose another `--port` |
| Lobby prints `cannot listen on TCP port` | TCP port already in use | choose another `--port` |
| Ready does nothing | no room reachable; CONNECT still retrying | see "No answer" above |
| No score for teammates | server sends every HUD row, the v1 client ignores them | known limitation, see §10 |
| Music/background do not change at level 2 | `stage` is not on the wire yet | known limitation, see §10 |
| Cannot change difficulty online | the room fixes it at startup | restart the room with `--difficulty` |

Check what is actually listening:

```sh
ss -lunp | grep -E '4300|4301'
ss -ltnp | grep 4242
```

On a LAN, if the server works locally but not remotely: check the firewall, that
the client uses the LAN address (not `127.0.0.1`), and that the access point
does not isolate clients.

## 9. Tests and CI

From a fresh clone, one command line builds everything (Release, warnings as errors, as in CI) and runs all the tests:

```sh
cd "$(git rev-parse --show-toplevel)" && cmake --preset ci && cmake --build --preset ci -j && ctest --preset ci --output-on-failure
```

It works from any folder of the clone: its first part goes back to the repository root (the folder that contains `CMakePresets.json`).
Expected: `100% tests passed, 0 tests failed out of 486` (engine 65, network 88, game 244, server 45, client 37, pong 7). The
first build downloads the libraries (a few minutes; set `CPM_SOURCE_CACHE` to reuse them). Other ways to run them:

```sh
ctest --preset debug                                  # all tests (486, 37 client)
ctest --preset ci                                     # Release + -Werror
./build/debug/game/tests/game_tests                   # one suite
./build/debug/network/tests/network_tests --gtest_filter='Reliable*'
```

Suites: `build/<preset>/{engine,network,game,server,client}/tests/*_tests`.

Formatting, as in CI:

```sh
files=$(git ls-files '*.cpp' '*.hpp' '*.h')
clang-format-18 --dry-run --Werror $files
```

The CI runs the format check, a Release build with warnings as errors, then
`ctest --preset ci`.

## 10. Known limitations

- **Lobby not used by the client**: TCP lobby, rooms, chat and `ROOM_START` are
  implemented and tested server-side, but the client connects directly to UDP.
- **Room instance is fixed client-side**: it always sends `1`; start the room
  with `--room-instance 1`.
- **All scores not displayed**: the server sends the HUD of all players, the
  client only keeps its own block.
- **Stage not on the wire**: no per-level background or music change.
- **No Force, missiles, auto-fire, gamepad**: designed/planned, not playable.
- **No persistence, authentication or encryption**: LAN/trusted networks only.
- **Single-threaded room**: `r-type_server` reads the socket (waiting at most
  1 ms), runs the 60 Hz simulation and sends the 20 Hz snapshots in one loop,
  with no thread. A slow or silent client cannot block it (a client silent for
  5 s is dropped), but the subject asks for a multithreaded server: a network
  thread and a game thread are planned, not done.

## 11. Degraded-network checks (optional)

On Linux, with both ends on the same machine (root required):

```sh
sudo tc qdisc add dev lo root netem loss 2% duplicate 1%
sudo tc qdisc change dev lo root netem delay 150ms
sudo tc qdisc del dev lo root        # always remove it afterwards
```

Expected: no crash; lost snapshots are replaced by the next full snapshot;
reliable events retransmit; a lost INPUT keeps the previous key state.
There is no scripted netem harness: this matrix is run by hand.
