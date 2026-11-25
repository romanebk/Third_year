#!/usr/bin/env python3
"""Send requests to r-type_lobby by hand, for tests and demos.

The lobby speaks a binary framed protocol (docs/documentation_du_projet/rfc-protocol.md section 8):
    u16 length (of type + payload) | u8 type | payload...
Typing that in netcat is painful, so this tool builds the frames, keeps one TCP
connection open between commands, and decodes the answers into readable lines.

Examples:
    scripts/lobby_cli.py                                   # interactive
    scripts/lobby_cli.py "login momo; create room; start"
    scripts/lobby_cli.py --hex "login momo; list"
    scripts/lobby_cli.py --port 4242 "join 1; ready 1"

Commands (interactive or separated by ';'):
    login <name>       create <room>      join <roomId>    ready <0|1>
    chat <text>        start             leave            list
    ping               raw <hex bytes>   listen [seconds] quit

Only the Python standard library is used.
"""

import argparse
import socket
import struct
import sys
import time

MAX_FRAME = 1024

TYPE_NAMES = {
    0x01: "LOGIN",
    0x02: "LIST_ROOMS",
    0x03: "CREATE_ROOM",
    0x04: "JOIN_ROOM",
    0x05: "LEAVE_ROOM",
    0x06: "SET_READY",
    0x07: "CHAT",
    0x08: "START",
    0x09: "PING",
    0x80: "LOGIN_OK",
    0x81: "ROOM_LIST",
    0x82: "ROOM_UPDATE",
    0x83: "CHAT_MSG",
    0x84: "ROOM_START",
    0x85: "ROOM_CLOSED",
    0x86: "ERROR",
    0x87: "PONG",
}

CLIENT_TYPES = {
    "login": 0x01,
    "list": 0x02,
    "create": 0x03,
    "join": 0x04,
    "leave": 0x05,
    "ready": 0x06,
    "chat": 0x07,
    "start": 0x08,
    "ping": 0x09,
}

ERROR_CODES = {
    1: "BadName",
    2: "RoomFull",
    3: "RoomNotFound",
    4: "NotHost",
    5: "NameTaken",
    6: "ShuttingDown",
}

ROOM_STATES = {0: "waiting", 1: "playing", 2: "closed"}


class ProtocolError(Exception):
    pass


def encode_str(text):
    data = text.encode("utf-8")
    if len(data) > 0xFF:
        raise ProtocolError("string too long for a u8 length prefix")
    return bytes([len(data)]) + data


class Lobby:
    def __init__(self, host, port, quiet=0.4, show_hex=False):
        self.host = host
        self.port = port
        self.quiet = quiet
        self.show_hex = show_hex
        self.buffer = b""
        try:
            self.socket = socket.create_connection((host, port), timeout=2.0)
        except OSError as error:
            raise SystemExit(
                "cannot connect to {}:{} ({}); is r-type_lobby running?".format(host, port, error)
            )
        self.socket.settimeout(quiet)

    def close(self):
        try:
            self.socket.close()
        except OSError:
            pass

    def send(self, type_byte, payload=b""):
        frame = struct.pack("<HB", len(payload) + 1, type_byte) + payload
        self.socket.sendall(frame)
        if self.show_hex:
            print(">> {}  {}".format(frame.hex(" "), describe_request(type_byte, payload)))
        return frame

    def receive(self, max_wait=2.0):
        return self.drain(max_wait, extend_on_data=True)

    def listen(self, seconds):
        return self.drain(seconds, extend_on_data=False)

    def drain(self, window, extend_on_data):
        frames = []
        deadline = time.monotonic() + window
        while time.monotonic() < deadline:
            try:
                chunk = self.socket.recv(4096)
            except socket.timeout:
                if frames and extend_on_data:
                    break
                continue
            if not chunk:
                break
            self.buffer += chunk
            while len(self.buffer) >= 2:
                (length,) = struct.unpack_from("<H", self.buffer)
                if length == 0 or length > MAX_FRAME:
                    raise ProtocolError("bad frame length {}".format(length))
                if len(self.buffer) < 2 + length:
                    break
                frames.append((self.buffer[2], self.buffer[3 : 2 + length]))
                self.buffer = self.buffer[2 + length :]
            if extend_on_data:
                deadline = time.monotonic() + self.quiet
        return frames

    def request(self, line, max_wait=2.0):
        self.send_frame_for(line)
        frames = self.receive(max_wait)
        for type_byte, payload in frames:
            print("<< " + describe_response(type_byte, payload))
        return frames

    def send_frame_for(self, line):
        line = line.strip()
        if not line:
            return
        parts = line.split()
        name = parts[0].lower()
        rest = " ".join(parts[1:])
        if name == "raw":
            try:
                frame = bytes.fromhex(rest.replace(" ", ""))
            except ValueError:
                raise ProtocolError("raw needs hexadecimal bytes, e.g. raw 0100 02")
            self.socket.sendall(frame)
            if self.show_hex:
                print(">> {}".format(frame.hex(" ")))
            return
        if name == "listen":
            return
        if name not in CLIENT_TYPES:
            raise ProtocolError("unknown command '{}'".format(name))
        payload = build_payload(name, rest)
        self.send(CLIENT_TYPES[name], payload)


