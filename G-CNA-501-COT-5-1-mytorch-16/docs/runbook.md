# runbook.md

> **Responsable** : Ariel + Divine · **Semaine** : 3 · **Dépend de** : Makefile, scripts/, configs/, docs/NN_FILE_FORMAT.md, docs/TEAM_WORKFLOW.md

**Rôle** : Mode d'emploi opérationnel du projet. Quelqu'un qui n'a jamais vu le
projet doit pouvoir refaire toutes les étapes en suivant ce fichier seul.

## 1. Prérequis et installation

| Outil | Version | Usage |
|-------|---------|-------|
| g++ | 13 (C++17 obligatoire) | compilation |
| make | 4+ | build |
| python3 | 3.10+ | scripts d'analyse et graphiques |
| matplotlib, numpy | récents | **uniquement** les graphiques (optionnels) |

```bash
sudo apt install build-essential python3 python3-pip
pip install matplotlib numpy        # optionnel : seulement pour les .png
```

Dataset : `dataset.zip` est fourni à part (source exacte à confirmer ; le sujet
exige seulement de conserver les scripts et datasets et de pouvoir les montrer).
Il est conservé localement à la racine du dépôt et se décompresse dans
`dataset/` (3 dossiers `nothing/`, `check/`, `checkmate/`, chacun avec
`10_pieces.txt`, `20_pieces.txt`, `many_pieces.txt`), soit 723 019 positions.
**Ni `dataset.zip` ni `dataset/` ne sont versionnés** (`.gitignore`) : ils sont
montrés à la soutenance.

Vérification de l'environnement :

```bash
g++ --version | head -1          # doit afficher 13.x
make                             # doit compiler sans warning
./my_torch_generator --help 2>&1 | head -3
```

## 2. Compiler

| Commande | Effet |
|----------|-------|
| `make` | compile `libmytorch.a` + `libchess.a` + `my_torch_analyzer` + `my_torch_generator` |
| `make re` | recompile tout depuis zéro (`make fclean` puis `make`) |
| `make clean` | supprime `build/` (objets et exécutables de test) ; garde les archives et les deux binaires |
| `make fclean` | supprime **tout** (`build/`, `libmytorch.a`, `libchess.a`, les deux binaires) |
| `make tests` | compile et exécute toutes les suites de tests |
| `./scripts/check_release.sh` | vérifie build, tests, contrat CLI, positions du sujet et indépendance du module |
| `make debug` | recompile avec `-fsanitize=address,undefined` et lance les tests |

Le produit matriciel est parallélisé avec **OpenMP** et compilé avec
`-march=native` (AVX2/FMA). Options utiles :

| Commande | Effet |
|----------|-------|
| `make OPENMP=0` | compilation sans OpenMP (machine sans `libgomp`) |
| `make NATIVE=0` | binaire portable, sans instructions spécifiques au CPU |
| `make re` | obligatoire après tout changement de `OPENMP` ou `NATIVE` (make ne suit pas les flags) |

Pour l'entraînement, régler le nombre de threads sur le nombre de **cœurs
physiques** : `export OMP_NUM_THREADS=4`. Sur la machine de développement
(4 cœurs / 8 threads logiques), 8 threads ralentissent l'entraînement.

> **Pas de `make bonus`** : cette cible n'existe pas. Le bonus de parallélisme
> est intégré au cœur (`Matrix::operator*`, OpenMP) et se pilote avec
> `OPENMP=1` / `OMP_NUM_THREADS` ; `bonus/README.md` documente les mesures et
> les bonus non livrés.

> **Piège** : après un `make debug`, la bibliothèque est compilée avec les
> sanitizers. Un `make tests` lancé juste après réutilise les exécutables de test
> déjà construits et passe, mais dès qu'un fichier de test est modifié, il est
> recompilé sans sanitizers et le link échoue (`undefined reference to
> __asan_...`). Il faut lancer `make fclean` avant de rebasculer en release.

