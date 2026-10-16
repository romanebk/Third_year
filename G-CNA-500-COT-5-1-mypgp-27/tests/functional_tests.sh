#!/bin/sh
##
## EPITECH PROJECT, 2026
## functional_tests.sh
## File description:
## black-box tests of ./my_pgp: exact outputs, return codes, crashes,
## timeouts and timings, checked against an independent python model
##
## usage:  sh tests/functional_tests.sh            (binary ./my_pgp)
##         BIN=./other_binary sh tests/functional_tests.sh
##         VALGRIND=1 sh tests/functional_tests.sh  (every run under valgrind)
##         QUICK=1 sh tests/functional_tests.sh     (skips the biggest keys)
##         BONUS=1 BIN=bonus/my_pgp sh tests/functional_tests.sh
##             (the bonus binary: `rsa -g` alone is a valid command there)
##

BIN="${BIN:-./my_pgp}"

if [ ! -x "$BIN" ]; then
    echo "binary $BIN not found, run 'make' first." >&2
    exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 is required for the functional tests." >&2
    exit 1
fi
if ! command -v timeout >/dev/null 2>&1; then
    echo "timeout (coreutils) is required for the functional tests." >&2
    exit 1
fi

# The binary is copied to a temporary directory: on WSL, launching a
# program stored on a Windows drive (/mnt/c) costs up to a second, which
# would distort every timing measured below.
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT INT TERM
cp "$BIN" "$WORKDIR/my_pgp"
SCRIPT="$WORKDIR/functional.py"
cat > "$SCRIPT" <<'PYTHON'
import math
import os
import random
import shutil
import subprocess
import sys
import time

BIN = os.path.abspath(sys.argv[1])
VALGRIND = os.environ.get("VALGRIND") == "1"
QUICK = os.environ.get("QUICK") == "1" or VALGRIND
BONUS = os.environ.get("BONUS") == "1"
TIMEOUT = 60 if VALGRIND else 5
SLOW_LIMIT = 1.0
HAVE_OPENSSL = shutil.which("openssl") is not None
random.seed(20261012)

stats = {"pass": 0, "fail": 0, "crash": 0, "slow": 0}
slowest = [0.0, ""]
current = ["?"]


def section(name):
    current[0] = name
    print(f"\n== {name} ==")


def report(ok, desc, detail=""):
    if ok:
        stats["pass"] += 1
        return
    stats["fail"] += 1
    print(f"[FAIL] {desc}")
    if detail:
        print(f"       {detail[:300]}")


def run(args, data=b"", timed=False):
    """Runs the binary, returns (rc, stdout, stderr, seconds)."""
    cmd = ["timeout", str(TIMEOUT)]
    if VALGRIND:
        cmd += ["valgrind", "-q", "--leak-check=full",
                "--errors-for-leak-kinds=definite,indirect",
                "--error-exitcode=42"]
    cmd += [BIN] + args
    start = time.time()
    proc = subprocess.run(cmd, input=data, capture_output=True)
    elapsed = time.time() - start
    rc = proc.returncode
    desc = " ".join(a if len(a) < 40 else a[:37] + "..." for a in args)
    if rc == 124 or rc >= 128 or rc < 0:
        stats["crash"] += 1
        kind = "TIMEOUT" if rc == 124 else f"SIGNAL rc={rc}"
        print(f"[CRASH] {kind}: {desc}")
    elif rc == 42 and VALGRIND:
        stats["crash"] += 1
        print(f"[VALGRIND] {desc}")
        print("       " + proc.stderr.decode(errors="replace")[:400])
    if elapsed > slowest[0]:
        slowest[0], slowest[1] = elapsed, desc
    if timed and not VALGRIND and elapsed > SLOW_LIMIT:
        stats["slow"] += 1
        print(f"[SLOW] {elapsed:.2f}s: {desc}")
    return rc, proc.stdout, proc.stderr, elapsed


def expect(args, data, out, desc, rc=0, timed=False):
    got_rc, got_out, _, _ = run(args, data, timed)
    report(got_rc == rc and got_out == out, desc,
           f"rc={got_rc} (want {rc}) out={got_out[:120]!r} "
           f"want={out[:120]!r}")
    return got_out


