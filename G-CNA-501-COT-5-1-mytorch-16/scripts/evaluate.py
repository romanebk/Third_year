#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Compare les predictions du réseau avec les étiquettes attendues.
## Dépend de : -
##
## Usage : ./scripts/evaluate.py PREDICTIONS_FILE LABELLED_FILE
##
## PREDICTIONS_FILE contient une étiquette par ligne (sortie de --predict).
## LABELLED_FILE contient les positions FEN avec leur étiquette (le jeu de test).
## Le script affiche la précision globale et le F1 par classe, d'abord sur les
## 3 classes de base, puis dans l'espace natif du réseau quand il est comparable
## (cas du mode full, qui prédit 5 étiquettes).

import sys
from collections import Counter


def read_labels(path):
    """Retourne la liste des étiquettes d'un fichier FEN + étiquette."""
    labels = []
    with open(path) as handle:
        for line in handle:
            parts = line.split()
            if len(parts) >= 7:
                labels.append(" ".join(parts[6:]))
    return labels


def read_predictions(path):
    """Retourne la liste des étiquettes prédites (une par ligne)."""
    with open(path) as handle:
        return [line.strip() for line in handle if line.strip()]


def basic_label(label):
    """Ramène une étiquette détaillée à sa classe de base."""
    if label.startswith("Checkmate"):
        return "Checkmate"
    if label.startswith("Check"):
        return "Check"
    return "Nothing"


def f1_of(counts, label, classes):
    """Précision, rappel et F1 d'une classe à partir de la matrice de confusion."""
    true_positives = counts[(label, label)]
    false_positives = sum(counts[(other, label)] for other in classes if other != label)
    false_negatives = sum(counts[(label, other)] for other in classes if other != label)
    predicted = true_positives + false_positives
    expected = true_positives + false_negatives
    precision = true_positives / predicted if predicted else 0.0
    recall = true_positives / expected if expected else 0.0
    if precision + recall == 0.0:
        return 0.0, precision, recall
    return 2 * precision * recall / (precision + recall), precision, recall


def report(counts, title):
    """Affiche la précision, le détail par classe et le F1 macro d'un espace."""
    total = sum(counts.values())
    classes = sorted({label for label, _ in counts})
    print("espace: %s" % title)
    print("positions: %d" % total)
    print("accuracy: %.4f" % (sum(counts[(label, label)] for label in classes) / total))
    f1_scores = []
    for label in classes:
        f1, precision, recall = f1_of(counts, label, classes)
        f1_scores.append(f1)
        support = sum(counts[(label, other)] for other in classes)
        print("%-16s precision=%.4f recall=%.4f f1=%.4f support=%d"
              % (label, precision, recall, f1, support))
    print("macro_f1: %.4f" % (sum(f1_scores) / len(f1_scores)))


def main(predictions_path, labels_path):
    try:
        predictions = read_predictions(predictions_path)
        expected = read_labels(labels_path)
    except OSError as error:
        print("Error: %s" % error, file=sys.stderr)
        return 84
    if len(predictions) != len(expected):
        print("Error: %d predictions pour %d positions" % (len(predictions), len(expected)),
              file=sys.stderr)
        return 84
    if not predictions:
        print("Error: aucune prediction", file=sys.stderr)
        return 84

    counts = Counter((basic_label(label), basic_label(prediction))
                     for prediction, label in zip(predictions, expected))
    report(counts, "3 classes de base")
    if set(predictions) <= set(expected):
        print()
        report(Counter(zip(expected, predictions)), "natif du réseau (%d classes)"
               % len(set(expected)))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("USAGE: ./scripts/evaluate.py PREDICTIONS_FILE LABELLED_FILE", file=sys.stderr)
        sys.exit(84)
    sys.exit(main(sys.argv[1], sys.argv[2]))
