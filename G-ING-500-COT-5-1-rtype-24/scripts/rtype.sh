#!/usr/bin/env bash
# Launch R-Type without typing the long commands: build, test, solo game, local
# multiplayer on one PC, or a server for players on other PCs (Linux, bash).
# Run `scripts/rtype.sh help` for the list of commands.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRESET="${PRESET:-ci}"          # CMake preset: ci (Release), debug or release
PORT="${PORT:-4300}"            # UDP port of the room
DIFFICULTY="${DIFFICULTY:-normal}"
MODE="${MODE:-campaign}"        # campaign or endless (waves that never stop)
BUILD_DIR="$ROOT/build/$PRESET"
SERVER="$BUILD_DIR/server/r-type_server"
CLIENT="$BUILD_DIR/client/r-type_client"
DRY_RUN="${DRY_RUN:-0}"         # 1: print the commands instead of running them
PIDS=()

usage() {
    cat <<EOF
Usage: scripts/rtype.sh <command> [arguments]

  build                    configure and build (preset: $PRESET)
  test                     build, then run all the tests
  solo                     play alone (no server needed)
  server                   run only the server (port $PORT, difficulty $DIFFICULTY, mode $MODE)
  client [host] [name]     run one client (default host 127.0.0.1)
  local [N]                server + N clients (default 2, max 4) on this PC
  host                     server for players on OTHER PCs; prints the steps to give them
  join <host> [name]       join the server of another PC
  check <host>             test that the server of another PC answers (before joining)
  firewall                 open the UDP port on this PC (asks before using sudo)

Settings (environment variables): PRESET=$PRESET  PORT=$PORT  DIFFICULTY=$DIFFICULTY  MODE=$MODE  DRY_RUN=0
Examples:
  scripts/rtype.sh local 3
  DIFFICULTY=easy scripts/rtype.sh host           # on the PC that hosts the game
  MODE=endless scripts/rtype.sh local 2           # waves that never stop
  scripts/rtype.sh check 192.168.1.10             # on another PC: can it reach the host?
  scripts/rtype.sh join 192.168.1.10 Alexis       # on another PC: play

In the waiting room, press Ready in every window: a player enters the game as
soon as the server accepts it.
EOF
}

# Runs a command, or only prints it when DRY_RUN=1.
run() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "[dry-run] $*"
    else
        "$@"
    fi
}

# Starts a command in the background and remembers it, to stop it at the end.
background() {
    if [ "$DRY_RUN" = "1" ]; then
        echo "[dry-run] (background) $*"
    else
        "$@" &
        PIDS+=("$!")
    fi
}

cleanup() {
    local pid
    for pid in "${PIDS[@]:-}"; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    done
}
trap cleanup EXIT INT TERM

build() {
    echo "== build (preset $PRESET)"
    run cmake --preset "$PRESET"
    run cmake --build --preset "$PRESET" -j
}

# Builds only when the program is missing.
need_binary() {
    if [ "$DRY_RUN" != "1" ] && [ ! -x "$1" ]; then
        build
    fi
}

check_difficulty() {
    case "$DIFFICULTY" in easy | normal | hard) ;; *)
        echo "DIFFICULTY must be easy, normal or hard (got '$DIFFICULTY')" >&2
        exit 2
        ;;
    esac
    case "$MODE" in campaign | endless) ;; *)
        echo "MODE must be campaign or endless (got '$MODE')" >&2
        exit 2
        ;;
    esac
}

lan_addresses() {
    # Skip the virtual interfaces of Docker and virtual machines.
    ip -4 -o addr show scope global 2>/dev/null | awk '$2 !~ /^(docker|br-|veth|virbr)/ {print $4}' | cut -d/ -f1
}

start_server() {
    check_difficulty # validate first: do not build for nothing
    need_binary "$SERVER"
    echo "== server on UDP port $PORT, difficulty $DIFFICULTY, mode $MODE"
    background "$SERVER" --port "$PORT" --difficulty "$DIFFICULTY" --mode "$MODE"
    [ "$DRY_RUN" = "1" ] || sleep 1
}

# start_client <host> <name> <config file>
start_client() {
    need_binary "$CLIENT"
    background "$CLIENT" --host "$1" --port "$PORT" --name "$2" --config "$3"
}

# Waits until every client window is closed (or Ctrl+C), then the server is stopped.
# The first background program is the server; the others are clients.
wait_all() {
    [ "$DRY_RUN" = "1" ] && return 0
    echo "== running, close the windows or press Ctrl+C to stop everything"
    local alive pid index
    while true; do
        alive=0
        for index in "${!PIDS[@]}"; do
            [ "$index" -eq 0 ] && continue
            pid="${PIDS[$index]}"
            kill -0 "$pid" 2>/dev/null && alive=1
        done
        # No client at all (host without its own window): wait for the server.
        if [ "${#PIDS[@]}" -eq 1 ]; then
            kill -0 "${PIDS[0]}" 2>/dev/null && alive=1
        fi
        [ "$alive" -eq 1 ] || break
        sleep 1
    done
}

