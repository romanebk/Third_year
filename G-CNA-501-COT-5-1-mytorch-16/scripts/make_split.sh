#!/bin/bash
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Mélange et split 80/10/10 du dataset.
## Dépend de : dataset/
##

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "USAGE: ./scripts/make_split.sh INPUT_DIR OUTPUT_DIR [SEED]" >&2
    exit 84
fi

INPUT="$1"
OUTPUT="$2"
# Même graine => même découpage (reproductibilité exigée par le sujet).
SEED="${3:-42}"

if [ ! -d "$INPUT" ]; then
    echo "Error: $INPUT n'existe pas" >&2
    exit 84
fi

TMPDIR=$(mktemp -d)
mkdir -p "$OUTPUT/train" "$OUTPUT/val" "$OUTPUT/test"

# Mélange uniforme et reproductible.
#
# Attention : `shuf --random-source=<(yes "$SEED")` ne convient pas. Le flux
# fourni ne contient que trois valeurs d'octets distinctes ('4', '2', '\n'), ce
# qui biaise fortement les tirages de shuf : les positions restent groupées par
# nombre de pièces et le jeu de test ne ressemble plus à l'entraînement (37,6 %
# de positions à plus de 20 pièces dans le test contre 17,9 % dans
# l'entraînement, mesuré le 25/10). Le générateur de Python, semé par la graine,
# donne un mélange uniforme et reste déterministe.
shuffle_lines() {
    python3 -c 'import random, sys
random.seed(int(sys.argv[1]))
lines = sys.stdin.readlines()
random.shuffle(lines)
sys.stdout.writelines(lines)' "$SEED"
}

for class in nothing check checkmate; do
    if [ -d "$INPUT/$class" ]; then
        cat "$INPUT/$class"/*.txt 2>/dev/null | shuffle_lines > "$TMPDIR/$class.all"
        total=$(wc -l < "$TMPDIR/$class.all")
        train=$(awk "BEGIN {printf \"%d\", $total * 0.8}")
        val=$(awk "BEGIN {printf \"%d\", $total * 0.1}")
        head -n "$train" "$TMPDIR/$class.all" > "$OUTPUT/train/$class.txt"
        tail -n +$((train + 1)) "$TMPDIR/$class.all" | head -n "$val" > "$OUTPUT/val/$class.txt"
        tail -n +$((train + val + 1)) "$TMPDIR/$class.all" > "$OUTPUT/test/$class.txt"
    fi
done

# Contrôle : un découpage correct est indiscernable de l'original. On compare la
# répartition par nombre de pièces (<= 10, 11-20, > 20) de l'entraînement et du
# test ; un écart de plus de 3 points signale un mélange raté.
composition() {
    awk '{b = $1; p = 0
          for (i = 1; i <= length(b); i++) {c = substr(b, i, 1)
              if (c != "/" && !(c >= "1" && c <= "8")) p++}
          if (p <= 10) a++; else if (p <= 20) b2++; else c2++}
         END {t = a + b2 + c2
              printf "%.1f %.1f %.1f", 100 * a / t, 100 * b2 / t, 100 * c2 / t}' "$@"
}
read -r TRAIN_COMP <<< "$(composition "$OUTPUT"/train/*.txt)"
read -r TEST_COMP <<< "$(composition "$OUTPUT"/test/*.txt)"
if ! awk -v t="$TRAIN_COMP" -v e="$TEST_COMP" 'BEGIN {
        split(t, a, " "); split(e, b, " ")
        for (i = 1; i <= 3; i++) if (a[i] - b[i] > 3 || b[i] - a[i] > 3) exit 1
    }'; then
    echo "Attention : le découpage n'est pas homogène." >&2
    echo "  entraînement (<=10 / 11-20 / >20 pièces) : $TRAIN_COMP %" >&2
    echo "  test         (<=10 / 11-20 / >20 pièces) : $TEST_COMP %" >&2
fi

rm -rf "$TMPDIR"
echo "Split 80/10/10 réalisé dans $OUTPUT (graine $SEED)"
echo "  composition entraînement : $TRAIN_COMP % (<=10 / 11-20 / >20 pièces)"
echo "  composition test         : $TEST_COMP %"
exit 0
