#!/bin/sh
##
## EPITECH PROJECT, 2026
## bonus_tests.sh
## File description:
## bonus tests: random RSA primes and PKCS#7 padding, checked by python
## (and openssl when present), plus the mandatory functional suite run
## on the bonus binary to prove nothing of the subject changed
##
## usage (from the bonus directory or the repository root):
##     sh tests/bonus_tests.sh            or    make bonus_tests
##

HERE=$(cd "$(dirname "$0")/.." && pwd)
BIN="$HERE/my_pgp"
ROOT="$HERE/.."

if [ ! -x "$BIN" ]; then
    echo "bonus binary not found, run 'make bonus' first." >&2
    exit 1
fi
for tool in python3 timeout; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "$tool is required for the bonus tests." >&2
        exit 1
    fi
done

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT INT TERM
cp "$BIN" "$WORKDIR/my_pgp"
cat > "$WORKDIR/bonus.py" <<'PYTHON'
import math
import os
import random
import shutil
import subprocess
import sys
import time

BIN = sys.argv[1]
HAVE_OPENSSL = shutil.which("openssl") is not None
stats = {"pass": 0, "fail": 0}


def report(ok, desc, detail=""):
    if ok:
        stats["pass"] += 1
        return
    stats["fail"] += 1
    print(f"[FAIL] {desc}")
    if detail:
        print(f"       {detail[:300]}")


def run(args, data=b""):
    start = time.time()
    proc = subprocess.run(["timeout", "20", BIN] + args, input=data,
                          capture_output=True)
    return proc.returncode, proc.stdout, proc.stderr, time.time() - start


def expect_error(args, data, desc):
    rc, out, err, _ = run(args, data)
    report(rc == 84 and out == b"" and err != b"", desc,
           f"rc={rc} out={out[:60]!r}")


def le(x):
    return "00" if x == 0 else \
        x.to_bytes((x.bit_length() + 7) // 8, "little").hex()


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
    for a in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47):
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


# ------------------------------------------------ bonus 1: random primes