Artefacts produits : `libmytorch.a` (moteur générique, sans aucune dépendance
aux échecs), `libchess.a` (FEN, dataset, labels, augmentation),
`my_torch_analyzer` (CLI
d'entraînement et de prédiction), `my_torch_generator` (création de réseau).

## 3. Utiliser le projet

### 3.1 Générer un réseau vierge

```bash
./my_torch_generator configs/basic_network.conf models/basic.nn
# Réseau créé : models/basic.nn (6 couches, 3 classes)

# syntaxe de l'exemple du sujet : un lot de N réseaux numérotés
./my_torch_generator configs/basic_network.conf 3
# Réseau créé : basic_network_1.nn ... basic_network_3.nn
```

Le fichier `.conf` décrit l'architecture et les hyperparamètres
(`docs/NN_FILE_FORMAT.md`). En mode lot, la graine du `.conf` est incrémentée
pour chaque réseau (les fichiers ne sont donc pas identiques) et les noms sont
dérivés du nom du `.conf`, sans son extension. Erreur **84** si le `.conf` est
absent, illisible ou incomplet, ou si le nombre demandé n'est pas un entier
strictement positif (maximum 10 000 par appel).

### 3.2 Entraîner

```bash
# --train sans --save : réécrit le fichier .nn chargé
./my_torch_analyzer --train models/basic.nn split/train.txt

# --train avec --save : écrit un nouveau fichier et laisse l'original intact
./my_torch_analyzer --train --save models/basic_v2.nn models/basic.nn split/train.txt
```

Sortie sur stdout : une ligne par epoch

```
epoch 1/150 loss=0.757900 train_acc=0.705322 val_acc=0.701976 val_f1=0.699530
```

(format illustratif ; les valeurs dépendent du réseau et de la graine)

À côté du réseau écrit, trois CSV sont produits :

| Fichier | Contenu |
|---------|---------|
| `<reseau>.curves.csv` | courbes d'apprentissage (perte, précision train, précision et F1 de validation) |
| `<reseau>.confusion.csv` | matrice de confusion (classe réelle × classe prédite) |
| `<reseau>.metrics.csv` | précision, rappel, F1 et support par classe |

Pendant l'entraînement de `medium` et `full`, chaque position est transformée
par une symétrie de l'échiquier tirée au hasard (miroir, inversion des couleurs,
ou les deux) : le réseau voit quatre orientations de chaque position, avec la même
classe (l'inversion des couleurs retourne aussi l'échiquier ; correction du
27/10/2026, voir `docs/DESIGN_CHOICES.md` §18 et `./scripts/audit_augmentation.py`).
**Attention** : les réseaux `medium` et `full` du dépôt ont été réentraînés le
5/11/2026 avec la version corrigée ; réentraîner avec `./scripts/train_medium.sh` /
`train_full.sh` suit la même procédure (même graine, même split).
La validation n'est jamais transformée. Le `basic` est entraîné sans
augmentation (§4).

### 3.3 Prédire

```bash
./my_torch_analyzer --predict models/basic.nn split/test.txt
```

Sortie sur stdout : **une ligne par position, dans l'ordre du fichier** :

```
Nothing
Check
Checkmate
```

En mode `full` (5 classes), les libellés sont `Nothing`, `Check White`,
`Check Black`, `Checkmate White`, `Checkmate Black`.

`--save` est refusé en mode `--predict` (code 84). Toute erreur est écrite sur
**stderr** et le programme se termine avec le code **84** ; `--help` renvoie 0.

### 3.4 Réseaux pré-entraînés

| Fichier | Classes | Architecture | Usage |
|---------|---------|--------------|-------|
| `models/basic.nn` | 3 | 773 → 64 → 32 → 3 | rendu de référence, démonstration rapide |
| `models/medium.nn` | 3 | 773 → 256 → 128 → 64 → 3 | meilleur compromis précision / temps |
| `my_torch_network.nn` | 5 | 773 → 256 → 128 → 64 → 5 | couleur du camp qui donne l'échec (l'opposé du camp qui a le trait) |

## 4. Réentraîner le réseau final de A à Z

Le plus simple : un script par réseau, qui découpe, génère, entraîne et évalue.

```bash
./scripts/train_basic.sh     # ~15 min (sans augmentation)
./scripts/train_medium.sh    # ~66 min
./scripts/train_full.sh      # ~56 min
```

Les mêmes étapes à la main :

