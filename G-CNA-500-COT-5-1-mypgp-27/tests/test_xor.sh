#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_xor.sh
## File description:
## XOR tests: subject vector, stream mode, error codes
##

BIN="./my_pgp"
KEY=576861742069732064656164206d6179206e6576657220646965
VECTOR=20070f2700071c6a4449060a490515164e4e12190b190011063c
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

echo "== XOR -b : vecteur exact du sujet =="
ciphered=$(printf '%s\n' "You know nothing, Jon Snow" | $BIN xor -c -b "$KEY")
check "cipher -b == vecteur du sujet" "$VECTOR" "$ciphered"

deciphered=$(printf '%s\n' "$VECTOR" | $BIN xor -d -b "$KEY")
check "decipher -b == message du sujet" \
    "You know nothing, Jon Snow" "$deciphered"

roundtrip=$(printf '%s\n' "You know nothing, Jon Snow" | $BIN xor -c -b "$KEY" \
    | $BIN xor -d -b "$KEY")
check "roundtrip -c puis -d" "You know nothing, Jon Snow" "$roundtrip"

echo
echo "== XOR stream : roundtrip multi-blocs =="
long_msg="Arya Stark has been assigned a secret mission in the free"
long_msg="$long_msg city of Pentos."
stream=$(printf '%s' "$long_msg" | $BIN xor -c "$KEY" \
    | $BIN xor -d "$KEY" | head -c ${#long_msg})
check "roundtrip stream (message > cle)" "$long_msg" "$stream"

short_msg="Hi"
stream=$(printf '%s' "$short_msg" | $BIN xor -c "$KEY" \
    | $BIN xor -d "$KEY" | head -c ${#short_msg})
check "roundtrip stream (dernier chunk paddé de zéros)" "$short_msg" "$stream"

stream=$(printf '%s' "" | $BIN xor -c "$KEY" | $BIN xor -d "$KEY")
check "roundtrip stream (message vide)" "" "$stream"

echo
echo "== XOR : sortie toujours terminée par un LF =="
raw=$(printf '%s\n' "You know nothing, Jon Snow" \
    | $BIN xor -c -b "$KEY" | od -c)
if printf '%s' "$raw" | grep -q '\\n'; then
    PASS=$((PASS + 1))
    echo "[PASS] sortie cipher en hex suivie de \n"
else
    FAIL=$((FAIL + 1))
    echo "[FAIL] sortie cipher sans \n"
fi

echo
echo "== XOR -d : blancs et CR ignores dans le nombre chiffre =="
out=$(printf '%s\r\n' "$VECTOR" | $BIN xor -d -b $KEY)
check "-d -b avec CRLF" "You know nothing, Jon Snow" "$out"

echo
echo "== XOR : erreurs (84 sur stderr) =="
check_exit "-b avec un message d'une autre taille que la cle" 84 \
    sh -c "printf '%s\n' 'too long message' | $BIN xor -c -b $KEY"
check_exit "cle vide" 84 \
    sh -c "printf '%s\n' 'text' | $BIN xor -c -b ''"
check_exit "cle de longueur impaire" 84 \
    sh -c "printf '%s\n' 'text' | $BIN xor -c -b abc"
check_exit "cle non hexadecimale" 84 \
    sh -c "printf '%s\n' 'text' | $BIN xor -c -b zz"
check_exit "message -d non hexadecimal" 84 \
    sh -c "printf '%s\n' 'not-hex!' | $BIN xor -d -b $KEY"
check_exit "cle absente" 84 sh -c "$BIN xor -c"
check_exit "systeme inconnu" 84 sh -c "printf 'x' | $BIN unknown -c 00"

echo
echo "== XOR : valgrind (aucune fuite) =="
if command -v valgrind >/dev/null 2>&1; then
    VG_LOG=/tmp/my_pgp_valgrind_xor.log
    printf '%s\n' "You know nothing, Jon Snow" \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN xor -c -b "$KEY" >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind -c -b sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind -c -b"
        cat $VG_LOG
    fi
    printf '%s' "Arya can keep a secret." | $BIN xor -c "$KEY" \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN xor -d "$KEY" >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind stream sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind stream"
        cat $VG_LOG
    fi
    printf '%s' "short" | valgrind --quiet --error-exitcode=42 \
        --leak-check=full --log-file=$VG_LOG $BIN xor -c -b "$KEY" \
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


echo "== XOR stream : vecteur de régression sur 3 chunks =="
long_msg="The Iron Throne is made of a thousand swords. Bend the knee or die."
ciphered=$(printf '%s' "$long_msg" | $BIN xor -c "$KEY")
REF_LONG="3107411144081e00170c41014e021311744e0b19"
REF_LONG="$REF_LONG""173b000101312348051a452b530e1701130b571e"
REF_LONG="$REF_LONG""411d4e0f16030a1a5444084557686174206973206465614a"
REF_LONG="$REF_LONG""4504055952014513001c4b440c0d"
check "cipher de 67 octets == vecteur de référence" \
    "$REF_LONG" "$ciphered"

deciphered=$(printf '%s' "$ciphered" | $BIN xor -d "$KEY" \
    | head -c ${#long_msg})
check "decipher du vecteur de référence" "$long_msg" "$deciphered"

echo
echo "== XOR : message binaire, casse de la sortie et LF final =="
ciphered=$(printf '\000\001\002\003\377\376\375\374\177\200\201' | \
    $BIN xor -c "$KEY")
check "message binaire de 11 octets (chunk paddé)" \
    "576861742069732064656164206d61f8a011998b9b8d23666865" "$ciphered"

case "$ciphered" in
    *[!0-9a-f]*)
        FAIL=$((FAIL + 1))
        echo "[FAIL] sortie hexadécimale en minuscules : $ciphered" ;;
    *)
        PASS=$((PASS + 1))
        echo "[PASS] sortie hexadécimale en minuscules" ;;
esac

with_lf=$(printf 'abc\n' | $BIN xor -c "$KEY")
without_lf=$(printf 'abc' | $BIN xor -c "$KEY")
check "le LF final du flux est retiré comme en -b" "$without_lf" "$with_lf"

check_exit "-b sur une entrée vide" 84 \
    sh -c "printf '' | $BIN xor -c -b $KEY"

echo
echo "XOR : $PASS reussis, $FAIL echecs"
if [ "$FAIL" -ne 0 ]; then
    exit 1
fi
exit 0
