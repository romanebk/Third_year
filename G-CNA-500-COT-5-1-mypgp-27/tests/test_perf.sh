#!/bin/sh
##
## EPITECH PROJECT, 2026
## test_perf.sh
## File description:
## RSA performance: keygen, cipher and decipher on 4096 and 8192 bit keys
##

BIN="./my_pgp"
LIMIT=2
PASS=0
FAIL=0
MSG="The night is dark and full of terrors"

# Primes of 2048 bits (4096-bit modulus) and 4096 bits (8192-bit modulus),
# generated with `openssl prime -generate` and written in little endian.
P2048="81c812ff22b2d28164c27d2a03ab4225618b5c89a87999541824fc7fe278c616"\
"56107503e604955a6759e6ac06d45afe84cbc6107422f15dafe3322d7d72c6ee"\
"70eade53d9372970ca93fb34a83162da0262eb2d65578fc4a3c84efdf16faf4a"\
"03e1f5c9b42d681770367137cb086a25154c6916cc51cd03ea1d0dd3c1f834f4"\
"fc2f609ec065ebbe3d64598ffec69338c55552f751e14008203d4c1e53925a9e"\
"ed5152d23eefa6f553b27a636056d1cb8dc439dad593b353044b8fd99ee7fcb7"\
"c5ef20017dda8bbbe7cbe7823bb4b2b8244e603e2621a0a5080e76e4eddfb543"\
"78224db05a6498c5daf96c774bc43274bee396629a6377b863d1d86981fed7d7"
Q2048="bd1f49eec8e1f183a8458ecf05f2ab17f28b17a5c7a79b3b972260dbd62ca712"\
"67d902fa9cbf8ae01766eac7a4c13715b3a4a6b4f024fc1cd5bba51abf9a606b"\
"8ff1dfa05252eb51ea28c81583a6b8694f5ec7dc1b12c75757436d9ab8da17cc"\
"680f9bc084d40acf92084bcd4fd58ef6366aec738386644ab499c05fd36a4c88"\
"907973350712079ece75eb692fd609172f3302d66633c2098ec1e04464aa7835"\
"d1e19f46054ad5ffb5b2096c04a250a6ba31f3fb213bc886651e973562d5e79c"\
"c5f2e74e5359b907e386e18dae47a6ffacde26d757bd017d9a560ef575a743fb"\
"c9f6f66280098d47a0371f8df68d4f0817508cf9ef9c0ce68a8afe814fa6c9d9"
P4096="69bbb616cbe0b878d874a037d596a7bb8301ebbb82dd08c6440ff20ab8070d89"\
"618813128b643bb7f61e366d945fcc3f6fe3f627ec8e8f1d96014f337dd6de5b"\
"7dede3a7e24f457f3a35aa1f9e788e819ee48c11c1a425e6f595f0b1ae99991e"\
"5b86d8e90dc79ab7275a79e7f3164f6ef891d55981bbddc44383726c22262929"\
"8d01f93bf6bd52a61b04ed247cad2aa6afb7dde7735f0b48ef0fc914664b61ef"\
"f95889f84dbec7ee22171fe9c12ea0f78eb2330243da94bc999649cd5bd131fe"\
"d0edba6b84278bbb865385e14aa62884039f744a8161149447c709ebfa005f8c"\
"4dc615e92538a880fb96e4037e7ea8ef6251af08253218b9f2b0a7a3c092f1b5"\
"d86ed467ea65ebe50529bca33abfe8718c331e74dd77828dbfefe7046a750df7"\
"17f514616eb38ea5d8febca82a8fbde483b13cb6de8d463cac887645313d5c72"\
"77c863d78b7e0358691a2bdce86a2dd33fb8687225e4bf2e75b0d0dfb2f28099"\
"eb4b2581b1e7d4d083f6218805e4f01ff87c89c0111c419174cbf5dc0f36d232"\
"4fc7778077f7acbff2a89bcaadb4ab0fe68199639eebae612bb3abc7d21aac68"\
"689b5b5a5e9a89478c493d0b6ac8357ba1dc69c87fa339341cd77f4e48141e2a"\
"b6a9a9c41337752d4084382072e2676ac9f45b2a49cb719b7ef1b8aae8b751c8"\
"6e69596153fdb27c50ce25277a1c8f405bb710bbb4604a1bbda3dc6ce97f00cb"
Q4096="419d86f20b02dd166775f9da41daf7838024f26e034bfc7c9af7e9d33569007d"\
"2e618bcad55b76ac7892681badec19a964c8a78c54ad25d157add42b47f7148e"\
"8730bff6efd7dc9f3ff555312cfc8fa92fe856855c71b60ebeff85610fba7361"\
"d33c565b5e173df79a57814829f19b78aaccde8bf34855ea866d10be2ac5f2cd"\
"34a4fb0b50fe78e68b0f36386776a1263de67fb8826eaa5faccfdbb90ca6c413"\
"cabd177e89c781e1d724c3fdc1df0fb0da1f8bd85ae7c97a855685a4c1a8509e"\
"27d596b91d1d5ec1906c938edd64e50fb3ee84600dc3c92c524906a7db099f09"\
"e6d5448c15370a579e7a3572d9dcb513b189e963e7c4d13cc62b4968a5738ce4"\
"bc6be83dc021f51f37bd8122c3de480e5608cf399113511dde86597d474d76ba"\
"45c7889c805288e7b179f65eb515156afa4a05cc4b3f4d8b8bd9aea0ecab0e94"\
"75eb7e12def92e0e4990486b477103537f194d899010a64ec51b965a29f3e4d3"\
"933b0ecdee42992382f237e81d7d4107fe0eba132e1fda67293dabdb60907d24"\
"6bf04516bccf8fcd07f2eb9ead42c35271d6f3253c4f210fb9cf35a29383c3c5"\
"252f6fd7036919b456520f0b5f656866322279274d4ab435254b208c332935df"\
"546f4bf8df2b4fc219cfa4ba5ac1e193493e17783f69270ef13dd196bdba4b33"\
"79cb198d275d90b715522ad933502d5d16f413597d6a3dab481086d202f0c6d0"

