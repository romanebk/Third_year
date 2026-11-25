#!/bin/bash
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Vérifie le rendu complet : compilation propre, tests unitaires, contrat CLI,
## prédictions sur les positions du sujet, indépendance du module mytorch.
## Dépend de : Makefile, my_torch_network.nn, models/*.nn, split/ (optionnel)
##
## Usage : ./scripts/check_release.sh [--no-clean]
##   --no-clean : réutilise build/ au lieu de faire make fclean d'abord.
##
## Sortie : 0 si tout passe, 1 sinon. Chaque ligne [OK] / [FAIL] est une preuve.
##

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd) || exit 1
cd "$ROOT" || exit 1

if [ "${1:-}" = "--no-clean" ]; then
    CLEAN=0
else
    CLEAN=1
fi

PASS=0
FAIL=0

# Un seul réseau livré à la racine (my_torch_network.nn, le full 5 classes) :
# l'autograder prend le premier my_torch_network*.nn trouvé. Les réseaux de
# démonstration (basic, medium) sont dans models/.
NN_BASIC="models/basic.nn"
NN_MEDIUM="models/medium.nn"
NN_FULL="my_torch_network.nn"

ok()  { PASS=$((PASS + 1)); printf '  [OK]   %s\n' "$1"; }
ko()  { FAIL=$((FAIL + 1)); printf '  [FAIL] %s\n' "$1"; }

section() { printf '\n== %s\n' "$1"; }

# Vérifie que la commande renvoie exactement le code attendu.
expect_code() {
    expected=$1
    label=$2
    shift 2
    "$@" >/dev/null 2>&1
    actual=$?
    if [ "$actual" -eq "$expected" ]; then
        ok "$label (code $expected)"
    else
        ko "$label (attendu $expected, obtenu $actual)"
    fi
}

# Vérifie qu'une sortie ne contient que des étiquettes autorisées.
check_labels() {
    file=$1
    label=$2
    if grep -Eqv '^(Nothing|Check|Checkmate|Check White|Check Black|Checkmate White|Checkmate Black)$' "$file"; then
        ko "$label : étiquette inconnue dans la sortie"
        sed -n '1,3p' "$file" | sed 's/^/         /'
    else
        ok "$label : étiquettes valides"
    fi
}

TMP=$(mktemp -d) || exit 1
trap 'rm -rf "$TMP"' EXIT

printf 'Rendu MyTorch — vérification complète\n'
printf 'Racine : %s\n' "$ROOT"

section "1. Compilation depuis zéro"
if [ "$CLEAN" -eq 1 ]; then
    make fclean >/dev/null 2>&1
fi
if make -j2 >"$TMP/build.log" 2>&1; then
    ok "make"
else
    ko "make (voir ci-dessous)"
    tail -20 "$TMP/build.log" | sed 's/^/         /'
fi
for f in my_torch_analyzer my_torch_generator libmytorch.a libchess.a; do
    [ -f "$f" ] && ok "$f présent" || ko "$f manquant"
done

section "2. Tests unitaires"
if make tests >"$TMP/tests.log" 2>&1; then
    ok "make tests ($(grep -c 'tous les tests passent' "$TMP/tests.log") suites)"
else
    ko "make tests"
    tail -20 "$TMP/tests.log" | sed 's/^/         /'
fi

section "3. Contrat CLI du sujet"
expect_code 0  "--help analyzer"               ./my_torch_analyzer --help
expect_code 0  "--help generator"              ./my_torch_generator --help
expect_code 84 "aucun argument"                ./my_torch_analyzer
expect_code 84 "option inconnue"               ./my_torch_analyzer --bogus
expect_code 84 "--predict incomplet"           ./my_torch_analyzer --predict
expect_code 84 "réseau absent"                 ./my_torch_analyzer --predict absent.nn /dev/null
expect_code 84 "fichier de positions absent"   ./my_torch_analyzer --predict "$NN_BASIC" absent.txt
expect_code 84 "--save en mode predict"        ./my_torch_analyzer --predict --save "$TMP/x.nn" "$NN_BASIC" /dev/null

# Les erreurs doivent partir sur stderr, pas sur stdout.
if [ -n "$(./my_torch_analyzer --predict "$NN_BASIC" absent.txt 2>/dev/null)" ]; then
    ko "message d'erreur écrit sur stdout"
else
    ok "message d'erreur sur stderr uniquement"
fi