```bash
# 1. Découper le dataset en 80 / 10 / 10 (train / val / test)
#    graine 42 par défaut : même graine = même découpage (3e argument : autre graine)
#    Le script affiche la répartition par nombre de pièces de chaque lot : elle
#    doit être la même des deux côtés (sinon le mélange est raté).
./scripts/make_split.sh dataset/ split/
cat split/train/*.txt > split/train.txt
cat split/val/*.txt   > split/val.txt
cat split/test/*.txt  > split/test.txt

# 2. Générer le réseau vierge
./my_torch_generator configs/medium_network.conf models/medium.nn

# 3. Entraîner (graine 42, elle est dans le .conf)
#    sans --save, le réseau vierge chargé est réécrit au meilleur epoch de
#    validation ; avec --save SAVEFILE, il faudrait aussi passer LOADFILE
OMP_NUM_THREADS=4 ./my_torch_analyzer --train models/medium.nn split/train.txt

# 4. Évaluer sur le jeu de test, jamais vu à l'entraînement
./my_torch_analyzer --predict models/medium.nn split/test.txt > predictions.txt
./scripts/evaluate.py predictions.txt split/test.txt
```

- **Graine** : 42 (champ `seed` du `.conf`, stocké dans le `.nn`).
- **Augmentation** : active par défaut (miroir et inversion des couleurs) pour
  `medium` et `full`. `scripts/train_basic.sh` la désactive
  (`MYTORCH_AUGMENT=0`) : le réseau 64-32 sous-entraîne avec l'augmentation. Le
  commutateur ne change rien à la prédiction.
- **Protocole** : 150 epochs, L2 = 0 pour `basic`, L2 = 1e-3 pour `medium` et
  `full`, augmentation activée pour ces deux derniers, `OMP_NUM_THREADS=4`
  (machine à 4 cœurs / 8 threads, `g++ -O3`).
