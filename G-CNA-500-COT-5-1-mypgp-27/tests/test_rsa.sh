#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_rsa.sh
## File description:
## RSA tests (J5-J6)
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

echo "== RSA -g : petites clés du sujet (d3 e3) =="
out=$($BIN rsa -g d3 e3)
pub=$(echo "$out" | sed -n '1p')
priv=$(echo "$out" | sed -n '2p')
check "-g d3 e3 ligne 1 (publique)" "public key: 0101-19bb" "$pub"
check "-g d3 e3 ligne 2 (privée)" "private key: 9d5b-19bb" "$priv"

echo
echo "== RSA -g : grosses clés 256-bit du sujet =="
P=4b1da73924978f2e9c1f04170e46820d648edbee12ccf4d4462af89b080c86e1
Q=bb3ca1e126f7c8751bd81bc8daa226494efb3d128f72ed9f6cacbe96e14166cb
PUB="010001-c9f91a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8cd925de139a0076b962f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3"
PRIV="81b08f4eb6dd8a4dd21728e5194dfc4e349829c9991c8b5e44b31e6ceee1e56a11d66ef23389be92ef7a4178470693f509c90b86d4a1e1831056ca0757f3e209-c9f91a9ff3bd6d84005b9cc8448296330bd23480f8cf8b36fd4edd0a8cd925de139a0076b962f4d57f50d6f9e64e7c41587784488f923dd60136c763fd602fb3"
out=$($BIN rsa -g $P $Q)
pub=$(echo "$out" | sed -n '1p')
priv=$(echo "$out" | sed -n '2p')
check "-g 256-bit (publique)" "public key: $PUB" "$pub"
check "-g 256-bit (privée)" "private key: $PRIV" "$priv"

echo
echo "== RSA -c/-d : petit vecteur (WF) =="
cipher=$(printf "WF" | $BIN rsa -c 0101-19bb)
check "cipher WF" "8f84" "$cipher"
plain=$(printf "8f84" | $BIN rsa -d 9d5b-19bb)
check "decipher 8f84" "WF" "$plain"

echo
echo "== RSA -c/-d : gros vecteur (Night/terrors) =="
EXPECTED_CIPHER="445b349e7318ad6af16b0bbb718be88ba1c41751f95751cd58857f88fe31f970405c6ec3f16d79172543bf4e571b5596d212f3e79cd08ef14abd244e325b80"
big_cipher=$(echo "The night is dark and full of terrors" | $BIN rsa -c $PUB)
check "cipher Night/terrors" "$EXPECTED_CIPHER" "$big_cipher"
big_plain=$(printf "%s" "$big_cipher" | $BIN rsa -d $PRIV)
check "decipher roundtrip" "The night is dark and full of terrors" "$big_plain"

echo
echo "== RSA -c/-d : entrees limites =="
check "cipher message vide" "00" "$(printf '' | $BIN rsa -c 0101-19bb)"
check "decipher 00 -> ligne vide" "" "$(echo 00 | $BIN rsa -d 9d5b-19bb)"
check "decipher avec CR final" "WF" \
    "$(printf '8f84\r\n' | $BIN rsa -d 9d5b-19bb)"
check "decipher avec espaces" "WF" \
    "$(printf ' 8f 84 \n' | $BIN rsa -d 9d5b-19bb)"
check "decipher hex majuscule" "WF" "$(echo 8F84 | $BIN rsa -d 9d5b-19bb)"

echo
echo "== RSA : cas d'erreur -> stderr + exit 84 =="
check_exit "message trop grand pour la clé" 84 sh -c "printf 'un message beaucoup trop long pour cette petite cle' | $BIN rsa -c 0101-19bb"
check_exit "clé sans tiret" 84 sh -c "printf 'WF' | $BIN rsa -c sanstiret"
check_exit "-g hex invalide" 84 $BIN rsa -g zz e3
check_exit "-d hex invalide" 84 sh -c "printf 'zz' | $BIN rsa -d 9d5b-19bb"
check_exit "-d cipher >= n" 84 sh -c "printf 'ffffffff' | $BIN rsa -d 9d5b-19bb"

echo
echo "== RSA -g : P et Q supposes premiers sans verification (sujet p.6) =="
out=$($BIN rsa -g e3 d3)
check "-g e3 d3 (ordre inverse)" "public key: 0101-19bb
private key: 9d5b-19bb" "$out"
out=$($BIN rsa -g d3 d3)
check "-g d3 d3 (P == Q accepte)" "public key: 11-e9ad
private key: ad-e9ad" "$out"

echo
echo "Résultat : $PASS OK / $FAIL KO"
[ "$FAIL" -eq 0 ]