section "4. Positions du sujet (5 FEN, sortie 1 ligne par position)"
cat > "$TMP/board5.txt" <<'EOF'
rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1
rnbqkbnr/pppp2pp/8/4pp1Q/3P4/4P3/PPP2PPP/RNB1KBNR b KQkq - 1 3
8/8/8/8/8/8/8/k1K5 w - - 0 1
EOF
for model in basic medium full; do
    case "$model" in
        basic)  net="$NN_BASIC" ;;
        medium) net="$NN_MEDIUM" ;;
        full)   net="$NN_FULL" ;;
    esac
    out="$TMP/$model.txt"
    ./my_torch_analyzer --predict "$net" "$TMP/board5.txt" > "$out" 2>/dev/null
    if [ "$(wc -l < "$out")" -eq 5 ]; then
        ok "$model : 5 lignes"
    else
        ko "$model : $(wc -l < "$out") ligne(s) au lieu de 5"
    fi
    check_labels "$out" "$model"
    printf '         %s\n' "$(tr '\n' '/' < "$out" | sed 's:/$::')"
done

section "5. Indépendance du module mytorch"
if ar t libmytorch.a | grep -Eq '^(Augment|Dataset|Fen|Labels)\.o$'; then
    ko "libmytorch.a contient des objets échecs"
else
    ok "libmytorch.a ne contient aucun objet échecs"
fi
if grep -rq '#include "chess' include/mytorch src/mytorch; then
    ko "un fichier mytorch inclut chess/"
else
    ok "aucun include chess/ dans mytorch"
fi
if grep -rqE '#include <(torch|tensorflow|Eigen|dlib|opencv)' include src tests; then
    ko "include d'une bibliothèque ML"
else
    ok "aucun include de bibliothèque ML"
fi
if ldd my_torch_analyzer 2>/dev/null | grep -Eqi 'torch|tensor|blas|lapack'; then
    ko "le binaire dépend d'une bibliothèque ML/BLAS"
else
    ok "aucune dépendance ML/BLAS à l'exécution"
fi

section "6. Entraînement de bout en bout (1 epoch, 200 positions)"
if [ -f split/train.txt ]; then
    cp configs/basic_network.conf "$TMP/smoke.conf"
    sed -i 's/^epochs[[:space:]]*=.*/epochs = 1/' "$TMP/smoke.conf"
    head -200 split/train.txt > "$TMP/mini.txt"
    expect_code 0 "génération d'un réseau" ./my_torch_generator "$TMP/smoke.conf" "$TMP/smoke.nn"
    expect_code 0 "entraînement --save"     ./my_torch_analyzer --train --save "$TMP/trained.nn" "$TMP/smoke.nn" "$TMP/mini.txt"
    cp "$TMP/smoke.nn" "$TMP/inplace.nn"
    before=$(md5sum "$TMP/inplace.nn" | cut -d' ' -f1)
    ./my_torch_analyzer --train "$TMP/inplace.nn" "$TMP/mini.txt" >/dev/null 2>&1
    after=$(md5sum "$TMP/inplace.nn" | cut -d' ' -f1)
    if [ "$before" != "$after" ]; then
        ok "sans --save, LOADFILE est réécrit"
    else
        ko "sans --save, LOADFILE n'est pas réécrit"
    fi
    ./my_torch_analyzer --predict "$TMP/trained.nn" "$TMP/mini.txt" > "$TMP/mini.out" 2>/dev/null
    if [ "$(wc -l < "$TMP/mini.out")" -eq 200 ]; then
        ok "prédiction : 200 sorties pour 200 positions"
    else
        ko "prédiction : $(wc -l < "$TMP/mini.out") sorties"
    fi
else
    printf '  [SKIP] split/train.txt absent (dataset non décompressé)\n'
fi

section "7. Évaluation sur le jeu de test"
if [ -f split/test.txt ]; then
    ./my_torch_analyzer --predict "$NN_MEDIUM" split/test.txt > "$TMP/pred.txt" 2>/dev/null
    if [ "$(wc -l < "$TMP/pred.txt")" -eq "$(wc -l < split/test.txt)" ]; then
        ok "72 303 prédictions pour 72 303 positions"
    else
        ko "nombre de prédictions incohérent"
    fi
    eval_out=$(python3 scripts/evaluate.py "$TMP/pred.txt" split/test.txt 2>/dev/null)
    acc=$(printf '%s\n' "$eval_out" | awk '/^accuracy:/ {print $2}')
    f1=$(printf '%s\n' "$eval_out" | awk '/^macro_f1:/ {print $2}')
    if awk -v a="$acc" 'BEGIN {exit !(a >= 0.80)}'; then
        ok "medium : accuracy $acc, F1 macro $f1"
    else
        ko "medium : accuracy $acc (< 0,80) ou évaluation cassée"
    fi
else
    printf '  [SKIP] split/test.txt absent\n'
fi

section "8. Propreté du dépôt"
if git grep -qE '^(<<<<<<<|>>>>>>>)' -- ':!*.pdf' 2>/dev/null; then
    ko "marqueurs de conflit dans le dépôt"
else
    ok "aucun marqueur de conflit"
fi
if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    ko "modifications non commitées"
else
    ok "arbre de travail propre"
fi

printf '\n----------------------------------------\n'
printf 'Résultat : %d OK, %d échec(s)\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
