#!/bin/bash
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Réentraîne models/medium.nn (réseau de démonstration).
## Dépend de : configs/medium_network.conf
##

set -u

MODEL=medium
CONF="configs/${MODEL}_network.conf"
NET="models/${MODEL}.nn"
PREDICTIONS="predictions_${MODEL}.txt"

cd "$(dirname "$0")/.." || exit 84

if [ ! -f "$CONF" ]; then
    echo "Error: $CONF introuvable" >&2
    exit 84
fi

# 1. Découpage 80/10/10 (graine 42), une seule fois.
if [ ! -f split/train.txt ] || [ ! -f split/test.txt ]; then
    ./scripts/make_split.sh dataset/ split/ || exit 84
    cat split/train/*.txt > split/train.txt || exit 84
    cat split/val/*.txt > split/val.txt || exit 84
    cat split/test/*.txt > split/test.txt || exit 84
fi

# 2. Réseau vierge (graine du .conf), puis entraînement.
#    L'augmentation par symétries est active par défaut ; MYTORCH_AUGMENT=0 la
#    désactive pour une mesure de référence.
mkdir -p models || exit 84
./my_torch_generator "$CONF" "$NET" || exit 84
#    --train sans --save réécrit LOADFILE au meilleur epoch de validation :
#    le réseau vierge généré ci-dessus est donc remplacé par le modèle entraîné.
OMP_NUM_THREADS="${OMP_NUM_THREADS:-4}" ./my_torch_analyzer --train "$NET" split/train.txt || exit 84

# 3. Évaluation sur le jeu de test, jamais vu à l'entraînement.
./my_torch_analyzer --predict "$NET" split/test.txt > "$PREDICTIONS" || exit 84
./scripts/evaluate.py "$PREDICTIONS" split/test.txt || exit 84

exit 0