def expect_error(args, data, desc):
    rc, out, err, _ = run(args, data)
    report(rc == 84 and out == b"" and err != b"", desc,
           f"rc={rc} out={out[:80]!r} err={err[:80]!r}")


# ---------------------------------------------------------------- model

def le(x):
    if x == 0:
        return "00"
    return x.to_bytes((x.bit_length() + 7) // 8, "little").hex()


def from_le(h):
    return int.from_bytes(bytes.fromhex(h), "little")


def is_prime(n):
    if n < 2:
        return False
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % p == 0:
            return n == p
    d, r = n - 1, 0
    while d % 2 == 0:
        d //= 2
        r += 1
    for a in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(r - 1):
            x = x * x % n
            if x == n - 1:
                break
        else:
            return False
    return True


def random_prime(bits):
    while True:
        n = random.getrandbits(bits) | (1 << (bits - 1)) | 1
        if is_prime(n):
            return n


def rsa_keys(p, q):
    lam = (p - 1) * (q - 1) // math.gcd(p - 1, q - 1)
    for e in (65537, 257, 17, 5, 3):
        if e < lam and math.gcd(e, lam) == 1:
            return e, pow(e, -1, lam), p * q, lam
    return None


def xor_model(msg, key, block):
    out = bytearray()
    size = len(key)
    for off in range(0, len(msg), size):
        chunk = msg[off:off + size].ljust(size, b"\0")
        out += bytes(chunk[size - 1 - i] ^ key[i] for i in range(size))
    return bytes(out)


def word_swap(data):
    return b"".join(data[i:i + 4][::-1] for i in range(0, len(data), 4))


def aes_model(msg, key):
    """subject AES = S(AES_S(key)(plain)), S = byte swap of every word."""
    if not HAVE_OPENSSL:
        return None
    padded = msg.ljust((len(msg) + 15) // 16 * 16, b"\0")
    if not padded:
        return b""
    proc = subprocess.run(
        ["openssl", "enc", f"-aes-{len(key) * 8}-ecb", "-nopad", "-nosalt",
         "-K", word_swap(key).hex()], input=padded, capture_output=True)
    if proc.returncode != 0:
        return None
    return word_swap(proc.stdout)


def hexline(data):
    return (data.hex() + "\n").encode()


# ------------------------------------------------------------- vectors

SUBJ_XOR_KEY = "576861742069732064656164206d6179206e6576657220646965"
SUBJ_XOR_OUT = "20070f2700071c6a4449060a490515164e4e12190b190011063c"
SUBJ_AES_KEY = "57696e74657220697320636f6d696e67"
SUBJ_AES_OUT = "744ce22c385958348f0df26eceb62eef"
P256 = "4b1da73924978f2e9c1f04170e46820d648edbee12ccf4d4462af89b080c86e1"
Q256 = "bb3ca1e126f7c8751bd81bc8daa226494efb3d128f72ed9f6cacbe96e14166cb"
PUB = ("010001-c9f91a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8cd92"
       "5de139a0076b962f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3")
PRIV = ("81b08f4eb6dd8a4dd21728e5194dfc4e349829c9991c8b5e44b31e6ceee1e56a11d"
        "66ef23389be92ef7a4178470693f509c90b86d4a1e1831056ca0757f3e209-c9f91"
        "a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8cd925de139a0076"
        "b962f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3")
NIGHT = ("445b349e7318ad6af16b0bbb718be88ba1c41751f95751cd58857f88fe31f97040"
         "5c6ec3f16d79172543bf4e571b5596d212f3e79cd08ef14abd244e325b80")
PGP_AES_SYM = ("97f2af4c1b712008c1e46935f446756443a8a700f20581d138e4e6916afe"
               "5c5f9b9d6eaa0a870374b686f1a024f9bbb88c23c766654579339caf55af"
               "d149d41d")

# ----------------------------------------------------------- 10 rigor

section("10 - RIGOR (arguments)")
rc, out, err, _ = run(["-h"])
report(rc == 0 and out.startswith(b"USAGE\n") and err == b"", "-h")
for args in ([], ["xor"], ["xor", "-c"], ["xor", "-b"], ["rsa", "-g"],
             ["rsa", "-g", "d3"], ["unknown", "-c", "00"],
             ["xor", "-x", "00"], ["xor", "-c", "-d", "00"],
             ["xor", "-c", "00", "11"], ["xor", "00"], ["xor", "-g", "3", "5"],
             ["aes", "-g", "3", "5"], ["pgp-xor", "-g", "3", "5"],
             ["rsa", "-g", "d3", "e3", "0101-19bb"],
             ["rsa", "-g", "d3", "e3", "-c"], ["-c", "xor", "00"],
             ["XOR", "-c", "00"], ["xor", "-C", "00"], ["xor", "--c", "00"]):
    if BONUS and args == ["rsa", "-g"]:
        continue
    expect_error(args, b"hello", "args: " + " ".join(args))

# ------------------------------------------------ 11 crypto rigor

section("11 - CRYPTOGRAPHIC RIGOR")
for key, msg, desc in (("4142", b"abc\n", "xor -b size mismatch"),
                       ("", b"abc", "xor empty key"),
                       ("414", b"ab", "xor odd hex key"),
                       ("4g42", b"ab", "xor invalid hex key")):
    expect_error(["xor", "-c", "-b", key] if "-b" in desc
                 else ["xor", "-c", key], msg, desc)
expect_error(["xor", "-d", "41"], b"zz", "xor -d invalid hex message")
expect_error(["xor", "-d", "41"], b"414", "xor -d odd hex message")
expect_error(["xor", "-d", "-b", "4142"], b"41\n", "xor -d -b size mismatch")
for key in ("4142", "", "00" * 15, "00" * 17, "00" * 20, "00" * 33, "zz" * 16):
    expect_error(["aes", "-c", key], b"x", f"aes key of {len(key)//2} bytes")
expect_error(["aes", "-c", "-b", SUBJ_AES_KEY], b"short\n",
             "aes -b block too short")
expect_error(["aes", "-c", "-b", SUBJ_AES_KEY], b"seventeen bytes!!\n",
             "aes -b block too long")
expect_error(["aes", "-d", SUBJ_AES_KEY], b"nothex", "aes -d invalid hex")
expect_error(["aes", "-d", "-b", SUBJ_AES_KEY], b"744ce22c\n",
             "aes -d -b not 16 bytes")
for p, q in (("zz", "e3"), ("d3", "z3"), ("d", "e3"), ("02", "03"),
             ("", "e3"), ("e3", ""), ("00", "e3"), ("0000", "e3"),
             ("01", "01"), ("01", "e3")):
    expect_error(["rsa", "-g", p, q], b"", f"rsa -g {p!r} {q!r}")
expect_error(["rsa", "-c", "0101-19bb"], b"far too long for this key\n",
             "rsa message >= n")
expect_error(["rsa", "-c", "010119bb"], b"WF", "rsa key without dash")
expect_error(["rsa", "-c", "0101-00"], b"WF", "rsa zero modulus")
expect_error(["rsa", "-c", "0g01-19bb"], b"WF", "rsa key invalid hex")
expect_error(["rsa", "-d", "9d5b-19bb"], b"zz", "rsa -d invalid hex")
expect_error(["rsa", "-d", "9d5b-19bb"], b"ffffff", "rsa -d cipher >= n")

# --------------------------------------------------------- 20/21 XOR

section("20/21 - XOR (subject + model, block and stream)")
expect(["xor", "-c", "-b", SUBJ_XOR_KEY], b"You know nothing, Jon Snow\n",
       (SUBJ_XOR_OUT + "\n").encode(), "subject vector cipher")
expect(["xor", "-d", "-b", SUBJ_XOR_KEY], (SUBJ_XOR_OUT + "\n").encode(),
       b"You know nothing, Jon Snow\n", "subject vector decipher")
expect(["xor", "-c", "-b", "4142"], b"XY", b"181a\n", "XY block")
for _ in range(60):
    klen = random.choice([1, 2, 3, 5, 8, 16, 26, 32, 64])
    key = os.urandom(klen)
    block = random.random() < 0.5
    mlen = klen if block else random.randint(0, 300)
    msg = os.urandom(mlen).replace(b"\n", b"x")
    flag = ["-b"] if block else []
    want = xor_model(msg, key, block)
    expect(["xor", "-c"] + flag + [key.hex()], msg + b"\n", hexline(want),
           f"xor model k={klen} m={mlen} b={block}")
    plain = msg.ljust(len(want), b"\0")
    expect(["xor", "-d"] + flag + [key.hex()], hexline(want), plain + b"\n",
           f"xor roundtrip k={klen} m={mlen} b={block}")
big = os.urandom(3 * 1024 * 1024 if not QUICK else 200000)
rc, out, _, t = run(["xor", "-c", "41"], big, timed=True)
report(rc == 0 and out == hexline(xor_model(big, b"A", False)),
       f"xor stream {len(big)} bytes ({t:.2f}s)")

# --------------------------------------------------------- 40/41 AES

section("40/41 - AES (subject + openssl model, 128/192/256)")
expect(["aes", "-c", "-b", SUBJ_AES_KEY], b"All men must die\n",
       (SUBJ_AES_OUT + "\n").encode(), "subject vector cipher")
expect(["aes", "-d", "-b", SUBJ_AES_KEY], (SUBJ_AES_OUT + "\n").encode(),
       b"All men must die\n", "subject vector decipher")
if not HAVE_OPENSSL:
    print("   (openssl absent: AES model checks reduced to roundtrips)")
for _ in range(45):
    klen = random.choice([16, 24, 32])
    key = os.urandom(klen)
    block = random.random() < 0.4
    mlen = 16 if block else random.choice([0, 1, 15, 16, 17, 31, 32, 100,
                                           random.randint(0, 500)])
    msg = os.urandom(mlen).replace(b"\n", b"x")
    flag = ["-b"] if block else []
    rc, out, _, _ = run(["aes", "-c"] + flag + [key.hex()], msg + b"\n")
    model = aes_model(msg, key)
    report(rc == 0 and (model is None or out == hexline(model)),
           f"aes model k={klen} m={mlen} b={block}",
           f"got={out[:80]!r} want={model.hex()[:80] if model else None}")
    plain = msg.ljust((mlen + 15) // 16 * 16, b"\0")
    expect(["aes", "-d"] + flag + [key.hex()], out, plain + b"\n",
           f"aes roundtrip k={klen} m={mlen} b={block}")
big = os.urandom(2 * 1024 * 1024 if not QUICK else 100000)
rc, out, _, t = run(["aes", "-c", SUBJ_AES_KEY], big, timed=True)
report(rc == 0 and len(out) == ((len(big) + 15) // 16 * 32 + 1),
       f"aes stream {len(big)} bytes ({t:.2f}s)")
rc, back, _, t = run(["aes", "-d", SUBJ_AES_KEY], out, timed=True)
report(rc == 0 and back[:len(big)] == big, f"aes stream roundtrip ({t:.2f}s)")

# ------------------------------------------------- 30/31 RSA crypto

section("30/31 - RSA cipher / decipher")
expect(["rsa", "-c", "0101-19bb"], b"WF\n", b"8f84\n", "subject WF cipher")
expect(["rsa", "-d", "9d5b-19bb"], b"8f84\n", b"WF\n", "subject WF decipher")
expect(["rsa", "-c", PUB], b"The night is dark and full of terrors\n",
       (NIGHT + "\n").encode(), "subject 256-bit cipher")
expect(["rsa", "-d", PRIV], (NIGHT + "\n").encode(),
       b"The night is dark and full of terrors\n", "subject 256-bit decipher")
expect(["rsa", "-c", "0101-19bb"], b"", b"00\n", "empty message")
expect(["rsa", "-d", "9d5b-19bb"], b"00\n", b"\n", "deciphered zero")

# ------------------------------------------------- 32/33/34 RSA keygen

section("32/33/34 - RSA keygen, maths and performance")
expect(["rsa", "-g", "d3", "e3"], b"",
       b"public key: 0101-19bb\nprivate key: 9d5b-19bb\n", "subject d3 e3")
expect(["rsa", "-g", P256, Q256], b"",
       f"public key: {PUB}\nprivate key: {PRIV}\n".encode(), "subject 256")
for a in ("d3", "e3", "e9", "f1"):
    for b in ("d3", "e3", "e9", "f1"):
        e, d, n, _ = rsa_keys(from_le(a), from_le(b))
        expect(["rsa", "-g", a, b], b"",
               f"public key: {le(e)}-{le(n)}\nprivate key: {le(d)}-{le(n)}\n"
               .encode(), f"8-bit pair {a} {b}")
sizes = [8, 12, 16, 24, 32, 48, 64, 128, 256, 512, 1024, 2048]
if not QUICK:
    sizes.append(4096)
pairs = []
for bits in sizes:
    for _ in range(2 if bits <= 1024 else 1):
        pairs.append((random_prime(bits), random_prime(bits)))
pairs.append((random_prime(64), random_prime(512)))
pairs.append((random_prime(1024), random_prime(256)))
pairs.append((random_prime(31), random_prime(33)))
for p, q in pairs:
    keys = rsa_keys(p, q)
    tag = f"{p.bit_length()}/{q.bit_length()} bits"
    want = (f"public key: {le(keys[0])}-{le(keys[2])}\n"
            f"private key: {le(keys[1])}-{le(keys[2])}\n").encode() \
        if keys else None
    rc, out, _, t = run(["rsa", "-g", le(p), le(q)], timed=True)
    if keys is None:
        report(rc == 84, f"keygen {tag}: no Fermat prime fits")
        continue
    report(rc == 0 and out == want, f"keygen {tag} ({t:.3f}s)",
           f"rc={rc} got={out[:100]!r}")
    e, d, n, lam = keys
    report(e * d % lam == 1 and n == p * q, f"keygen {tag}: e*d = 1 mod lambda")
    rc2, out2, _, _ = run(["rsa", "-g", le(p) + "00", le(q) + "0000"])
    report(rc2 == 0 and out2 == want, f"keygen {tag}: high zero bytes ignored")
    pub = f"{le(e)}-{le(n)}"
    priv = f"{le(d)}-{le(n)}"
    for mlen in sorted({1, max(1, (n.bit_length() - 1) // 16),
                        max(1, (n.bit_length() - 1) // 8)}):
        msg = bytes(random.randint(1, 255) for _ in range(mlen))
        msg = msg.replace(b"\n", b"x")
        m = int.from_bytes(msg, "little")
        if m >= n:
            continue
        c = pow(m, e, n)
        expect(["rsa", "-c", pub], msg + b"\n", (le(c) + "\n").encode(),
               f"cipher {tag} m={mlen}", timed=True)
        expect(["rsa", "-d", priv], (le(c) + "\n").encode(), msg + b"\n",
               f"decipher {tag} m={mlen}", timed=True)

# ------------------------------------------------------------- PGP keys

pgp_keys = [("0101-19bb", "9d5b-19bb", 47897), (PUB, PRIV, from_le(PUB[7:]))]
for bits in ([512, 1024] if QUICK else [512, 1024, 2048]):
    p, q = random_prime(bits), random_prime(bits)
    e, d, n, _ = rsa_keys(p, q)
    pgp_keys.append((f"{le(e)}-{le(n)}", f"{le(d)}-{le(n)}", n))

# ------------------------------------------------------ 50/51 PGP-XOR

section("50/51 - PGP-XOR")
expect(["pgp-xor", "-c", "-b", "4142:0101-19bb"], b"Hi", b"3422\n280a\n",
       "small block cipher")
expect(["pgp-xor", "-d", "-b", "3422:9d5b-19bb"], b"280a\n", b"Hi\n",
       "small block decipher")
expect(["pgp-xor", "-d", "-b", "1c09:9d5b-19bb"], b"2848\n", b"Hi\n",
       "symmetric key ending with 00 (block)")


def pgp_case(system, pub, priv, n, key, msg, block, tag):
    flag = ["-b"] if block else []
    rc, out, _, t = run([system, "-c"] + flag + [key.hex() + ":" + pub],
                        msg + b"\n", timed=True)
    lines = out.split(b"\n")
    e = from_le(pub.split("-")[0])
    want1 = le(pow(int.from_bytes(key, "little"), e, n)).encode()
    if system == "pgp-xor":
        want2 = xor_model(msg, key, block).hex().encode()
    else:
        model = aes_model(msg, key)
        want2 = model.hex().encode() if model is not None else lines[1:2]
        want2 = want2 if isinstance(want2, bytes) else (want2 or [b""])[0]
    ok = rc == 0 and len(lines) == 3 and lines[0] == want1 \
        and lines[1] == want2 and lines[2] == b""
    report(ok, f"{system} cipher {tag} ({t:.2f}s)", f"rc={rc} {out[:90]!r}")
    if not ok:
        return
    rc, back, _, t = run([system, "-d"] + flag
                         + [lines[0].decode() + ":" + priv],
                         lines[1] + b"\n", timed=True)
    body = back[:-1]
    ok = rc == 0 and back.endswith(b"\n") and body[:len(msg)] == msg \
        and body[len(msg):].strip(b"\0") == b""
    report(ok, f"{system} roundtrip {tag} ({t:.2f}s)",
           f"rc={rc} got={back[:60]!r} want={msg[:60]!r}")


for pub, priv, n in pgp_keys:
    nbytes = (n.bit_length() - 1) // 8
    for _ in range(8):
        klen = random.randint(1, max(1, min(nbytes, 48)))
        key = bytearray(os.urandom(klen))
        if key[-1] == 0:
            key[-1] = 1
        block = random.random() < 0.4
        kind = random.choice(["text", "binary", "zeros", "empty", "one"])
        mlen = klen if block else random.randint(0, 400)
        if kind == "text":
            msg = bytes(random.choice(b"abcdefXYZ .,!?") for _ in range(mlen))
        elif kind == "zeros":
            msg = bytes(mlen)
        elif kind == "binary":
            msg = os.urandom(mlen).replace(b"\n", b"x")
        elif kind == "one" and not block:
            msg = b"A"
        else:
            msg = b"" if not block else os.urandom(mlen).replace(b"\n", b"x")
        if block and len(msg) != klen:
            msg = msg[:klen].ljust(klen, b"x")
        pgp_case("pgp-xor", pub, priv, n, bytes(key), msg, block,
                 f"n={n.bit_length()} k={klen} {kind} m={len(msg)} b={block}")
    # session keys ending with zero bytes, text messages (EVAL edge case)
    for zeros in (1, 2):
        klen = random.randint(zeros + 1, max(zeros + 1, min(nbytes, 24)))
        if klen > nbytes:
            continue
        key = bytearray(os.urandom(klen))
        key[-zeros:] = bytes(zeros)
        if key[0] == 0:
            key[0] = 1
        msg = bytes(random.choice(b"winter is coming ") for _ in range(klen))
        pgp_case("pgp-xor", pub, priv, n, bytes(key), msg, True,
                 f"n={n.bit_length()} key ends with {zeros} zero(s), block")
        msg = bytes(random.choice(b"winter is coming ")
                    for _ in range(random.randint(1, 200)))
        pgp_case("pgp-xor", pub, priv, n, bytes(key), msg, False,
                 f"n={n.bit_length()} key ends with {zeros} zero(s), stream")
big = os.urandom(3 * 1024 * 1024 if not QUICK else 150000)
pgp_case("pgp-xor", PUB, PRIV, from_le(PUB[7:]), os.urandom(32).replace(
    b"\0", b"\1"), big.replace(b"\n", b"x"), False, f"{len(big)} bytes")

# ------------------------------------------------------ 60/61 PGP-AES

section("60/61 - PGP-AES")
expect(["pgp-aes", "-c", "-b", SUBJ_AES_KEY + ":" + PUB],
       b"All men must die\n",
       (PGP_AES_SYM + "\n" + SUBJ_AES_OUT + "\n").encode(), "subject cipher")
expect(["pgp-aes", "-d", "-b", PGP_AES_SYM + ":" + PRIV],
       (SUBJ_AES_OUT + "\n").encode(), b"All men must die\n",
       "subject decipher")
for pub, priv, n in pgp_keys[1:]:
    for _ in range(8):
        klen = random.choice([16, 24, 32])
        key = bytearray(os.urandom(klen))
        if random.random() < 0.3:
            key[-1] = 0
        if int.from_bytes(key, "little") >= n:
            continue
        block = random.random() < 0.4
        mlen = 16 if block else random.choice([0, 1, 16, 17, 100, 333])
        msg = os.urandom(mlen).replace(b"\n", b"x")
        pgp_case("pgp-aes", pub, priv, n, bytes(key), msg, block,
                 f"n={n.bit_length()} k={klen} m={mlen} b={block}")
big = os.urandom(2 * 1024 * 1024 if not QUICK else 100000)
pgp_case("pgp-aes", PUB, PRIV, from_le(PUB[7:]), os.urandom(16),
         big.replace(b"\n", b"x"), False, f"{len(big)} bytes")

section("PGP - errors")
for system in ("pgp-xor", "pgp-aes"):
    good = SUBJ_AES_KEY
    for key in (good, good + ":", ":" + PUB, "a:b:" + PUB, "zz:" + PUB,
                good + ":010001", good + ":zz-01", good + ":0101-zz",
                good + ":00-19bb", "ffffffffffffffffffffffffffffffff:0101-19bb"):
        expect_error([system, "-c", key], b"x", f"{system} -c key {key[:40]}")
    for key in ("zz:" + PRIV, "ffff" * 40 + ":" + PRIV, ":" + PRIV,
                PGP_AES_SYM + ":" + "00-00"):
        expect_error([system, "-d", key], b"00", f"{system} -d key {key[:40]}")
    expect_error([system, "-d", PGP_AES_SYM + ":" + PRIV], b"nothex",
                 f"{system} -d invalid message")
expect_error(["pgp-aes", "-c", "4142:" + PUB], b"x", "pgp-aes 2-byte key")
expect_error(["pgp-aes", "-c", "-b", SUBJ_AES_KEY + ":" + PUB], b"short\n",
             "pgp-aes -b short block")
expect_error(["pgp-xor", "-c", "-b", "4142:0101-19bb"], b"abc\n",
             "pgp-xor -b size mismatch")

# ------------------------------------------------------------ ElGamal

section("ElGamal (second asymmetric cryptosystem)")
expect(["elgamal", "-g", "e3", "05"], b"",
       b"public key: 20-e3\nprivate key: 05-e3\n", "small keygen")
expect(["elgamal", "-d", "05-e3"], b"80-27\n", b"A\n", "hand computed pair")
for bits in (64, 256, 1024):
    p = random_prime(bits)
    x = random.randint(1, p - 2)
    y = pow(2, x, p)
    expect(["elgamal", "-g", le(p), le(x)], b"",
           f"public key: {le(y)}-{le(p)}\nprivate key: {le(x)}-{le(p)}\n"
           .encode(), f"keygen {bits} bits")
    for mlen in (1, (bits - 1) // 8):
        msg = os.urandom(mlen).replace(b"\n", b"x").replace(b"\0", b"\1")
        rc, out, _, _ = run(["elgamal", "-c", f"{le(y)}-{le(p)}"],
                            msg + b"\n", timed=True)
        c1, c2 = (from_le(v) for v in out.decode().strip().split("-"))
        m = c2 * pow(c1, p - 1 - x, p) % p
        report(rc == 0 and m == int.from_bytes(msg, "little"),
               f"elgamal cipher {bits} bits m={mlen} (checked by python)")
        expect(["elgamal", "-d", f"{le(x)}-{le(p)}"], out, msg + b"\n",
               f"elgamal roundtrip {bits} bits m={mlen}", timed=True)
for args, data in ((["elgamal", "-g", "e3", "00"], b""),
                   (["elgamal", "-g", "03", "01"], b""),
                   (["elgamal", "-c", "20e3"], b"A"),
                   (["elgamal", "-c", "20-e3"], b"too long for key"),
                   (["elgamal", "-d", "05-e3"], b"8027"),
                   (["elgamal", "-d", "05-e3"], b"ff-01")):
    expect_error(args, data, "elgamal " + " ".join(args[1:]))

# ------------------------------------------------------------- result

print(f"\nslowest command: {slowest[0]:.3f}s ({slowest[1]})")
print(f"Result: {stats['pass']} passed, {stats['fail']} failed, "
      f"{stats['crash']} crash/timeout/valgrind, {stats['slow']} over "
      f"{SLOW_LIMIT}s")
sys.exit(0 if stats["fail"] == stats["crash"] == stats["slow"] == 0 else 1)
PYTHON
python3 "$SCRIPT" "$WORKDIR/my_pgp"
