#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Génère les tableaux Markdown (README §7, benchmarks/README §1) à partir des
## CSV et de test_evaluation.txt : aucun chiffre n'est saisi à la main.
##
## Usage : ./scripts/make_tables.py [benchmarks/results]
##

import csv
import re
import sys
from pathlib import Path

MODELS = ["basic", "medium", "full"]


def fr(x, d=0):
    """Nombre au format français : espace pour les milliers, virgule décimale."""
    return f"{x:,.{d}f}".replace(",", " ").replace(".", ",")


def pct(x):
    return fr(100 * x, 2) + " %"


def minutes(seconds):
    return f"{round(seconds / 60)} min"


def read_benchmarks(path):
    rows = {}
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows[r["model"]] = r
    missing = [m for m in MODELS if m not in rows]
    if missing:
        sys.exit(f"Error: {path} : modèle(s) absent(s) : {missing}")
    return rows


def read_test_evaluation(path):
    """Retourne le F1 macro natif 5 classes et la part de 'Nothing' au test."""
    text = Path(path).read_text(encoding="utf-8")
    native = re.search(
        r"espace: natif du réseau \(5 classes\)(.*?)(?:\n\n|\Z)", text, re.S)
    if not native:
        sys.exit(f"Error: {path} : bloc 'natif du réseau (5 classes)' introuvable")
    f1 = re.search(r"macro_f1:\s*([0-9.]+)", native.group(1))
    if not f1:
        sys.exit(f"Error: {path} : macro_f1 natif introuvable")
    block = re.search(
        r"predictions_basic\.txt.*?(?:\n\n|\Z)", text, re.S).group(0)
    n = int(re.search(r"positions:\s*(\d+)", block).group(1))
    nothing = int(re.search(r"Nothing .*?support=(\d+)", block).group(1))
    return float(f1.group(1)), nothing / n, n


def main():
    res = Path(sys.argv[1] if len(sys.argv) > 1 else "benchmarks/results")
    bench = read_benchmarks(res / "benchmarks.csv")
    native_f1, nothing_share, n_test = read_test_evaluation(
        res / "test_evaluation.txt")

    best_acc = max(float(bench[m]["accuracy"]) for m in MODELS)
    # Le F1 de `full` est projeté (astérisque) : il ne joue pas dans le gras.
    best_f1 = max(float(bench[m]["f1"]) for m in MODELS if m != "full")

    def bold(txt, val, best):
        return f"**{txt}**" if abs(val - best) < 1e-9 else txt

    print(f"### Tableau principal (benchmarks/README.md §1), test : {fr(n_test)} positions\n")
    print("| Réseau | Sortie | Classes | Paramètres | Précision | F1 macro | Entraînement | Inférence |")
    print("|--------|--------|---------|------------|-----------|----------|--------------|-----------|")
    for m in MODELS:
        r = bench[m]
        acc, f1 = float(r["accuracy"]), float(r["f1"])
        star = r"\*" if m == "full" else ""
        print(f"| `{m}` | {r['classes']} classes | {r['classes']} | "
              f"{fr(int(r['parameters']))} | {bold(pct(acc), acc, best_acc)} | "
              f"{pct(f1) if m == 'full' else bold(pct(f1), f1, best_f1)}{star} | "
              f"{minutes(float(r['training_time_s']))} | "
              f"{fr(float(r['inference_time_s']), 2)} s |")

    print("\n### Tableau README.md §7\n")
    print("| Réseau | Classes | Paramètres | Entraînement | Inférence | Précision | F1 macro |")
    print("|--------|---------|------------|--------------|-----------|-----------|----------|")
    for m in MODELS:
        r = bench[m]
        acc, f1 = float(r["accuracy"]), float(r["f1"])
        star = r"\*" if m == "full" else ""
        path = "my_torch_network.nn" if m == "full" else f"models/{m}.nn"
        print(f"| `{path}` | {r['classes']} | "
              f"{fr(int(r['parameters']))} | {minutes(float(r['training_time_s']))} | "
              f"{fr(float(r['inference_time_s']), 2)} s | "
              f"{bold(pct(acc), acc, best_acc)} | {pct(f1) if m == 'full' else bold(pct(f1), f1, best_f1)}{star} |")

    print("\n### Chiffres de la note de bas de tableau\n")
    print(f"- F1 macro natif 5 classes du réseau `full` (test) : {pct(native_f1)}")
    print(f"- Référence « toujours Nothing » : {pct(nothing_share)}")


if __name__ == "__main__":
    main()