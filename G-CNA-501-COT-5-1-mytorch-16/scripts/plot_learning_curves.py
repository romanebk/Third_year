#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Trace les courbes d'apprentissage (perte, précision, F1) à partir du CSV.
## Dépend de : benchmarks/results/learning_curves.csv
##

import csv
import os
import sys

DEFAULT_CSV = "benchmarks/results/learning_curves.csv"
DEFAULT_PNG = "benchmarks/plots/learning_curves.png"


def read_curves(path):
    if not os.path.isfile(path):
        print("Error: %s introuvable" % path, file=sys.stderr)
        return None
    columns = {}
    with open(path) as handle:
        for row in csv.DictReader(handle):
            for key, value in row.items():
                columns.setdefault(key, []).append(float(value))
    if "epoch" not in columns or "validation_accuracy" not in columns:
        print("Error: colonnes 'epoch' ou 'validation_accuracy' absentes de %s" % path,
              file=sys.stderr)
        return None
    return columns


def best_epoch(columns):
    """Indice du meilleur epoch de validation."""
    accuracies = columns["validation_accuracy"]
    return max(range(len(accuracies)), key=lambda index: accuracies[index])


def draw_loss(axes, columns):
    axes.plot(columns["epoch"], columns["loss"], color="#1f77b4", linewidth=1.6)
    axes.set_xlabel("epoch")
    axes.set_ylabel("perte")
    axes.set_title("Perte d'entraînement (entropie croisée)")
    axes.grid(True)


def draw_accuracy(axes, columns, best):
    epochs = columns["epoch"]
    if "train_accuracy" in columns:
        axes.plot(epochs, columns["train_accuracy"], color="#888888", linestyle="--",
                  linewidth=1.4, label="entraînement")
    axes.plot(epochs, columns["validation_accuracy"], color="#1f77b4", linewidth=1.8,
              label="validation")
    if "validation_f1" in columns:
        axes.plot(epochs, columns["validation_f1"], color="#2ca02c", linestyle=":",
                  linewidth=1.6, label="F1 validation")
    axes.axvline(epochs[best], color="#d62728", linestyle="--", linewidth=1.2)
    axes.annotate("meilleur epoch : %d (%.1f %%)\nmodèle livré"
                  % (epochs[best], columns["validation_accuracy"][best] * 100),
                  xy=(epochs[best], columns["validation_accuracy"][best]),
                  xytext=(10, -30), textcoords="offset points", color="#d62728")
    axes.set_xlabel("epoch")
    axes.set_ylabel("taux de bonnes réponses")
    axes.set_title("Taux de bonnes réponses")
    axes.set_ylim(0.65, 1.0)
    axes.grid(True)
    axes.legend(loc="lower right")


def main(csv_path, png_path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("Error: matplotlib est requis (pip install matplotlib)", file=sys.stderr)
        return 84

    columns = read_curves(csv_path)
    if columns is None:
        return 84

    figure, axes = plt.subplots(1, 2, figsize=(12, 4.5))
    draw_loss(axes[0], columns)
    draw_accuracy(axes[1], columns, best_epoch(columns))
    figure.tight_layout()
    os.makedirs(os.path.dirname(png_path), exist_ok=True)
    figure.savefig(png_path, dpi=120)
    print("Courbes d'apprentissage écrites dans %s" % png_path)
    return 0


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    png_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PNG
    sys.exit(main(csv_path, png_path))