def build_payload(name, arg):
    if name in ("login", "create"):
        if not arg:
            raise ProtocolError("{} needs a name".format(name))
        return encode_str(arg)
    if name == "join":
        if not arg:
            raise ProtocolError("join needs a room id")
        try:
            room_id = int(arg)
        except ValueError:
            raise ProtocolError("join needs a number")
        if not 0 <= room_id <= 0xFFFF:
            raise ProtocolError("room id out of range")
        return struct.pack("<H", room_id)
    if name == "ready":
        if arg not in ("0", "1"):
            raise ProtocolError("ready needs 0 or 1")
        return bytes([int(arg)])
    if name == "chat":
        if not arg:
            raise ProtocolError("chat needs a message")
        return encode_str(arg)
    if name == "ping":
        if arg:
            raise ProtocolError("ping takes no argument")
        return struct.pack("<I", int(time.monotonic() * 1000) & 0xFFFFFFFF)
    if name in ("list", "leave", "start"):
        if arg:
            raise ProtocolError("{} takes no argument".format(name))
        return b""
    raise ProtocolError("unknown command '{}'".format(name))


def describe_request(type_byte, payload):
    name = TYPE_NAMES.get(type_byte, "0x{:02X}".format(type_byte))
    if type_byte in (0x01, 0x03, 0x07):
        return "{}({!r})".format(name, payload[1:].decode("utf-8", "replace"))
    if type_byte == 0x04:
        return "{}(room={})".format(name, struct.unpack_from("<H", payload)[0])
    if type_byte == 0x06:
        return "{}({})".format(name, payload[0] if payload else 0)
    return name


class Cursor:
    def __init__(self, payload):
        self.payload = payload
        self.pos = 0

    def take(self, count):
        if self.pos + count > len(self.payload):
            raise ProtocolError("truncated frame")
        data = self.payload[self.pos : self.pos + count]
        self.pos += count
        return data

    def u8(self):
        return self.take(1)[0]

    def u16(self):
        return struct.unpack("<H", self.take(2))[0]

    def u32(self):
        return struct.unpack("<I", self.take(4))[0]

    def string(self):
        return self.take(self.u8()).decode("utf-8", "replace")

    def rest(self):
        data = self.payload[self.pos :]
        self.pos = len(self.payload)
        return data


def describe_response(type_byte, payload):
    name = TYPE_NAMES.get(type_byte, "0x{:02X}".format(type_byte))
    try:
        return decode_response(name, type_byte, payload)
    except (ProtocolError, struct.error) as error:
        return "{} <cannot decode: {}> {}".format(name, error, payload.hex(" "))


