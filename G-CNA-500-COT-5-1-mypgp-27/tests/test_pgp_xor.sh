#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_pgp_xor.sh
## File description:
## PGP-XOR tests (J8-J9)
##

BIN="./my_pgp"
PASS=0
FAIL=0

KEY_XOR=576861742069732064656164206d6179206e6576657220646965
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

echo "== PGP-XOR -c -b : vecteur du sujet (2 lignes) =="
out=$(printf 'You know nothing, Jon Snow' \
    | $BIN pgp-xor -c -b "$KEY_XOR:$PUB_BIG")
line1=$(printf '%s' "$out" | head -1)
line2=$(printf '%s' "$out" | tail -1)
nlines=$(printf '%s\n' "$out" | grep -c '')
check "sortie sur 2 lignes" "2" "$nlines"
check "ligne 2 == cipher XOR du sujet" \
    "20070f2700071c6a4449060a490515164e4e12190b190011063c" "$line2"
direct=$(printf '%s' "What is dead may never die" | $BIN rsa -c "$PUB_BIG")
check "ligne 1 == chiffrement RSA direct de la cle" "$direct" "$line1"
out2=$(printf 'You know nothing, Jon Snow' \
    | $BIN pgp-xor -c -b "$KEY_XOR:$PUB_BIG")
check "chiffrement deterministe" "$out" "$out2"

echo
echo "== PGP-XOR -d -b : roundtrip =="
plain=$(printf '%s' "$line2" | $BIN pgp-xor -d -b "$line1:$PRIV_BIG")
check "roundtrip grosse cle" "You know nothing, Jon Snow" "$plain"

echo
echo "== PGP-XOR -b : roundtrip petite cle (d3 e3) =="
small=$(printf 'AB' | $BIN pgp-xor -c -b "4142:0101-19bb")
s1=$(printf '%s' "$small" | head -1)
s2=$(printf '%s' "$small" | tail -1)
check "cipher sym 4142" "3422" "$s1"
check "cipher msg AB" "0303" "$s2"
small_back=$(printf '%s' "$s2" | $BIN pgp-xor -d -b "$s1:9d5b-19bb")
check "roundtrip petite cle" "AB" "$small_back"

echo
echo "== PGP-XOR stream : roundtrip =="
long_msg="This is a much longer message that spans multiple XOR blocks."
stream=$(printf '%s' "$long_msg" | $BIN pgp-xor -c "$KEY_XOR:$PUB_BIG")
k1=$(printf '%s' "$stream" | head -1)
k2=$(printf '%s' "$stream" | tail -1)
back=$(printf '%s' "$k2" | $BIN pgp-xor -d "$k1:$PRIV_BIG" \
    | head -c ${#long_msg})
check "stream roundtrip (tronque au padding)" "$long_msg" "$back"

echo
echo "== PGP-XOR : cle symetrique terminee par des octets nuls =="
KEY_Z=576861742069732064656164206d6179206e6576657220640000
out=$(printf 'You know nothing, Jon Snow' \
    | $BIN pgp-xor -c -b "$KEY_Z:$PUB_BIG")
c_sym=$(printf '%s' "$out" | head -1)
c_msg=$(printf '%s' "$out" | tail -1)
plain=$(printf '%s' "$c_msg" | $BIN pgp-xor -d -b "$c_sym:$PRIV_BIG")
check "-b roundtrip avec cle ...0000" "You know nothing, Jon Snow" "$plain"
KEY_Z=5768617400
out=$(printf 'You know nothing, Jon Snow' \
    | $BIN pgp-xor -c "$KEY_Z:$PUB_BIG")
c_sym=$(printf '%s' "$out" | head -1)
c_msg=$(printf '%s' "$out" | tail -1)
plain=$(printf '%s' "$c_msg" | $BIN pgp-xor -d "$c_sym:$PRIV_BIG" \
    | tr -d '\000')
check "stream roundtrip avec cle ...00" "You know nothing, Jon Snow" "$plain"

echo
echo "== PGP-XOR : cas d'erreur -> stderr + exit 84 =="
check_exit "cle sans deux-points" 84 \
    sh -c "printf 'hi' | $BIN pgp-xor -c keysanscolon"
check_exit "-b avec tailles differentes" 84 \
    sh -c "printf 'abc' | $BIN pgp-xor -c -b $KEY_XOR:0101-19bb"
check_exit "-g interdit en pgp" 84 $BIN pgp-xor -g d3 e3
check_exit "cle symetrique vide" 84 \
    sh -c "printf 'hi' | $BIN pgp-xor -c :0101-19bb"
check_exit "cle RSA sans tiret" 84 \
    sh -c "printf 'hi' | $BIN pgp-xor -c $KEY_XOR:010119bb"
check_exit "cle symetrique non hex" 84 \
    sh -c "printf 'hi' | $BIN pgp-xor -c ZZZZ:0101-19bb"
check_exit "message -d non hex" 84 \
    sh -c "printf 'ZZZZ' | $BIN pgp-xor -d 0101:0101-19bb"
check_exit "cle sym trop grande pour RSA" 84 \
    sh -c "printf 'hi' | $BIN pgp-xor -c $KEY_XOR:0101-19bb"

echo
echo "== PGP-XOR : valgrind (aucune fuite) =="
if command -v valgrind >/dev/null 2>&1; then
    VG_LOG=/tmp/my_pgp_valgrind_pgp_xor.log
    printf 'You know nothing, Jon Snow' \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN pgp-xor -c -b "$KEY_XOR:$PUB_BIG" \
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
            --log-file=$VG_LOG $BIN pgp-xor -d "$line1:$PRIV_BIG" \
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
            --log-file=$VG_LOG $BIN pgp-xor -c keysanscolon \
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
