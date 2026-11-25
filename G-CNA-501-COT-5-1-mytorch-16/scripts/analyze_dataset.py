#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Analyse du dataset et vérification du sens de la couleur des étiquettes
## Dépend de : dataset/
##

import os
import sys
from collections import Counter

CLASSES = ("nothing", "check", "checkmate")


def parse_label(parts):
    """Les étiquettes font un ou deux mots : 'Nothing', 'Check White', 'Checkmate Black'."""
    if parts[-1] == "Nothing":
        return "Nothing"
    if parts[-2] in ("Check", "Checkmate"):
        return parts[-2] + " " + parts[-1]
    return parts[-1]


def label_class(label):
    """Classe attendue ('check', 'checkmate', 'nothing') déduite de l'étiquette."""
    return label.split()[0].lower()


def analyze(path):
    if not os.path.isdir(path):
        print("Error: %s n'existe pas" % path, file=sys.stderr)
        return 84

    counts = Counter()
    side_to_label = Counter()
    folder_errors = 0
    color_errors = 0
    total = 0

    for root, _dirs, files in os.walk(path):
        folder = os.path.basename(root).lower()
        for name in sorted(files):
            if not name.endswith(".txt"):
                continue
            with open(os.path.join(root, name), errors="replace") as handle:
                for line in handle:
                    parts = line.split()
                    if len(parts) < 7:
                        continue
                    label = parse_label(parts)
                    total += 1
                    counts[label] += 1
                    if folder in CLASSES and label_class(label) != folder:
                        folder_errors += 1
                    if label != "Nothing":
                        side_to_label[(parts[1], label)] += 1
                        expected = "White" if parts[1] == "b" else "Black"
                        if not label.endswith(expected):
                            color_errors += 1

    print("Total de positions lues : %d" % total)
    print("\nRépartition par classe :")
    for key, value in sorted(counts.items()):
        print("  %-16s %8d" % (key, value))
    print("\nRépartition par camp (couleur de l'étiquette) :")
    for key, value in sorted(side_to_label.items()):
        print("  trait=%s -> %-16s %8d" % (key[0], key[1], value))

    print("\nVérifications :")
    print("  étiquette incompatible avec le dossier : %d" % folder_errors)
    print("  couleur incohérente avec le trait      : %d" % color_errors)
    print("  -> la couleur de l'étiquette est celle du camp qui DONNE l'échec/mat,")
    print("     c'est-à-dire l'opposé du trait : le roi attaqué est celui du camp qui a le trait.")
    if color_errors == 0 and folder_errors == 0:
        print("  RESULTAT : coherent sur 100% des positions.")
        return 0
    print("  RESULTAT : incohérences detectees, a corriger avant l'entrainement.")
    return 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("USAGE: ./scripts/analyze_dataset.py DATASET_DIR", file=sys.stderr)
        sys.exit(84)
    sys.exit(analyze(sys.argv[1]))