ok() {
    PASS=$((PASS + 1))
    echo "[PASS] $1"
}

ko() {
    FAIL=$((FAIL + 1))
    echo "[FAIL] $1"
}

# Runs one keygen + cipher + decipher cycle, each step under $LIMIT s.
perf_cycle() {
    label="$1"
    keys=$(timeout $LIMIT $BIN rsa -g "$2" "$3")
    if [ $? -ne 0 ]; then
        ko "$label : -g en moins de ${LIMIT}s"
        return
    fi
    ok "$label : -g en moins de ${LIMIT}s"
    pub=$(printf '%s\n' "$keys" | sed -n '1p' | cut -d' ' -f3)
    priv=$(printf '%s\n' "$keys" | sed -n '2p' | cut -d' ' -f3)
    cipher=$(echo "$MSG" | timeout $LIMIT $BIN rsa -c "$pub")
    if [ $? -ne 0 ]; then
        ko "$label : -c en moins de ${LIMIT}s"
        return
    fi
    ok "$label : -c en moins de ${LIMIT}s"
    plain=$(echo "$cipher" | timeout $LIMIT $BIN rsa -d "$priv")
    if [ $? -ne 0 ]; then
        ko "$label : -d en moins de ${LIMIT}s"
        return
    fi
    ok "$label : -d en moins de ${LIMIT}s"
    if [ "$plain" = "$MSG" ]; then
        ok "$label : roundtrip"
    else
        ko "$label : roundtrip"
    fi
}

if [ ! -x "$BIN" ]; then
    echo "my_pgp introuvable, lance 'make' avant les tests." >&2
    exit 1
fi
if ! command -v timeout >/dev/null 2>&1; then
    echo "timeout (coreutils) introuvable, tests de performance ignores."
    exit 0
fi

echo "== RSA : performances (limite ${LIMIT}s par etape) =="
perf_cycle "cle 4096 bits" "$P2048" "$Q2048"
perf_cycle "cle 8192 bits" "$P4096" "$Q4096"

echo
echo "Résultat : $PASS OK / $FAIL KO"
[ "$FAIL" -eq 0 ]
