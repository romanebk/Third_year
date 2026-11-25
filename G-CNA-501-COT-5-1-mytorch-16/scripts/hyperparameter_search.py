#!/usr/bin/env python3
##
## EPITECH PROJECT, 2026
## my_torch
## File description:
## Recherche aleatoire d'hyperparametres (random search), sans dependance ML.
## Dépend de : my_torch_generator, my_torch_analyzer, configs/medium_network.conf
##
## Usage :
##   ./scripts/hyperparameter_search.py [--trials N] [--epochs N]
##       [--max-positions N] [--data split/train.txt]
##       [--output benchmarks/results/hyperparameter_search.csv]
##
## Chaque essai écrit un .conf, génère un réseau vierge, l'entraîne sur un
## sous-échantillon du jeu d'entraînement, puis lit la meilleure précision de
## validation dans la sortie de l'analyseur. Le journal CSV permet de justifier
## le choix final devant le jury.

import argparse
import csv
import os
import random
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE_CONFIG = os.path.join(ROOT, "configs", "medium_network.conf")

HIDDEN_CHOICES = ["64 32", "128 64", "256 128 64", "128 128"]
BATCH_CHOICES = [64, 128, 256]
L2_CHOICES = [0.0, 0.0001, 0.001]
LEARNING_RATES = [0.01, 0.02, 0.03, 0.05, 0.08]


def fail(message):
    print("Error: %s" % message, file=sys.stderr)
    return 84


def replace_key(text, key, value):
    pattern = re.compile(r"^%s\s*=.*$" % re.escape(key), re.MULTILINE)
    replacement = "%s = %s" % (key, value)
    if not pattern.search(text):
        raise ValueError("clé absente du .conf : %s" % key)
    return pattern.sub(replacement, text)


def read_base_config():
    with open(BASE_CONFIG) as handle:
        return handle.read()


def write_config(path, base, trial):
    text = base
    text = replace_key(text, "hidden_sizes", trial["hidden_sizes"])
    text = replace_key(text, "epochs", trial["epochs"])
    text = replace_key(text, "batch_size", trial["batch_size"])
    text = replace_key(text, "learning_rate", trial["learning_rate"])
    text = replace_key(text, "l2", trial["l2"])
    text = replace_key(text, "dropout", 0.0)
    text = replace_key(text, "seed", trial["seed"])
    with open(path, "w") as handle:
        handle.write(text)


def sample_trial(rng, index, epochs, seed):
    return {
        "trial": index,
        "hidden_sizes": rng.choice(HIDDEN_CHOICES),
        "epochs": epochs,
        "batch_size": rng.choice(BATCH_CHOICES),
        "learning_rate": rng.choice(LEARNING_RATES),
        "l2": rng.choice(L2_CHOICES),
        "dropout": 0.0,
        "seed": seed + index,
    }


def make_subset(source, destination, max_positions, seed):
    with open(source) as handle:
        lines = handle.readlines()
    if not lines:
        raise ValueError("dataset vide : %s" % source)
    if max_positions <= 0 or max_positions >= len(lines):
        selected = lines
    else:
        selected = random.Random(seed).sample(lines, max_positions)
    with open(destination, "w") as handle:
        handle.writelines(selected)
    return len(selected)


def run_command(command, env, timeout):
    started = time.monotonic()
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
    )
    return result, time.monotonic() - started


def parse_best_epoch(stdout):
    best = None
    for line in stdout.splitlines():
        match = re.search(
            r"epoch\s+(\d+)/\d+\s+loss=\S+\s+train_acc=\S+\s+val_acc=([0-9.]+)\s+val_f1=([0-9.]+)",
            line,
        )
        if not match:
            continue
        epoch = int(match.group(1))
        accuracy = float(match.group(2))
        f1 = float(match.group(3))
        if best is None or accuracy > best["val_acc"]:
            best = {"epoch": epoch, "val_acc": accuracy, "val_f1": f1}
    return best