- **Durée** : environ 15 min pour `basic`, 66 min pour `medium` et 56 min pour
  `full` sur le dataset complet (578 415 positions dans `split/train.txt`, dont
  90 % servent à l'entraînement et 10 % à la validation), avec
  `OMP_NUM_THREADS=4`. Ce sont des temps muraux, sensibles à la charge.
- **Mémoire** : environ 2 Go pour le dataset complet en mémoire.
- Le découpage 80/10/10 garantit qu'aucune position de test n'apparaît dans
  l'entraînement : la validation qui pilote le meilleur epoch est interne à
  `split/train.txt` (10 % de ce fichier, soit 57 841 positions), le test est un
  fichier séparé. Le lot `split/val.txt` (10 % du dataset) n'est pas utilisé par
  les modèles livrés : il reste disponible pour une validation externe.

### 4.1 Recherche aléatoire d'hyperparamètres

```bash
./scripts/run_hyperparameter_search.sh --trials 40 --epochs 30 --max-positions 20000
```

Le script `scripts/hyperparameter_search.py` tire des architectures et des
hyperparamètres dans `configs/medium_network.conf`, entraîne chaque essai sur un
sous-échantillon de `split/train.txt` et écrit
`benchmarks/results/hyperparameter_search.csv`. Il est reproductible
(`--seed 42`, défaut) et utilise les mêmes binaires que l'analyseur : aucune
bibliothèque ML n'est ajoutée.

## 5. Tester et valider

```bash
make fclean && make tests        # toutes les suites doivent passer
make fclean && make debug        # ASan + UBSan : aucune fuite, aucun UB
```

Check-list avant fusion dans `dev` puis dans `main` (mise à jour 07/11/2026) :

- [ ] `make` ne produit **aucun warning** (`-Wall -Wextra`).
- [ ] `make tests` est vert (13 suites).
- [ ] `make debug` est vert (sanitizers).
- [ ] une entrée invalide renvoie **84** et n'écrit rien sur stdout.
- [ ] `--predict` donne **une ligne par position, dans l'ordre**.
- [ ] un réseau sauvegardé puis rechargé donne **les mêmes prédictions**.
- [ ] aucun binaire, aucun `.o` et aucun dataset versionné (`git status`).

Comportement attendu par l'autograder : le réseau est chargé par l'analyseur, la
sortie contient une ligne par échiquier dans l'ordre du fichier d'entrée.

## 6. Benchmarks et graphiques

```bash
# Réentraînement + courbes (le .nn chargé est réécrit au meilleur epoch)
./my_torch_analyzer --train models/medium.nn split/train.txt

# Graphiques (matplotlib requis ; code 84 et message si absent)
./scripts/plot_learning_curves.py benchmarks/results/learning_curves.csv benchmarks/plots/learning_curves.png
./scripts/plot_confusion_matrix.py benchmarks/results/confusion_matrix.csv benchmarks/plots/confusion_matrix.png
./scripts/plot_benchmarks.py benchmarks/results/benchmarks.csv benchmarks/plots/benchmarks.png
```

Les CSV bruts sont dans `benchmarks/results/`, les images dans
`benchmarks/plots/`. Les résultats chiffrés et les commandes exactes sont
décrits dans `benchmarks/README.md`.

## 7. Workflow git au quotidien

Voir `docs/TEAM_WORKFLOW.md`. En résumé : une branche de tâche créée depuis
`origin/dev`, un commit par fichier (message en anglais, une ligne), relecture
croisée, fusion dans `dev`, `dev` vers `main` à chaque jalon validé.

En cas de conflit : `git merge --abort`, prévenir l'autre membre, puis refaire la
fusion ensemble. Après résolution, `make fclean && make && make tests` doit être
vert.

## 8. Dépannage

| Symptôme | Cause probable | Correction |
|----------|----------------|------------|
| La compilation échoue sur un en-tête | include manquant | vérifier le `#include` et le chemin `-Iinclude` |
| `undefined reference to __asan_...` | la lib a été compilée avec les sanitizers | `make fclean && make tests` |
| Le programme renvoie 84 | une erreur a été levée | le message est sur **stderr** : fichier absent, FEN mal formée, arguments manquants |
| Le `.nn` ne se charge pas | magic ou version différents, ou fichier tronqué | régénérer le réseau ; `docs/NN_FILE_FORMAT.md` décrit le format |
| La perte ne baisse pas | learning rate trop petit, ou réseau trop petit | augmenter `learning_rate`, vérifier les courbes |
| La perte devient NaN | learning rate trop grand | le gradient est moyenné sur le lot : réduire `learning_rate` (0.05 max) |
| La perte explose puis revient | learning rate trop grand avec momentum | réduire `learning_rate` ou `momentum` dans le `.conf` |
| Overfitting (la validation baisse) | données trop nombreuses pour la capacité | L2, plus de données, dropout (non implémenté côté cœur de réseau) |
| Bonne accuracy mais classe rare mal détectée | classes déséquilibrées | `Dataset::getClassWeights()` / `balanceClasses()`, regarder la matrice de confusion |
| Entraînement trop lent | batch trop petit, dataset complet | augmenter `batch_size`, sous-échantillonner |
| Résultats non reproductibles | graine ou ordre des données | `seed` dans le `.conf`, le dataset est mélangé avec cette graine |

## 9. Livraison et soutenance

- [ ] sources complètes, `Makefile`, `README.md`, `docs/` à jour ;
- [ ] `models/basic.nn`, `models/medium.nn` et
      `my_torch_network.nn` poussés dans le dépôt ;
- [ ] scripts d'entraînement et de tracé conservés dans `scripts/` ;
- [ ] bonus isolés dans `bonus/` ;
- [ ] aucun binaire, aucun fichier temporaire, aucun dataset versionné.

À montrer à la soutenance : le dataset, le découpage, la commande d'entraînement,
les courbes d'apprentissage, la matrice de confusion, et la justification de
chaque choix (`docs/DESIGN_CHOICES.md`).

## 10. Contacts et historique

| Domaine | Responsable |
|---------|-------------|
| Cœur de réseau (`Matrix`, `Layer`, `Dense`, activations, `Network`, `Loss`, `Optimizer`, `Trainer`) | Ariel |
| Données chess (FEN, labels, dataset), `.nn`/`.conf`, générateur, analyseur, métriques, CSV, documentation | Divine |

| Date | Modification |
|------|--------------|
| 20/10 | première version : compilation, tests, format `.nn` |
| 22/10 | modes `--train` / `--predict`, export CSV, scripts de tracé |
| 22/10 | momentum dans les hyperparamètres (format `.nn` version 2), `scripts/evaluate.py` |
