# R-Type

Networked remake of the 1987 arcade shoot'em up: authoritative server, client, custom ECS game engine, up to 4 players, a two-level campaign and a solo mode.

## Authors

Epitech Afrique project (R-Type), team of four.

| Role | Author | GitHub | Directory |
|---|---|---|---|
| A. Engine (ECS, plugins, scenes, build/CI) | Moïse Govoechan | [@MosesGsj3](https://github.com/MosesGsj3) | `engine/` |
| B. Network + lobby | Mohamed Adnan Alassane ("Momo") | [@mhdadn04](https://github.com/mhdadn04) | `network/`, `server/` |
| C. Gameplay | Ariel Boko | [@arielboko](https://github.com/arielboko) | `game/` |
| D. Client | Alexis Assogba | [@Prototypesix](https://github.com/Prototypesix) | `client/` |

## License

MIT, see [`LICENSE`](LICENSE). The sprite sheets in `sprites/` come from the project subject, and the menu and game
background pictures were generated with an AI tool for this school project.

## Build

Requirements: CMake 3.20+, a C++20 compiler (GCC, Clang or MSVC), Git. Supported platforms: Linux and Windows.

Third-party libraries are fetched at configure time by [CPM](https://github.com/cpm-cmake/CPM.cmake) (`cmake/Dependencies.cmake`): nothing to install system-wide. Set `CPM_SOURCE_CACHE` (e.g. `~/.cache/CPM`) to avoid re-downloading them for every build directory.

```
cmake --preset debug          # or: release, ci
cmake --build --preset debug
ctest --preset debug
```

Binaries: `build/<preset>/server/r-type_server`, `build/<preset>/server/r-type_lobby`, `build/<preset>/client/r-type_client`.

Options: `RTYPE_BUILD_TESTS` (ON), `RTYPE_WARNINGS_AS_ERRORS` (OFF, ON in the `ci` preset), `RTYPE_BUILD_CLIENT` (ON, set OFF for a server-only build without SFML), `RTYPE_BUILD_EXAMPLES` (ON), `ENGINE_WITH_SFML` / `ENGINE_WITH_ASIO` (ON, see [Engine](#engine)).

Code style: `.clang-format` is enforced by CI; `.clang-tidy` is available for local checks.

### Test

From a fresh clone, one command line builds everything (Release with warnings as errors, like the CI) and runs all the tests:

```
cd "$(git rev-parse --show-toplevel)" && cmake --preset ci && cmake --build --preset ci -j && ctest --preset ci --output-on-failure
```

It works from any folder of the clone: its first part goes back to the root of the repository (the folder that contains `CMakePresets.json`), where the presets are.
Expected result: `100% tests passed, 0 tests failed out of 486` (engine 65, network 88, game 244, server 45, client 37, pong 7). A first build downloads the libraries and takes a few minutes; set `CPM_SOURCE_CACHE` to reuse them.
One suite only: `./build/ci/game/tests/game_tests` (or `engine`, `network`, `server`, `client` in the same way), with `--gtest_filter='Reliable*'` to select tests.

## Run

### Launch script

`scripts/rtype.sh` starts the game for you, alone, with several players on one PC, or with players on other PCs:

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

```
scripts/rtype.sh local 3                  # server + 3 players on this PC
DIFFICULTY=easy scripts/rtype.sh host     # a server for the other PCs of the network
scripts/rtype.sh join 192.168.1.10 Alexis # from another PC
```

The commands behind the script are described below.

### Solo

`r-type_client` runs the whole game by itself: the client embeds a local server
(`client/src/network/LocalServer.cpp`) that ticks the same `game/` code at
60 Hz. Choose **Solo game** in the main menu, pick a difficulty and a mode (campaign or endless) in **Settings**,
then **Ready**.

```
build/debug/client/r-type_client
```

The window can be resized and **F11** toggles fullscreen; the game keeps its
16:9 shape whatever the size of the window.

### Online

Two server processes are used: `r-type_lobby` keeps the TCP lobby (login,
rooms, chat) and `r-type_server` runs one authoritative game room over UDP.

```
build/debug/server/r-type_lobby --port 4242 --room-host <public-ip> --room-port 4300
build/debug/server/r-type_server --port 4300 --room-instance 1 --difficulty normal
build/debug/client/r-type_client --host <server-ip> --port 4300
```

For now the client connects straight to the UDP room (not through the lobby):
run it with `--host`, then **Connect** and **Ready**. The lobby is implemented
and tested server-side (`network/tests/Lobby_test.cpp`) but the client does not
speak TCP to it yet.

| Binary | Option | Default | Meaning |
|---|---|---|---|
| `r-type_server` | `--port <udp-port>` | `4300` | UDP port of the room |
| | `--room-instance <n>` | `1` | room identity, must match the client (`1`) and the lobby |
| | `--difficulty easy\|normal\|hard` | `normal` | rules of the room (lives, enemy hp, bullet speed, fire rate) |
| | `--mode campaign\|endless` | `campaign` | campaign (2 levels, then the victory) or endless (waves that never stop and get harder, no victory) |
| `r-type_lobby` | `--port <tcp-port>` | `4242` | TCP port of the lobby |
| | `--room-host <ip>` | `127.0.0.1` | address sent to clients in `ROOM_START` |
| | `--room-port <udp-port>` | `4300` | UDP port of the room it announces |
| | `--room-instance <n>` | `1` | must match `r-type_server` |
| `r-type_client` | `--host <address>` | — | server address; opens the connection screen |
| | `--port <udp-port>` | `4300` | UDP port of `r-type_server` |
| | `--name <name>` | `Player` | player name (16 characters max) |
| | `--config <file>` | `client.cfg` | settings file (name, last host/port, keys, volumes, difficulty) |

`--room-host` is the address clients must reach for the UDP room (set it for a
LAN game). Start the server and the lobby with the same `--room-instance`; the
host can start the same room again for the next game without restarting them,
and the room resets its world once every player has left. A game is the full
campaign: level 1 "Bydo outpost", then level 2 "The cavern". Controls, menus and
the list of sprites and sounds are described in `client/README.md` (French).
Step-by-step operations, addresses and troubleshooting are in
[`docs/documentation_du_projet/runbook.md`](docs/documentation_du_projet/runbook.md).

## Engine

`engine/` knows nothing about R-Type: it can build any 2D game. R-Type (`game/`,
`server/`, `client/`) is one game made with it, Pong (`examples/pong`) is another.

| Part | Headers | What it gives |
|---|---|---|
| ECS | `engine/ecs/` | `Entity`, `SparseArray`, `Registry`, `View` (`registry.view<A, B>()`), `Scheduler` (systems run in order) |
| Core | `engine/core/` | `EventBus` (typed publish/subscribe), `FixedStep` and `Stopwatch` (clock), `Logger` |
| Subsystems | `engine/subsystems/` | `IGraphics`, `IAudio`, `INetwork` interfaces, plus `NullGraphics` / `NullAudio` for headless runs and tests |

The core library `engine` has no third-party dependency. Libraries only appear in
optional modules, each implementing the interfaces, that a game links if it needs them:

| Module | Implements | Uses | Turn off with |
|---|---|---|---|
| `engine_sfml` | `IGraphics`, `IAudio` | SFML 3 | `-DENGINE_WITH_SFML=OFF` |
| `engine_asio` | `INetwork` (non-blocking UDP) | Asio | `-DENGINE_WITH_ASIO=OFF` |

The modules hide their library behind a Pimpl: their headers include no SFML or
Asio header, so another implementation can replace them without changing the game.

### Example: Pong

A second game built only with the engine (no R-Type code), to show that it is generic:

```
build/ci/examples/pong/pong                 # W/S and Up/Down, Escape to quit
build/ci/examples/pong/pong --headless 600  # no window: plays 600 steps, prints the score
```

It uses the same building blocks as R-Type: its rules are systems in a `Scheduler`,
goals go through the `EventBus`, it runs at a fixed 60 Hz step and draws through
`IGraphics`. Build it with `RTYPE_BUILD_EXAMPLES` (ON by default).

## Planning

4 weeks, 20 working days, with an integration demo every Friday (`dev` merged into `main`, tagged `v0.1` to `v1.0`):

| Week | Goal |
|---|---|
| 1 | Foundations: repo, ECS v0.1, UDP echo, packet format, first systems, window and sprites |
| 2 | Online vertical slice: 1 to 4 players against enemies |
| 3 | Lobby, rooms, the Force, client prediction, level 1 |
| 4 | Boss, polish, degraded-network tests, docs, release |

Day-by-day details are in `docs/fiche_technique/rtype_planning_4_semaines.pdf`, the role split in `docs/fiche_technique/rtype_repartition.pdf`.

## Git workflow

- `main`: stable, protected, receives `dev` on Fridays (tagged).
- `dev`: integration branch, PR only, at least 1 review, CI green.
- `feature/<role>-<topic>`, `fix/<topic>`, `docs/<topic>` branched from `dev`.
- Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `build:` (English).
- Pull requests target `dev` (never `main` directly), are merged with a merge commit (so the history of each contributor is kept), and need one review from another team member.
- Each morning: `git pull --rebase origin dev` on your branch. Each evening: push your branch.

See `docs/` for the architecture and the protocol RFC.
