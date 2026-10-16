#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_cli.sh
## File description:
## command line parsing: usage, arguments, error codes
##

BIN="./my_pgp"
PASS=0
FAIL=0

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

echo "== usage (-h) =="
check_exit "-h retourne 0" 0 $BIN -h

usage=$($BIN -h)
case "$usage" in
    *USAGE*) PASS=$((PASS + 1)); echo "[PASS] -h affiche USAGE" ;;
    *) FAIL=$((FAIL + 1)); echo "[FAIL] -h affiche USAGE" ;;
esac
case "$usage" in
    *\"xor\"*) PASS=$((PASS + 1)); echo "[PASS] -h documente xor" ;;
    *) FAIL=$((FAIL + 1)); echo "[FAIL] -h documente xor" ;;
esac
case "$usage" in
    *\"aes\"*) PASS=$((PASS + 1)); echo "[PASS] -h documente aes" ;;
    *) FAIL=$((FAIL + 1)); echo "[FAIL] -h documente aes" ;;
esac
case "$usage" in
    *-b*) PASS=$((PASS + 1)); echo "[PASS] -h documente l'option -b" ;;
    *) FAIL=$((FAIL + 1)); echo "[FAIL] -h documente l'option -b" ;;
esac

echo
echo "== arguments invalides (84) =="
check_exit "aucun argument" 84 $BIN
check_exit "crypto system seul" 84 $BIN xor
check_exit "crypto system inconnu" 84 $BIN unknown -c 00
check_exit "mode inconnu" 84 sh -c "printf 'x' | $BIN xor -x 00"
check_exit "clé absente" 84 sh -c "printf 'x' | $BIN xor -c"
check_exit "option -b seule, sans clé" 84 sh -c "printf 'x' | $BIN xor -b -c"
check_exit "argument en trop" 84 sh -c "printf 'x' | $BIN xor -c 00 extra"
check_exit "-g refusé pour xor" 84 $BIN xor -g 3 5
check_exit "-g refusé pour aes" 84 $BIN aes -g 3 5
check_exit "-g avec un seul premier nombre" 84 $BIN rsa -g 3
check_exit "rsa -c non implémenté" 84 sh -c "printf 'x' | $BIN rsa -c 00"
check_exit "pgp-xor non implémenté" 84 sh -c "printf 'x' | $BIN pgp-xor -c 00"
check_exit "pgp-aes non implémenté" 84 sh -c "printf 'x' | $BIN pgp-aes -c 00"

echo
echo "== ordre libre de MODE, OPTIONS et key =="
K=576861742069732064656164206d6179206e6576657220646965
M="You know nothing, Jon Snow"
REF=20070f2700071c6a4449060a490515164e4e12190b190011063c
check "xor -b -c KEY" "$REF" "$(printf '%s' "$M" | $BIN xor -b -c $K)"
check "xor -c KEY -b" "$REF" "$(printf '%s' "$M" | $BIN xor -c $K -b)"
check "rsa -b -g P Q" "public key: 0101-19bb" \
    "$($BIN rsa -b -g d3 e3 | head -1)"
check_exit "deux MODE (-c -d)" 84 sh -c "printf 'x' | $BIN xor -c -d 00"
check_exit "-g suivi d'une clé" 84 $BIN rsa -g d3 e3 0101-19bb
check_exit "-g puis -c" 84 $BIN rsa -g d3 e3 -c
check_exit "-b sans MODE" 84 sh -c "printf 'x' | $BIN xor -b 00"
check_exit "clé sans MODE" 84 sh -c "printf 'x' | $BIN xor 00"

echo
echo "== flux de sortie =="
out=$(sh -c "printf 'x' | $BIN unknown -c 00 2>/dev/null")
check "les erreurs n'écrivent rien sur la sortie standard" "" "$out"

out=$($BIN -h 2>/dev/null | head -1)
check "-h écrit sur la sortie standard" "USAGE" "$out"

check_exit "xor -c avec une clé valide renvoie 0" 0 \
    sh -c "printf 'text' | $BIN xor -c 00"

err=$(sh -c "printf 'x' | $BIN unknown -c 00 2>&1 >/dev/null")
case "$err" in
    *error*) PASS=$((PASS + 1)); echo "[PASS] l'erreur part sur stderr" ;;
    *) FAIL=$((FAIL + 1)); echo "[FAIL] l'erreur part sur stderr : $err" ;;
esac

echo
echo "== valgrind sur la ligne de commande =="
if command -v valgrind >/dev/null 2>&1; then
    VG_LOG=/tmp/my_pgp_valgrind_cli.log
    valgrind --quiet --error-exitcode=42 --leak-check=full \
        --log-file=$VG_LOG $BIN unknown -c 00 >/dev/null 2>/dev/null
    if [ $? -eq 84 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind erreur de parsing sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind erreur de parsing"
        cat $VG_LOG
    fi
    printf 'text' | valgrind --quiet --error-exitcode=42 --leak-check=full \
        --log-file=$VG_LOG $BIN xor -c 00 >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind xor -c sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind xor -c"
        cat $VG_LOG
    fi
else
    echo "[SKIP] valgrind absent"
fi

echo
echo "CLI : $PASS reussis, $FAIL echecs"
if [ "$FAIL" -ne 0 ]; then
    exit 1
fi
exit 0
