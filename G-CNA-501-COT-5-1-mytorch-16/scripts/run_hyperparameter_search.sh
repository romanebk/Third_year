#!/bin/bash
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Lance la recherche aléatoire d'hyperparamètres et conserve le journal CSV.
## Dépend de : scripts/hyperparameter_search.py
##

set -u

cd "$(dirname "$0")/.." || exit 84

exec python3 scripts/hyperparameter_search.py "$@"
