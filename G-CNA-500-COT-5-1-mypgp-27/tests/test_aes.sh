#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_aes.sh
## File description:
## AES tests: subject vector, NIST vectors, stream mode, error codes
##

BIN="./my_pgp"
KEY=57696e74657220697320636f6d696e67
VECTOR=744ce22c385958348f0df26eceb62eef
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

echo "== AES -b : vecteur officiel du sujet =="
ciphered=$(printf 'All men must die' | $BIN aes -c -b "$KEY")
check "cipher -b == vecteur du sujet" "$VECTOR" "$ciphered"

deciphered=$(printf '%s' "$VECTOR" | $BIN aes -d -b "$KEY")
check "decipher -b == message du sujet" "All men must die" "$deciphered"

roundtrip=$(printf 'All men must die' | $BIN aes -c -b "$KEY" \
    | $BIN aes -d -b "$KEY" | head -c 16)
check "roundtrip -c puis -d" "All men must die" "$roundtrip"

echo
echo "== AES -b : vecteurs NIST (SP 800-38A), nomenclature little-endian =="
# The subject writes every 32-bit word little endian: the program swaps
# each word of the key (before the schedule) and of the ciphered block,
# so a NIST plaintext is fed as is while key and expected cipher are
# byte-swapped word by word.
PT_NIST=$(printf '\153\301\276\342\056\100\237\226\351')\
$(printf '\075\176\021\163\223\027\052')

K128=16157e2ba6d2ae288815f7ab3c4fcf09
K192=f7b0738e52640eda2bf310c8e5799080d2eaf8627b6b2c52
K256=10eb3d60be71ca15f0ae732b81777d85072c351fd708613ba310982df4df1409
ciphered=$(printf '%s' "$PT_NIST" | $BIN aes -c -b "$K128")
check "AES-128 (cle 128 bits)" "b47bd73a60367a0df3ca9ea897ef6624" "$ciphered"

ciphered=$(printf '%s' "$PT_NIST" | $BIN aes -c -b "$K192")
check "AES-192 (cle 192 bits)" "1d4f33bd5ff2456e14a212f7cca51f57" "$ciphered"

ciphered=$(printf '%s' "$PT_NIST" | $BIN aes -c -b "$K256")
check "AES-256 (cle 256 bits)" "bdd1eef33ca0d2b57e5a4b06f881b13d" "$ciphered"

deciphered=$(printf 'b47bd73a60367a0df3ca9ea897ef6624' \
    | $BIN aes -d -b "$K128")
check "decipher AES-128 == plaintext NIST" "$PT_NIST" "$deciphered"

deciphered=$(printf '1d4f33bd5ff2456e14a212f7cca51f57' \
    | $BIN aes -d -b "$K192")
check "decipher AES-192 == plaintext NIST" "$PT_NIST" "$deciphered"

deciphered=$(printf 'bdd1eef33ca0d2b57e5a4b06f881b13d' \
    | $BIN aes -d -b "$K256")
check "decipher AES-256 == plaintext NIST" "$PT_NIST" "$deciphered"

