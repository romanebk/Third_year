#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_elgamal.sh
## File description:
## ElGamal tests: key generation, fixed vector, roundtrips, error codes
##

BIN="./my_pgp"
PASS=0
FAIL=0

P=d5da1a8d443812956185f9fe2d8696ea4959d3415967c7a8c5fec34bf7dd53e1
X=57696e74657220697320636f6d696e67
PUB="ae9b6b28d237d46772426e34dcdc544d1a0d922246c4a674657f74aea2b2d8a9-$P"
PRIV="$X-$P"
C1=91c5adc3f0dec06e93c3eb3b2365740ce784ecf2a25f1a38f23ae3f1dbd7a823
C2=31c86a0f0c0961ce53532ac6c5135b288918dca16b17ef148c0cc8974cd36c9e

check() {
    description="$1"
    expected="$2"
    actual="$3"
    if [ "$actual" = "$expected" ]; then
        PASS=$((PASS + 1))
        echo "[PASS] $description"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] $description"
        echo "       attendu : $expected"
        echo "       obtenu  : $actual"
    fi
}

check_exit() {
    description="$1"
    expected_exit="$2"
    shift 2
    "$@" >/dev/null 2>/dev/null
    actual_exit=$?
    if [ "$actual_exit" -eq "$expected_exit" ]; then
        PASS=$((PASS + 1))
        echo "[PASS] $description"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] $description (exit=$actual_exit, attendu=$expected_exit)"
    fi
}

if [ ! -x "$BIN" ]; then
    echo "my_pgp introuvable, lance 'make' avant les tests." >&2
    exit 1
fi

echo "== ElGamal -g : petites et grandes cles (Y = 2^X mod P) =="
out=$($BIN elgamal -g e3 05)
check "-g e3 05" "public key: 20-e3
private key: 05-e3" "$out"
out=$($BIN elgamal -g $P $X)
check "-g 256-bit" "public key: $PUB
private key: $PRIV" "$out"

echo
echo "== ElGamal -d : vecteur calcule avec K fixe =="
plain=$(echo "$C1-$C2" | $BIN elgamal -d "$PRIV")
check "decipher vecteur fixe" "All men must die" "$plain"

echo
echo "== ElGamal -c : chiffrement aleatoire et roundtrip =="
c_a=$(echo "Winter is coming" | $BIN elgamal -c "$PUB")
c_b=$(echo "Winter is coming" | $BIN elgamal -c "$PUB")
if [ "$c_a" != "$c_b" ]; then
    PASS=$((PASS + 1)); echo "[PASS] deux chiffrements different (K aleatoire)"
else
    FAIL=$((FAIL + 1)); echo "[FAIL] deux chiffrements identiques"
fi
check "roundtrip 1" "Winter is coming" \
    "$(echo "$c_a" | $BIN elgamal -d "$PRIV")"
check "roundtrip 2" "Winter is coming" \
    "$(echo "$c_b" | $BIN elgamal -d "$PRIV")"
check "roundtrip message vide" "" \
    "$(printf '' | $BIN elgamal -c "$PUB" | $BIN elgamal -d "$PRIV")"

echo
echo "== ElGamal : cas d'erreur -> stderr + exit 84 =="
check_exit "-g X = 0" 84 $BIN elgamal -g e3 00
check_exit "-g X = P - 1" 84 $BIN elgamal -g e3 e2
check_exit "-g P trop petit" 84 $BIN elgamal -g 03 01
check_exit "-g sans X" 84 $BIN elgamal -g e3
check_exit "message trop grand" 84 \
    sh -c "printf 'trop long pour la cle' | $BIN elgamal -c 20-e3"
check_exit "cle sans tiret" 84 sh -c "printf 'x' | $BIN elgamal -c 20e3"
check_exit "paire chiffree sans tiret" 84 \
    sh -c "echo 1234 | $BIN elgamal -d 05-e3"
check_exit "paire chiffree hors de Z/pZ" 84 \
    sh -c "echo ff-01 | $BIN elgamal -d 05-e3"

echo
echo "Résultat : $PASS OK / $FAIL KO"
[ "$FAIL" -eq 0 ]