def run_trial(trial, args, subset, workdir, env, base):
    stem = os.path.join(workdir, "trial_%02d" % trial["trial"])
    config_path = stem + ".conf"
    init_path = stem + "_init.nn"
    model_path = stem + ".nn"
    write_config(config_path, base, trial)

    generator = [os.path.join(ROOT, "my_torch_generator"), config_path, init_path]
    generated, generator_seconds = run_command(generator, env, args.timeout)
    if generated.returncode != 0:
        return {
            **trial,
            "status": "generator_error",
            "best_epoch": "",
            "val_acc": "",
            "val_f1": "",
            "seconds": "%.2f" % generator_seconds,
            "error": generated.stderr.strip().replace("\n", " ")[:300],
        }

    trainer = [
        os.path.join(ROOT, "my_torch_analyzer"),
        "--train",
        "--save",
        model_path,
        init_path,
        subset,
    ]
    trained, train_seconds = run_command(trainer, env, args.timeout)
    best = parse_best_epoch(trained.stdout)
    if trained.returncode != 0 or best is None:
        return {
            **trial,
            "status": "train_error",
            "best_epoch": "",
            "val_acc": "",
            "val_f1": "",
            "seconds": "%.2f" % train_seconds,
            "error": trained.stderr.strip().replace("\n", " ")[:300],
        }
    return {
        **trial,
        "status": "ok",
        "best_epoch": best["epoch"],
        "val_acc": "%.6f" % best["val_acc"],
        "val_f1": "%.6f" % best["val_f1"],
        "seconds": "%.2f" % train_seconds,
        "error": "",
    }


def write_csv(path, rows):
    fields = [
        "trial",
        "hidden_sizes",
        "epochs",
        "batch_size",
        "learning_rate",
        "l2",
        "dropout",
        "seed",
        "status",
        "best_epoch",
        "val_acc",
        "val_f1",
        "seconds",
        "error",
    ]
    with open(path, "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def main():
    parser = argparse.ArgumentParser(
        description="Recherche aléatoire d'hyperparamètres pour my_torch."
    )
    parser.add_argument("--trials", type=int, default=8)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--max-positions", type=int, default=20000)
    parser.add_argument("--data", default=os.path.join(ROOT, "split", "train.txt"))
    parser.add_argument(
        "--output",
        default=os.path.join(ROOT, "benchmarks", "results", "hyperparameter_search.csv"),
    )
    parser.add_argument("--workdir", default=os.path.join(ROOT, "build", "hypersearch"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--timeout", type=int, default=1800)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.trials < 1 or args.epochs < 1 or args.max_positions < 0:
        return fail("trials et epochs doivent être > 0, max-positions >= 0")
    if not os.path.isfile(BASE_CONFIG):
        return fail("%s introuvable" % BASE_CONFIG)
    if not os.path.isfile(args.data):
        return fail("%s introuvable" % args.data)

    os.makedirs(args.workdir, exist_ok=True)
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    subset = os.path.join(args.workdir, "subset.txt")
    try:
        count = make_subset(args.data, subset, args.max_positions, args.seed)
    except (OSError, ValueError) as error:
        return fail(str(error))

    env = os.environ.copy()
    env["OMP_NUM_THREADS"] = str(args.threads)
    base = read_base_config()
    rng = random.Random(args.seed)

    print("Recherche aléatoire : %d essais, %d epochs, %d positions"
          % (args.trials, args.epochs, count))
    rows = []
    for index in range(1, args.trials + 1):
        trial = sample_trial(rng, index, args.epochs, args.seed)
        if args.dry_run:
            path = os.path.join(args.workdir, "trial_%02d.conf" % index)
            write_config(path, base, trial)
            rows.append({**trial, "status": "dry_run", "best_epoch": "",
                         "val_acc": "", "val_f1": "", "seconds": "", "error": ""})
            print("essai %d : %s" % (index, path))
            continue
        print("essai %d/%d : %s, lr=%s, l2=%s, batch=%s"
              % (index, args.trials, trial["hidden_sizes"], trial["learning_rate"],
                 trial["l2"], trial["batch_size"]))
        try:
            row = run_trial(trial, args, subset, args.workdir, env, base)
        except subprocess.TimeoutExpired:
            row = {**trial, "status": "timeout", "best_epoch": "", "val_acc": "",
                   "val_f1": "", "seconds": "", "error": "timeout"}
        rows.append(row)
        print("  -> %s val_acc=%s val_f1=%s (%ss)"
              % (row["status"], row["val_acc"] or "-", row["val_f1"] or "-",
                 row["seconds"] or "-"))

    write_csv(args.output, rows)
    print("Journal écrit dans %s" % args.output)
    valid = [row for row in rows if row["status"] == "ok"]
    if valid:
        best = max(valid, key=lambda row: float(row["val_acc"]))
        print("Meilleur essai : %d, hidden=%s, lr=%s, l2=%s, batch=%s, val_acc=%s"
              % (best["trial"], best["hidden_sizes"], best["learning_rate"],
                 best["l2"], best["batch_size"], best["val_acc"]))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("Interrompu.", file=sys.stderr)
        sys.exit(84)
    except Exception as error:  # garde-fou : pas de trace Python brute à la soutenance
        print("Error: %s" % error, file=sys.stderr)
        sys.exit(84)