echo
echo "== AES stream : roundtrip bloc après bloc =="
long_msg="Arya Stark has been assigned a secret mission in the free"
long_msg="$long_msg city of Pentos."
stream=$(printf '%s' "$long_msg" | $BIN aes -c "$KEY" \
    | $BIN aes -d "$KEY" | head -c ${#long_msg})
check "roundtrip stream (message plus long qu'un bloc)" "$long_msg" "$stream"

short_msg="Hi"
stream=$(printf '%s' "$short_msg" | $BIN aes -c "$KEY" \
    | $BIN aes -d "$KEY" | head -c ${#short_msg})
check "roundtrip stream (dernier bloc paddé de zéros)" "$short_msg" "$stream"

stream=$(printf '%s' "" | $BIN aes -c "$KEY" | $BIN aes -d "$KEY")
check "roundtrip stream (message vide)" "" "$stream"

echo
echo "== AES stream : sortie en hexadécimal =="
ciphered=$(printf '%s' "$long_msg" | $BIN aes -c "$KEY")
hex_len=${#ciphered}
blocks=$(( (${#long_msg} + 15) / 16 ))
check "32 caractères hex par bloc (${blocks} blocs)" \
    "$((blocks * 32))" "$hex_len"

check_exit "stream -d sur un hex qui n'est pas un multiple de 16 octets" 0 \
    sh -c "printf 'aabb' | $BIN aes -d $KEY"

echo
echo "== AES -d : blancs et CR ignores dans le nombre chiffre =="
out=$(printf '744ce22c 385958348f0df26eceb62eef\r\n' \
    | $BIN aes -d -b 57696e74657220697320636f6d696e67)
check "-d -b avec espace et CRLF" "All men must die" "$out"

echo
echo "== AES : erreurs (84 sur stderr) =="
check_exit "-b avec un message plus court qu'un bloc" 84 \
    sh -c "printf 'short' | $BIN aes -c -b $KEY"
check_exit "-b avec un message plus long qu'un bloc" 84 \
    sh -c "printf 'far too long for one block' | $BIN aes -c -b $KEY"
K14=00112233445566778899aabbccddee
K20=00112233445566778899aabbccddeeff00112233
check_exit "cle de 14 octets (112 bits)" 84 \
    sh -c "printf 'text' | $BIN aes -c -b $K14"
check_exit "cle de 20 octets (160 bits)" 84 \
    sh -c "printf 'text' | $BIN aes -c -b $K20"
check_exit "cle vide" 84 \
    sh -c "printf 'text' | $BIN aes -c -b ''"
check_exit "cle de longueur impaire" 84 \
    sh -c "printf 'text' | $BIN aes -c -b abc"
check_exit "cle non hexadecimale" 84 \
    sh -c "printf 'text' | $BIN aes -c -b zz"
check_exit "message -d non hexadecimal" 84 \
    sh -c "printf 'not-hex!' | $BIN aes -d -b $KEY"
check_exit "cle absente" 84 sh -c "$BIN aes -c"

echo
echo "== AES : valgrind (aucune fuite) =="
if command -v valgrind >/dev/null 2>&1; then
    VG_LOG=/tmp/my_pgp_valgrind_aes.log
    printf 'All men must die' \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN aes -c -b "$KEY" >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind -c -b sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind -c -b"
        cat $VG_LOG
    fi
    printf '%s' "Arya can keep a secret." | $BIN aes -c "$KEY" \
        | valgrind --quiet --error-exitcode=42 --leak-check=full \
            --log-file=$VG_LOG $BIN aes -d "$KEY" >/dev/null 2>/dev/null
    if [ $? -eq 0 ] && [ ! -s $VG_LOG ]; then
        PASS=$((PASS + 1))
        echo "[PASS] valgrind stream sans fuite"
    else
        FAIL=$((FAIL + 1))
        echo "[FAIL] valgrind stream"
        cat $VG_LOG
    fi
    printf 'x' | valgrind --quiet --error-exitcode=42 --leak-check=full \
        --log-file=$VG_LOG $BIN aes -c -b "$KEY" >/dev/null 2>/dev/null
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
echo "== AES stream : vecteur de régression sur 5 blocs =="
long_msg="The night is dark and full of terrors. Melisandre knows the ritual."
ciphered=$(printf '%s' "$long_msg" | $BIN aes -c "$KEY")
REF_LONG="af1c960216ed91a9d45cead5523cea40"
REF_LONG="$REF_LONG""712eab7c7d78cc87f8d819adfe5acc4d"
REF_LONG="$REF_LONG""a445dc14194e5092ef09903721617444"
REF_LONG="$REF_LONG""beacede347678122dca0017027dabf17"
REF_LONG="$REF_LONG""2b2386b5cdbb2746bb0e665f1eff8fda"
check "cipher de 67 octets == vecteur de référence" \
    "$REF_LONG" "$ciphered"

deciphered=$(printf '%s' "$ciphered" | $BIN aes -d "$KEY" \
    | head -c ${#long_msg})
check "decipher du vecteur de référence" "$long_msg" "$deciphered"

check "le vecteur fait 5 blocs (160 caractères hex)" 160 ${#ciphered}

echo
echo "== AES : message binaire et casse de la sortie =="
ciphered=$(printf '\000\001\002\003\377\376\375\374\177\200\201' | \
    $BIN aes -c "$KEY")
check "message binaire de 11 octets (bloc paddé)" \
    "4162bdb47d5bf55b01f78bfddc2d3a92" "$ciphered"
check "sortie binaire = 32 caractères hex" 32 ${#ciphered}

case "$ciphered" in
    *[!0-9a-f]*)
        FAIL=$((FAIL + 1))
        echo "[FAIL] sortie hexadécimale en minuscules : $ciphered" ;;
    *)
        PASS=$((PASS + 1))
        echo "[PASS] sortie hexadécimale en minuscules" ;;
esac

echo
echo "== AES : retour à la ligne final de l'entrée =="
with_lf=$(printf 'abc\n' | $BIN aes -c "$KEY")
without_lf=$(printf 'abc' | $BIN aes -c "$KEY")
check "le LF final du flux est retiré comme en -b" "$without_lf" "$with_lf"

check_exit "-b s'arrête au premier LF : message de 3 octets au lieu de 16" 84 \
    sh -c "printf 'abc\nrest is dropped\n' | $BIN aes -c -b $KEY"

check_exit "-b sur une entrée vide" 84 \
    sh -c "printf '' | $BIN aes -c -b $KEY"

echo
echo "== AES stream : roundtrip avec les clés 192 et 256 bits =="
KEY192=57696e74657220697320636f6d696e676461726b21212121
KEY256=57696e74657220697320636f6d696e676461726b20616e6420746572726f7273
msg="The old kings of Winter are watching from the crypts."

stream=$(printf '%s' "$msg" | $BIN aes -c "$KEY192" | $BIN aes -d "$KEY192" \
    | head -c ${#msg})
check "roundtrip AES-192 (56 octets)" "$msg" "$stream"

stream=$(printf '%s' "$msg" | $BIN aes -c "$KEY256" | $BIN aes -d "$KEY256" \
    | head -c ${#msg})
check "roundtrip AES-256 (56 octets)" "$msg" "$stream"

ciphered=$(printf '%s' "$msg" | $BIN aes -c "$KEY192")
check "AES-192 produit bien 4 blocs" 128 ${#ciphered}

echo
echo "AES : $PASS reussis, $FAIL echecs"
if [ "$FAIL" -ne 0 ]; then
    exit 1
fi
exit 0
