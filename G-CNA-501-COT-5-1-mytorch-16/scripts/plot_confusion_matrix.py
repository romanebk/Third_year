#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Trace la matrice de confusion à partir du CSV exporté.
## Dépend de : benchmarks/results/confusion_matrix.csv
##

import csv
import os
import sys

DEFAULT_CSV = "benchmarks/results/confusion_matrix.csv"
DEFAULT_PNG = "benchmarks/plots/confusion_matrix.png"


def read_matrix(path):
    if not os.path.isfile(path):
        print("Error: %s introuvable" % path, file=sys.stderr)
        return None
    with open(path) as handle:
        rows = [row for row in csv.reader(handle) if row]
    if len(rows) < 2:
        print("Error: matrice de confusion vide dans %s" % path, file=sys.stderr)
        return None
    labels = rows[0][1:]
    values = []
    for row in rows[1:]:
        values.append([int(cell) for cell in row[1:]])
    if len(values) != len(labels):
        print("Error: matrice de confusion non carrée dans %s" % path, file=sys.stderr)
        return None
    return labels, values


def title_of(path):
    """Titre lisible déduit du nom du fichier CSV."""
    if "full" in os.path.basename(path):
        return "Réseau full (5 classes) — validation"
    return "Réseau medium (3 classes) — validation"


def annotate(axes, matrix):
    """Écrit l'effectif et le pourcentage de chaque ligne dans les cases."""
    totals = [sum(row) for row in matrix]
    for i in range(len(matrix)):
        for j in range(len(matrix)):
            count = int(matrix[i][j])
            share = 100.0 * matrix[i][j] / totals[i] if totals[i] else 0.0
            axes.text(j, i, "%d\n(%.1f %%)" % (count, share), ha="center", va="center",
                      color="white" if matrix[i][j] > matrix.max() / 2 else "black")


def main(csv_path, png_path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        print("Error: matplotlib et numpy sont requis (pip install matplotlib numpy)",
              file=sys.stderr)
        return 84

    data = read_matrix(csv_path)
    if data is None:
        return 84
    labels, values = data
    matrix = np.array(values, dtype=float)

    figure, axes = plt.subplots(figsize=(7, 5.5))
    image = axes.imshow(matrix, cmap="Blues")
    figure.colorbar(image, ax=axes, label="nombre de positions")
    axes.set_xticks(range(len(labels)))
    axes.set_yticks(range(len(labels)))
    axes.set_xticklabels(labels, rotation=45, ha="right")
    axes.set_yticklabels(labels)
    axes.set_xlabel("classe prédite")
    axes.set_ylabel("classe réelle")
    axes.set_title(title_of(csv_path))
    annotate(axes, matrix)
    figure.tight_layout()
    os.makedirs(os.path.dirname(png_path), exist_ok=True)
    figure.savefig(png_path, dpi=120)
    print("Matrice de confusion écrite dans %s" % png_path)
    return 0


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    png_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PNG
    sys.exit(main(csv_path, png_path))