print("== bonus 1: RSA keys from random primes ==")
seen = set()
for bits in (None, 64, 65, 100, 255, 512, 1024, 1536, 2048, 3001, 4096):
    args = ["rsa", "-g"] + ([str(bits)] if bits else [])
    want_bits = bits or 2048
    rc, out, _, t = run(args)
    lines = out.decode().split("\n")
    ok = rc == 0 and len(lines) == 5 and lines[4] == "" \
        and lines[0].startswith("public key: ") \
        and lines[1].startswith("private key: ") \
        and lines[2].startswith("prime P: ") \
        and lines[3].startswith("prime Q: ")
    report(ok, f"rsa -g {bits or ''}: four lines ({t:.2f}s)", repr(out[:80]))
    if not ok:
        continue
    e_hex, n_hex = lines[0][12:].split("-")
    d_hex, n2_hex = lines[1][13:].split("-")
    p, q = from_le(lines[2][9:]), from_le(lines[3][9:])
    e, d, n = from_le(e_hex), from_le(d_hex), from_le(n_hex)
    lam = (p - 1) * (q - 1) // math.gcd(p - 1, q - 1)
    report(n_hex == n2_hex and n == p * q, f"{want_bits} bits: n = P * Q")
    report(n.bit_length() == want_bits,
           f"{want_bits} bits: modulus has exactly {want_bits} bits",
           f"got {n.bit_length()}")
    report(p != q and is_prime(p) and is_prime(q),
           f"{want_bits} bits: P and Q are distinct primes")
    report(e == 65537 and e * d % lam == 1,
           f"{want_bits} bits: e = 65537 and e*d = 1 mod lambda")
    seen.add(n)
    rc2, out2, _, _ = run(["rsa", "-g", lines[2][9:], lines[3][9:]])
    report(rc2 == 0 and out2 == ("\n".join(lines[:2]) + "\n").encode(),
           f"{want_bits} bits: mandatory -g P Q gives the same keys")
    msg = os.urandom(min(32, want_bits // 8 - 1)).replace(b"\n", b"x")
    msg = msg.replace(b"\0", b"\1")
    rc3, c, _, _ = run(["rsa", "-c", f"{e_hex}-{n_hex}"], msg + b"\n")
    rc4, back, _, _ = run(["rsa", "-d", f"{d_hex}-{n_hex}"], c)
    report(rc3 == 0 and rc4 == 0 and back == msg + b"\n",
           f"{want_bits} bits: cipher / decipher roundtrip")
report(len(seen) == 11, "every generated key is different")
for arg in ("63", "8193", "0", "123456", "100000"):
    expect_error(["rsa", "-g", arg], b"", f"rsa -g {arg}: size refused")
rc, out, _, _ = run(["rsa", "-g", "d3", "e3"])
report(rc == 0 and out == b"public key: 0101-19bb\nprivate key: 9d5b-19bb\n",
       "rsa -g d3 e3 unchanged")
expect_error(["rsa", "-g", "d3"], b"", "rsa -g d3 (one hex prime) refused")

# ------------------------------------------------ bonus 2: PKCS#7 padding


def pkcs7(msg, block):
    n = block - len(msg) % block
    return msg + bytes([n]) * n


def xor_model(msg, key):
    out = bytearray()
    size = len(key)
    for off in range(0, len(msg), size):
        chunk = msg[off:off + size]
        out += bytes(chunk[size - 1 - i] ^ key[i] for i in range(size))
    return bytes(out)


def word_swap(data):
    return b"".join(data[i:i + 4][::-1] for i in range(0, len(data), 4))


def aes_model(msg, key):
    """openssl pads with PKCS#7 by default; subject AES = S(AES_S(key))."""
    if not HAVE_OPENSSL:
        return None
    proc = subprocess.run(["openssl", "enc", f"-aes-{len(key) * 8}-ecb",
                           "-nosalt", "-K", word_swap(key).hex()],
                          input=msg, capture_output=True)
    return word_swap(proc.stdout) if proc.returncode == 0 else None


print("== bonus 2: PKCS#7 padding ==")
rc, out, _, _ = run(["aes", "-c", "-p", "57696e74657220697320636f6d696e67"],
                    b"All men must die")
report(out.startswith(b"744ce22c385958348f0df26eceb62eef")
       and len(out) == 65, "aligned message gets a whole block of padding")
for _ in range(40):
    system = random.choice(["xor", "aes"])
    if system == "aes":
        key = os.urandom(random.choice([16, 24, 32]))
        block = 16
    else:
        key = os.urandom(random.choice([1, 2, 3, 7, 16, 26, 255]))
        block = len(key)
    mlen = random.choice([0, 1, block - 1, block, block + 1,
                          random.randint(0, 600)])
    # a single trailing line feed is not part of the message (subject p.3)
    msg = os.urandom(max(0, mlen)).rstrip(b"\n")
    if random.random() < 0.5:
        msg += bytes(random.randint(0, 3))
    where = random.randint(2, 3)
    args = [system, "-c", key.hex()]
    args.insert(where, "-p")
    rc, out, _, _ = run(args, msg)
    padded = pkcs7(msg, block)
    want = xor_model(padded, key) if system == "xor" else aes_model(msg, key)
    report(rc == 0 and (want is None or out == want.hex().encode() + b"\n"),
           f"{system} -p cipher k={len(key)} m={len(msg)}",
           f"rc={rc} got={out[:60]!r}")
    rc, back, _, _ = run([system, "-d", "-p", key.hex()], out)
    report(rc == 0 and back == msg + b"\n",
           f"{system} -p roundtrip exact k={len(key)} m={len(msg)}",
           f"rc={rc} got={back[:40]!r} want={msg[:40]!r}")
key = "57696e74657220697320636f6d696e67"
rc, out, _, _ = run(["aes", "-c", "-p", key], b"hello")
bad = out[:-3] + (b"0" if out[-2:-1] != b"0" else b"1") + b"\n"
expect_error(["aes", "-d", "-p", key], bad, "tampered last block refused")
expect_error(["xor", "-d", "-p", "41"], b"43\n", "padding byte over the block size")
expect_error(["aes", "-d", "-p", key], b"00112233\n", "not a whole block")
expect_error(["aes", "-d", "-p", key], b"\n", "empty padded message")
expect_error(["aes", "-d", "-p", key], b"zz\n", "invalid hexadecimal")
expect_error(["aes", "-c", "-p", "-b", key], b"x" * 16, "-p with -b")
expect_error(["rsa", "-c", "-p", "0101-19bb"], b"WF", "-p with rsa")
expect_error(["xor", "-c", "-p", "-p", "41"], b"x", "-p given twice")
expect_error(["xor", "-c", "-p", "41" * 256], b"x", "xor key over 255 bytes")
expect_error(["xor", "-c", "-p", ""], b"x", "xor empty key")
expect_error(["aes", "-c", "-p", "4142"], b"x", "aes key of 2 bytes")
expect_error(["aes", "-p"], b"x", "-p without mode nor key")
rc, out, _, _ = run(["aes", "-c", key], b"hello")
rc2, out2, _, _ = run(["aes", "-c", key], b"hello")
report(rc == rc2 == 0 and out == out2 and len(out) == 33,
       "without -p the zero padding is unchanged")

print(f"\nResult: {stats['pass']} passed, {stats['fail']} failed")
sys.exit(1 if stats["fail"] else 0)
PYTHON
python3 "$WORKDIR/bonus.py" "$WORKDIR/my_pgp"
status=$?

echo
echo "== mandatory functional suite on the bonus binary (retro-compat) =="
if [ -f "$ROOT/tests/functional_tests.sh" ]; then
    BONUS=1 QUICK=1 BIN="$BIN" sh "$ROOT/tests/functional_tests.sh" | tail -1
    [ "$(BONUS=1 QUICK=1 BIN="$BIN" sh "$ROOT/tests/functional_tests.sh" \
        >/dev/null 2>&1; echo $?)" -eq 0 ] || status=1
fi
exit $status
