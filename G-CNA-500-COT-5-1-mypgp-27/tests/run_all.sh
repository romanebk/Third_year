#!/bin/sh
##
## EPITECH PROJECT, 2026
## run_all.sh
## File description:
## runs every test script of the project and reports a global status
##

failed=0

if [ ! -x ./my_pgp ]; then
    echo "my_pgp introuvable, lance 'make' avant les tests." >&2
    exit 1
fi

for script in tests/test_*.sh; do
    if [ ! -f "$script" ]; then
        continue
    fi
    echo "== $script =="
    if sh "$script"; then
        echo
    else
        failed=$((failed + 1))
        echo
    fi
done

if [ "$failed" -ne 0 ]; then
    echo "$failed script(s) en echec"
    exit 1
fi
echo "tous les scripts de test passent"
exit 0