def decode_response(name, type_byte, payload):
    cursor = Cursor(payload)
    if type_byte == 0x80:
        return "{} clientId={}".format(name, cursor.u32())
    if type_byte == 0x81:
        count = cursor.u8()
        rooms = []
        for _ in range(count):
            room_id = cursor.u16()
            room_name = cursor.string()
            players = cursor.u8()
            max_players = cursor.u8()
            state = cursor.u8()
            rooms.append(
                "#{} {!r} {}/{} {}".format(
                    room_id, room_name, players, max_players, ROOM_STATES.get(state, state)
                )
            )
        return "{} {} room(s){}".format(name, count, (": " + "; ".join(rooms)) if rooms else "")
    if type_byte == 0x82:
        room_id = cursor.u16()
        count = cursor.u8()
        players = []
        for _ in range(count):
            client_id = cursor.u32()
            player_name = cursor.string()
            ready = cursor.u8()
            is_host = cursor.u8()
            players.append(
                "{}={!r}{}{}".format(
                    client_id, player_name, " ready" if ready else "", " host" if is_host else ""
                )
            )
        return "{} room={} {} player(s): {}".format(name, room_id, count, ", ".join(players))
    if type_byte == 0x83:
        client_id = cursor.u32()
        from_name = cursor.string()
        text = cursor.string()
        return "{} {} ({}): {}".format(name, from_name, client_id, text)
    if type_byte == 0x84:
        ip = cursor.string()
        port = cursor.u16()
        token = cursor.u32()
        instance = cursor.u32()
        return "{} udp={}:{} token={} instance={}".format(name, ip, port, token, instance)
    if type_byte == 0x85:
        return "{} reason={}".format(name, cursor.u8())
    if type_byte == 0x86:
        code = cursor.u8()
        text = cursor.string()
        return "{} code={} ({}) {!r}".format(name, code, ERROR_CODES.get(code, "?"), text)
    if type_byte == 0x87:
        return "{} clientTimeMs={}".format(name, cursor.u32())
    return "{} {}".format(name, payload.hex(" "))


def run_script(lobby, script):
    for line in script.split(";"):
        line = line.strip()
        if not line:
            continue
        if line.split()[0].lower() == "listen":
            parts = line.split()
            seconds = float(parts[1]) if len(parts) > 1 else 2.0
            for type_byte, payload in lobby.listen(seconds):
                print("<< " + describe_response(type_byte, payload))
            continue
        lobby.request(line)


def interactive(lobby):
    print(
        "connected to {}:{} - type 'help' for the commands, 'quit' to leave".format(
            lobby.host, lobby.port
        )
    )
    while True:
        try:
            line = input("lobby> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if not line:
            continue
        if line.lower() in ("quit", "exit"):
            return
        if line.lower() in ("help", "?"):
            print(__doc__)
            continue
        try:
            if line.split()[0].lower() == "listen":
                run_script(lobby, line)
            else:
                lobby.request(line)
        except ProtocolError as error:
            print("error: {}".format(error))
        except OSError as error:
            print("connection lost: {}".format(error))
            return


def main():
    parser = argparse.ArgumentParser(
        description="Send requests to r-type_lobby (TCP) and decode the answers.",
        epilog="Commands can be chained with ';', e.g. \"login momo; create room; start\".",
    )
    parser.add_argument("--host", default="127.0.0.1", help="lobby address (default 127.0.0.1)")
    parser.add_argument("--port", type=int, default=4242, help="lobby TCP port (default 4242)")
    parser.add_argument("--hex", action="store_true", help="also print the raw frames")
    parser.add_argument("--quiet", type=float, default=0.4, help="seconds of silence ending a reply")
    parser.add_argument("script", nargs="?", help="commands separated by ';' (default: interactive)")
    args = parser.parse_args()

    lobby = Lobby(args.host, args.port, quiet=args.quiet, show_hex=args.hex)
    try:
        if args.script:
            run_script(lobby, args.script)
        else:
            interactive(lobby)
    finally:
        lobby.close()


if __name__ == "__main__":
    main()
