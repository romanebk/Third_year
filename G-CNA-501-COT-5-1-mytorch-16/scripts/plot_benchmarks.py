#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Graphiques comparatifs des benchmarks.
## Dépend de : benchmarks/results/benchmarks.csv
##

import csv
import os
import sys

DEFAULT_CSV = "benchmarks/results/benchmarks.csv"
DEFAULT_PNG = "benchmarks/plots/benchmarks.png"


def read_benchmarks(path):
    if not os.path.isfile(path):
        print("Error: %s introuvable" % path, file=sys.stderr)
        return None
    rows = []
    with open(path) as handle:
        for row in csv.DictReader(handle):
            if row.get("model"):
                rows.append(row)
    if not rows:
        print("Error: aucun benchmark dans %s" % path, file=sys.stderr)
        return None
    return rows


def column_values(rows, name):
    values = []
    for row in rows:
        try:
            values.append(float(row.get(name, 0.0) or 0.0))
        except ValueError:
            values.append(0.0)
    return values


def model_labels(rows):
    labels = []
    for row in rows:
        classes = row.get("classes")
        labels.append("%s\n(%s classes)" % (row["model"], classes) if classes else row["model"])
    return labels


def annotate(axes, bars, values, digits, suffix):
    for bar, value in zip(bars, values):
        text = ("%.*f" % (digits, value)).replace(".", ",") + suffix
        axes.text(bar.get_x() + bar.get_width() / 2, value, text,
                  ha="center", va="bottom", fontsize=9)


def draw_scores(axes, rows):
    positions = range(len(rows))
    width = 0.38
    accuracy = [100.0 * value for value in column_values(rows, "accuracy")]
    f1 = [100.0 * value for value in column_values(rows, "f1")]
    left = axes.bar([p - width / 2 for p in positions], accuracy, width,
                    color="#1f77b4", label="précision")
    right = axes.bar([p + width / 2 for p in positions], f1, width,
                     color="#2ca02c", label="F1 macro")
    annotate(axes, left, accuracy, 1, " %")
    annotate(axes, right, f1, 1, " %")
    axes.set_ylim(0, 108)
    axes.set_ylabel("%")
    axes.set_title("Qualité sur le jeu de test")
    axes.legend(loc="lower right")


def draw_times(axes, rows, column, factor, digits, suffix, title, ylabel):
    values = [value * factor for value in column_values(rows, column)]
    bars = axes.bar(range(len(rows)), values, 0.55, color="#ff7f0e")
    annotate(axes, bars, values, digits, suffix)
    axes.set_ylim(0, max(values) * 1.18 if values else 1)
    axes.set_ylabel(ylabel)
    axes.set_title(title)


def style(axes, labels):
    axes.set_xticks(range(len(labels)))
    axes.set_xticklabels(labels)
    axes.grid(True, axis="y")


def main(csv_path, png_path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("Error: matplotlib est requis (pip install matplotlib)", file=sys.stderr)
        return 84

    rows = read_benchmarks(csv_path)
    if rows is None:
        return 84
    labels = model_labels(rows)

    figure, axes = plt.subplots(1, 3, figsize=(14, 4.5))
    draw_scores(axes[0], rows)
    draw_times(axes[1], rows, "training_time_s", 1.0 / 60.0, 0, " min",
               "Temps d'entraînement", "minutes")
    draw_times(axes[2], rows, "inference_time_s", 1.0, 2, " s",
               "Temps d'inférence (72 303 positions)", "secondes")
    for panel in axes:
        style(panel, labels)

    figure.tight_layout()
    os.makedirs(os.path.dirname(png_path), exist_ok=True)
    figure.savefig(png_path, dpi=120)
    print("Benchmarks écrits dans %s" % png_path)
    return 0


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    png_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PNG
    sys.exit(main(csv_path, png_path))
