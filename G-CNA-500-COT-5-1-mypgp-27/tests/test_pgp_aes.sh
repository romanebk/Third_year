#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_pgp_aes.sh
## File description:
## PGP-AES tests (J8-J9)
##

BIN="./my_pgp"
PASS=0
FAIL=0

KEY_AES=57696e74657220697320636f6d696e67
KEY_192="000102030405060708090a0b0c0d0e0f1011121314151617"
KEY_256="000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"
PUB_BIG="010001-c9f91a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8"\
"cd925de139a0076b962f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3"
PRIV_BIG="81b08f4eb6dd8a4dd21728e5194dfc4e349829c9991c8b5e44b31e6ceee1e5"\
"6a11d66ef23389be92ef7a4178470693f509c90b86d4a1e1831056ca0757f3e209-c9f9"\
"1a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8cd925de139a0076b962"\
"f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3"

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

echo "== PGP-AES -c -b : vecteur du sujet (2 lignes) =="
out=$(printf 'All men must die' | $BIN pgp-aes -c -b "$KEY_AES:$PUB_BIG")
line1=$(printf '%s' "$out" | head -1)
line2=$(printf '%s' "$out" | tail -1)
nlines=$(printf '%s\n' "$out" | grep -c '')
check "sortie sur 2 lignes" "2" "$nlines"
check "ligne 2 == cipher AES du sujet" \
    "744ce22c385958348f0df26eceb62eef" "$line2"
direct=$(printf '%s' "Winter is coming" | $BIN rsa -c "$PUB_BIG")
check "ligne 1 == chiffrement RSA direct de la cle" "$direct" "$line1"
out2=$(printf 'All men must die' | $BIN pgp-aes -c -b "$KEY_AES:$PUB_BIG")
check "chiffrement deterministe" "$out" "$out2"

echo
echo "== PGP-AES -d -b : roundtrip AES-128 =="
plain=$(printf '%s' "$line2" | $BIN pgp-aes -d -b "$line1:$PRIV_BIG")
check "roundtrip AES-128" "All men must die" "$plain"

echo
echo "== PGP-AES -b : roundtrip AES-192 et AES-256 =="
o192=$(printf '0123456789abcdef' | $BIN pgp-aes -c -b "$KEY_192:$PUB_BIG")
a1=$(printf '%s' "$o192" | head -1)
a2=$(printf '%s' "$o192" | tail -1)
check "roundtrip AES-192" "0123456789abcdef" \
    "$(printf '%s' "$a2" | $BIN pgp-aes -d -b "$a1:$PRIV_BIG")"
o256=$(printf '0123456789abcdef' | $BIN pgp-aes -c -b "$KEY_256:$PUB_BIG")
b1=$(printf '%s' "$o256" | head -1)
b2=$(printf '%s' "$o256" | tail -1)
check "roundtrip AES-256" "0123456789abcdef" \
    "$(printf '%s' "$b2" | $BIN pgp-aes -d -b "$b1:$PRIV_BIG")"

echo
echo "== PGP-AES stream : roundtrip (3 blocs exacts) =="
long_msg="0123456789abcdef0123456789abcdef0123456789abcdef"
stream=$(printf '%s' "$long_msg" | $BIN pgp-aes -c "$KEY_AES:$PUB_BIG")
k1=$(printf '%s' "$stream" | head -1)
k2=$(printf '%s' "$stream" | tail -1)
check "stream roundtrip 48 octets" "$long_msg" \
    "$(printf '%s' "$k2" | $BIN pgp-aes -d "$k1:$PRIV_BIG")"

echo
echo "== PGP-AES : cas d'erreur -> stderr + exit 84 =="
check_exit "cle sans deux-points" 84 \
    sh -c "printf 'hi' | $BIN pgp-aes -c keysanscolon"
check_exit "-g interdit en pgp" 84 $BIN pgp-aes -g d3 e3
check_exit "cle sym de 20 octets (invalide)" 84 \
    sh -c "printf 'hi' | $BIN pgp-aes -c 0011223344556677889900aabbccdde\
edd112233:$PUB_BIG"
check_exit "-b message de 3 octets (pas 16)" 84 \
    sh -c "printf 'abc' | $BIN pgp-aes -c -b $KEY_AES:$PUB_BIG"
check_exit "cle sym trop grande pour RSA" 84 \
    sh -c "printf 'All men must die' | $BIN pgp-aes -c -b $KEY_AES:0101-19bb"
check_exit "cle RSA sans tiret" 84 \
    sh -c "printf 'hi' | $BIN pgp-aes -c $KEY_AES:0101"
check_exit "message -d non hex" 84 \
    sh -c "printf 'ZZZZ' | $BIN pgp-aes -d 0101:$PRIV_BIG"

echo
echo "== PGP-AES : valgrind (aucune fuite) =="
if command -v valgrind >/dev/null 2>&1; then
    VG_LOG=/tmp/my_pgp_valgrind_pgp_aes.log
    printf 'All men must die' \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN pgp-aes -c -b "$KEY_AES:$PUB_BIG" \
            >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind -c -b sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind -c -b"
        cat $VG_LOG
    fi
    printf '%s' "$line2" \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN pgp-aes -d "$line1:$PRIV_BIG" \
            >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind -d stream sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind -d stream"
        cat $VG_LOG
    fi
    printf 'hi' \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN pgp-aes -c keysanscolon \
            >/dev/null 2>/dev/null
    if [ $? -eq 84 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind chemin d'erreur (84) sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind chemin d'erreur"
        cat $VG_LOG
    fi
else
    echo "[SKIP] valgrind absent"
fi

echo
echo "Résultat : $PASS OK / $FAIL KO"
[ "$FAIL" -eq 0 ]