# Sends one real CONNECT to a server over UDP (bash only, no extra tool), prints
# what it answered, then leaves the room so the slot is freed.
probe_server() {
    local host="$1" reply type
    exec 3<>"/dev/udp/$host/$PORT" 2>/dev/null || { echo "no-socket"; return; }
    # header "RT", version 1, type CONNECT (1), packetSeq 0; token 0, room instance 1, name "check"
    printf '\x52\x54\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x05check' >&3 2>/dev/null || { exec 3>&-; echo "no-socket"; return; }
    reply="$(timeout 2 head -c 19 <&3 2>/dev/null | od -An -tx1 | tr -d ' \n')" || true
    if [ "${reply:0:4}" = "5254" ]; then
        type="${reply:6:2}"
        if [ "$type" = "80" ]; then
            # LEAVE (type 4), sent three times like the real client
            for _ in 1 2 3; do printf '\x52\x54\x01\x04\x00\x00\x00\x00\x00' >&3 2>/dev/null || true; done
        fi
        echo "type-$type"
    else
        echo "silence"
    fi
    exec 3>&-
}

check_server() {
    local host="$1" result
    echo "== checking the server at $host (UDP port $PORT)"
    if command -v ping >/dev/null 2>&1; then
        if ping -c 1 -W 2 "$host" >/dev/null 2>&1; then
            echo "   network: this PC reaches $host"
        else
            echo "   network: no answer to ping (not fatal: some PCs ignore it)"
        fi
    fi
    result="$(probe_server "$host")"
    case "$result" in
    type-80) echo "   server: it answered, you can join: scripts/rtype.sh join $host YourName" ;;
    type-86) echo "   server: it answered but the room is full (4 players)"; return 1 ;;
    no-socket) echo "   server: cannot open a UDP socket to $host (wrong address?)"; return 1 ;;
    *)
        echo "   server: no answer. Check that:"
        echo "     - the server is running on that PC (scripts/rtype.sh host);"
        echo "     - both PCs are on the same network;"
        echo "     - the UDP port $PORT is open on the server PC (scripts/rtype.sh firewall)."
        return 1
        ;;
    esac
}

cmd="${1:-help}"
shift || true

cd "$ROOT"
case "$cmd" in
help | -h | --help)
    usage
    ;;
build)
    build
    ;;
test)
    build
    run ctest --preset "$PRESET" --output-on-failure
    ;;
solo)
    need_binary "$CLIENT"
    echo "== solo game: choose 'Solo game' in the menu, then Ready"
    run "$CLIENT" --config "$ROOT/client.cfg"
    ;;
server)
    check_difficulty
    need_binary "$SERVER"
    run "$SERVER" --port "$PORT" --difficulty "$DIFFICULTY" --mode "$MODE"
    ;;
client)
    need_binary "$CLIENT"
    run "$CLIENT" --host "${1:-127.0.0.1}" --port "$PORT" --name "${2:-Player}"
    ;;
local)
    count="${1:-2}"
    case "$count" in 1 | 2 | 3 | 4) ;; *)
        echo "local: N must be between 1 and 4" >&2
        exit 2
        ;;
    esac
    start_server
    for ((i = 1; i <= count; i++)); do
        echo "== client $i/$count (settings in /tmp/rtype-client$i.cfg)"
        start_client 127.0.0.1 "Player$i" "/tmp/rtype-client$i.cfg"
    done
    wait_all
    ;;
host)
    start_server
    url="$(git remote get-url origin 2>/dev/null || echo '<repository url>')"
    echo
    echo "== steps for the OTHER players (their PC must be on the same network):"
    for address in $(lan_addresses); do
        echo "   address $address"
        echo "     1. first time only: git clone $url && cd $(basename "$ROOT")"
        echo "     2. (optional) test the link:  scripts/rtype.sh check $address"
        echo "     3. play:                      scripts/rtype.sh join $address YourName"
        echo "        (it builds the game by itself the first time, then press Ready)"
    done
    echo "   They cannot connect? Open the port on this PC: scripts/rtype.sh firewall"
    echo
    if [ "${HOST_CLIENT:-1}" = "1" ]; then
        echo "== your own client (press Ready, the others join when they press Ready)"
        start_client 127.0.0.1 "Host" "/tmp/rtype-host.cfg"
    fi
    wait_all
    ;;
join)
    if [ $# -lt 1 ]; then
        echo "join: give the address of the server, for example: scripts/rtype.sh join 192.168.1.10" >&2
        exit 2
    fi
    need_binary "$CLIENT"
    run "$CLIENT" --host "$1" --port "$PORT" --name "${2:-Player}" --config "/tmp/rtype-join.cfg"
    ;;
check)
    if [ $# -lt 1 ]; then
        echo "check: give the address of the server, for example: scripts/rtype.sh check 192.168.1.10" >&2
        exit 2
    fi
    check_server "$1"
    ;;
firewall)
    if ! command -v ufw >/dev/null 2>&1; then
        echo "ufw is not installed: open UDP port $PORT in your firewall yourself."
        exit 0
    fi
    echo "This will run: sudo ufw allow $PORT/udp"
    if [ "$DRY_RUN" = "1" ]; then
        echo "[dry-run] nothing done"
    else
        read -r -p "Continue? [y/N] " answer
        [ "$answer" = "y" ] && sudo ufw allow "$PORT/udp" || echo "nothing done"
    fi
    ;;
*)
    echo "unknown command '$cmd'" >&2
    usage >&2
    exit 2
    ;;
esac
