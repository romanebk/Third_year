# Benchmarks — détection d'échec aux échecs

Ce dossier contient les chiffres du rendu, les commandes qui les produisent et
les graphiques. **Tous les chiffres cités ici proviennent des fichiers
`benchmarks/results/`**, régénérables avec le dataset et les commandes du §6.

Les prédictions utilisent une **test-time augmentation** : chaque position est
présentée dans les quatre symétries exactes de l'échiquier (identité, miroir,
inversion des couleurs, les deux), et les probabilités sont moyennées. Le coût
est de quatre passes avant par position ; le gain est de 3 à 3,6 points de
précision sur le jeu de test.

## En bref

- **93,05 %** des 72 303 positions de test sont correctement classées par
  `models/medium.nn` (Nothing / Check / Checkmate), avec un F1 macro de
  **92,50 %**. Un modèle qui répondrait toujours `Nothing` plafonnerait à
  **41,49 %** de précision.
- Le réseau `basic` (1 couche cachée, 51 715 paramètres) atteint 87,26 % en
  15 min ; le `medium` (3 couches, 239 491 paramètres) gagne **5,79 points** pour
  66 min. Le gain est réel, mais il coûte cher en calcul.
- Le mode `full` (5 classes : Nothing, Check/Checkmate par couleur) classe
  presque aussi bien en 3 classes (93,00 %) et obtient **91,53 %** de F1 macro
  dans son espace natif de 5 classes.

## 1. Tableau principal

Jeu de test : 72 303 positions jamais utilisées à l'entraînement. Prédictions
avec test-time augmentation (quatre symétries moyennées).

| Réseau | Sortie | Classes | Paramètres | Précision | F1 macro | Entraînement | Inférence |
|--------|--------|---------|------------|-----------|----------|--------------|-----------|
| `basic` | 3 classes | 3 | 51 715 | 87,26 % | 86,62 % | 15 min | 3,33 s |
| `medium` | 3 classes | 3 | 239 491 | **93,05 %** | **92,50 %** | 66 min | 8,36 s |
| `full` | 5 classes | 5 | 239 621 | 93,00 % | 92,44 %\* | 56 min | 9,10 s |

\* F1 macro calculé après projection des 5 classes sur les 3 classes de base
(`Nothing`, `Check`, `Checkmate`), pour comparer les trois réseaux sur le même
espace. Dans son espace natif de 5 classes, le réseau `full` obtient un F1 macro
de **91,53 %** — détail dans [`results/test_evaluation.txt`](results/test_evaluation.txt).

**Définitions.**

- *Précision* : positions correctement classées / 72 303.
- *F1 macro* : moyenne **non pondérée** des F1 de chaque classe. C'est la
  métrique suivie, car le jeu de test est déséquilibré (Nothing 41,49 %,
  Check 34,48 %, Checkmate 24,03 %) : la précision seule récompense un modèle qui
  se concentre sur `Nothing`.
- *Inférence* : `--predict` sur les 72 303 positions, chargement du `.nn`,
  lecture des FEN et quatre passes de test-time augmentation compris.

**Références.** Un modèle constant qui répond `Nothing` obtient 41,49 % de
précision et 19,55 % de F1 macro. Un tirage uniforme entre les 3 classes
obtiendrait 33,33 % de précision. Le réseau `medium` apporte donc **+51,6 points**
de précision par rapport au modèle constant.

## 2. Protocole

| Élément | Valeur |
|---------|--------|
| Dataset | 723 019 positions FEN étiquetées (`dataset/check`, `checkmate`, `nothing`) |
| Découpage | 80 / 10 / 10 **par classe**, mélange aléatoire (`scripts/make_split.sh`) |
| Entraînement | 520 574 positions (90 % de `split/train.txt`) |
| Validation | 57 841 positions (10 % de `split/train.txt`) |
| Test | 72 303 positions (fichier séparé) |
| Encodage | 773 valeurs : 64 cases × 12 pièces (one-hot) + trait + 4 droits de roque |
| Sortie | 3 classes (`basic`, `medium`) ou 5 classes (`full`) |
| Optimiseur | SGD + momentum 0,9, pas 0,05, mini-batchs de 128 |
| Durée | 150 epochs, fixés dans le `.conf` et le `.nn` |
| Modèle livré | meilleur epoch de **validation** |
| Prédiction | test-time augmentation : moyenne des 4 symétries exactes de l'échiquier (4 passes avant) |
| Régularisation | `basic` : L2 = 0, sans augmentation ; `medium` et `full` : L2 = 1e-3, augmentation par symétries (version corrigée du 27/10/2026) |
| Matériel | x86-64, 4 cœurs / 8 threads, `g++ -O3`, `OMP_NUM_THREADS=4` |

> **Note sur l'augmentation.** Les réseaux `medium` et `full` livrés ont été
> réentraînés le 5/11/2026 avec la version corrigée de l'inversion des couleurs,
> qui retourne aussi l'échiquier : un échec donné par un pion conserve désormais
> son étiquette (vérifié à 100,00 % sur 120 000 positions par
> `scripts/audit_augmentation.py`). Les chiffres de ce dossier décrivent donc bien
> le code actuel. Détail et mesures : `docs/DESIGN_CHOICES.md` §18. Le `basic`
> n'est pas concerné (entraîné sans augmentation).

**Rôle des trois jeux de données.**

1. *Entraînement* : les gradients ne sont calculés que sur ces positions.
2. *Validation* : 10 % du fichier d'entraînement, mis de côté par l'analyseur
   (`src/analyzer/TrainMode.cpp`). Sert uniquement à choisir le modèle et à
   tracer les courbes ; jamais utilisé pour mettre à jour les poids.
3. *Test* : fichier distinct, lu **une seule fois** à la fin, pour les chiffres
   de ce document.

**Sélection du modèle.** `my_torch_analyzer --train` réécrit le `.nn` à chaque
amélioration de la précision de validation ; le fichier livré est donc celui du
meilleur epoch de validation (117 pour `basic`, 133 pour `medium`, 142 pour
`full`). Le jeu de test n'intervient jamais dans ce choix. Avec l'augmentation et
le L2, le `medium` culmine à l'epoch 133 (90,08 % de validation, F1 89,45 %) puis
se stabilise ; le `basic`, sans régularisation, culmine à l'epoch 117 (83,72 %)
puis se dégrade légèrement.

## 3. Résultats détaillés

Les métriques par classe des §3.1 et §3.2 sont celles du rapport de **validation**
écrit pendant l'entraînement (une passe avant, sans test-time augmentation) :
elles décrivent la sélection du meilleur epoch. Les chiffres de **test** du §3.3
incluent la test-time augmentation, comme le prédicteur livré.

### 3.1 Réseau medium, par classe (validation, 57 841 positions)

Source : [`results/class_metrics.csv`](results/class_metrics.csv) (écrit
automatiquement par `--train`).

| Classe | Précision | Rappel | F1 | Support |
|--------|-----------|--------|----|---------|
| Nothing | 0,956 | 0,943 | 0,950 | 24 127 |
| Check | 0,881 | 0,846 | 0,863 | 20 001 |
| Checkmate | 0,837 | 0,907 | 0,871 | 13 713 |

`Check` est la classe la plus difficile : c'est la frontière entre `Nothing`
(aucune attaque) et `Checkmate` (attaque imparable). Les erreurs vont donc
presque toutes de `Check` vers `Checkmate` (ou l'inverse), très rarement vers
`Nothing` :

- 925 `Check` prédits `Nothing` et 2 157 `Check` prédits `Checkmate` ;
- 1 159 `Checkmate` prédits `Check`, mais seulement 118 prédits `Nothing`.

### 3.2 Réseau full, par classe (validation, 5 classes)

Source : [`results/class_metrics_full.csv`](results/class_metrics_full.csv).

| Classe | Précision | Rappel | F1 | Support |
|--------|-----------|--------|----|---------|
| Nothing | 0,947 | 0,948 | 0,948 | 24 127 |
| Check White | 0,854 | 0,874 | 0,864 | 10 740 |
| Check Black | 0,883 | 0,852 | 0,868 | 9 261 |
| Checkmate White | 0,869 | 0,864 | 0,866 | 7 472 |
| Checkmate Black | 0,870 | 0,883 | 0,876 | 6 241 |

La couleur du camp en échec est apprise sans biais marqué : après réentraînement
avec l'augmentation corrigée, les deux couleurs sont équilibrées (F1 0,864 contre
0,868 pour `Check`, 0,866 contre 0,876 pour `Checkmate`, soit moins d'un point
d'écart). Le jeu de validation contient légèrement moins de positions où les
noirs sont en échec (9 261 contre 10 740). L'encodage one-hot ne fournit aucune
notion de « côté » : le réseau exploite des motifs de position (cases occupées)
et non une règle abstraite « le roi est attaqué » ; c'est une conséquence directe
du format d'entrée imposé par le sujet.

### 3.3 Métriques par classe sur le jeu de test

Source : [`results/test_evaluation.txt`](results/test_evaluation.txt). Le script
`scripts/evaluate.py` affiche les mêmes métriques sur le jeu de test, d'abord
projetées sur les 3 classes de base, puis dans l'espace natif quand il est
comparable (cas du `full`). Ces chiffres incluent la test-time augmentation.

| Réseau | Précision test | F1 macro 3 classes | F1 macro natif |
|--------|----------------|--------------------|----------------|
| `basic` | 87,26 % | 86,62 % | — |
| `medium` | **93,05 %** | **92,50 %** | — |
| `full` | 93,00 % | 92,44 % | **91,53 %** (5 classes) |

Sur le `full`, la couleur seule (positions où le camp est en échec ou mat) est
prédite à **98,44 %** ; l'accuracy exacte sur les cinq libellés est de 93,00 %.

## 4. Graphiques

| Image | Ce qu'on y voit |
|-------|-----------------|
| [`plots/learning_curves.png`](plots/learning_curves.png) | perte d'entraînement, précision d'entraînement, précision et F1 de validation, epoch par epoch (réseau medium) ; trait vertical = meilleur epoch livré |
| [`plots/confusion_matrix.png`](plots/confusion_matrix.png) | matrice de confusion 3 × 3 (medium, validation) : effectif et pourcentage de chaque ligne |
| [`plots/confusion_matrix_full.png`](plots/confusion_matrix_full.png) | matrice de confusion 5 × 5 (full, validation) |
| [`plots/benchmarks.png`](plots/benchmarks.png) | précision et F1 par réseau, temps d'entraînement (min) et d'inférence (s) |

**Lecture des courbes d'apprentissage.** La précision de validation du `medium`
monte de 64,2 % à l'epoch 1 à 90,1 % au meilleur epoch (133), puis se stabilise
autour de 89,8 % : l'augmentation et le L2 empêchent le réseau de mémoriser, et
l'écart avec la précision d'entraînement reste inférieur à 1 point en fin
d'entraînement (90,5 % contre 89,8 %). Sur le `basic`, qui n'a ni augmentation ni
L2, l'écart atteint 5 points (88,5 % d'entraînement contre 83,5 % de validation à
l'epoch 150) : c'est le début du surapprentissage, d'où la règle « on livre le
meilleur epoch de validation » (117 pour le `basic`).

**Lecture des matrices.** Presque toutes les erreurs sont des confusions entre
`Check` et `Checkmate` ; les positions sans échec sont bien séparées. Cela
confirme que la difficulté est la frontière fine entre « échec » et « mat », pas
la détection d'une attaque.

## 5. Expériences

### E1 — SGD simple ou SGD avec momentum ?

Mesure historique, sur un sous-échantillon et l'ancien découpage : seuls les
écarts entre les deux lignes sont significatifs, pas les valeurs absolues.
À architecture et données identiques (réseau `basic`, 40 epochs, lr 0,05) :

| Momentum | Précision validation | F1 macro | Perte finale |
|----------|----------------------|----------|--------------|
| 0 (SGD simple) | 80,9 % | 80,5 % | 0,360 |
| 0,9 | **83,3 %** | **82,7 %** | 0,309 |

À l'epoch 4, le réseau avec momentum atteint déjà 76,7 % de validation contre
68,1 % sans. L'écart final est de 2,4 points : l'optimiseur limitait la
précision autant que la capacité. Le momentum a donc été ajouté comme
hyperparamètre du `.conf` et du `.nn` (version 2 du format), pour rester
reproductible.

### E2 — La taille du réseau

Protocole final, modèle du meilleur epoch de validation, chiffres sur le jeu de
test :

| Réseau | Paramètres | Meilleur epoch | Précision test | F1 macro test | Entraînement |
|--------|------------|----------------|----------------|---------------|--------------|
| basic (64 → 32) | 51 715 | 117 | 87,26 % | 86,62 % | 15 min |
| medium (256 → 128 → 64) | 239 491 | 133 | **93,05 %** | **92,50 %** | 66 min |
| full (256 → 128 → 64, 5 sorties) | 239 621 | 142 | 93,00 % | 92,44 %\* | 56 min |

Multiplier la capacité par 4,6 apporte **5,79 points** de précision et de F1,
pour 4,4 fois plus de temps d'entraînement. Passer de 3 à 5 sorties
(`full`) ne change presque pas la précision globale mais ajoute la couleur du
camp en échec, pour un coût de calcul quasi identique (même architecture, seules
les sorties diffèrent) ; son F1 natif sur 5 classes est de 91,53 %. Au-delà, le
facteur limitant devient l'encodage : détecter un échec
est une relation *entre deux cases*, qu'une MLP à encodage one-hot doit apprendre
sans biais inductif positionnel (cf. `docs/DESIGN_CHOICES.md` §2).

## 6. Reproduire

```bash
# 1. Découper le dataset (80 / 10 / 10, par classe)
./scripts/make_split.sh dataset/ split/
cat split/train/*.txt > split/train.txt
cat split/test/*.txt  > split/test.txt

# 2. Générer les réseaux vierges
./my_torch_generator configs/basic_network.conf  models/basic.nn
./my_torch_generator configs/medium_network.conf models/medium.nn
./my_torch_generator configs/full_network.conf   my_torch_network.nn

# 3. Entraîner (150 epochs, lr 0,05, momentum 0,9 : tout est dans le .conf)
./my_torch_analyzer --train models/basic.nn  split/train.txt
./my_torch_analyzer --train models/medium.nn split/train.txt
./my_torch_analyzer --train my_torch_network.nn   split/train.txt

# 4. Évaluer sur le jeu de test (jamais vu à l'entraînement)
./my_torch_analyzer --predict models/medium.nn split/test.txt > predictions.txt
./scripts/evaluate.py predictions.txt split/test.txt
```

**Reproductibilité.** À fichier d'entraînement identique, deux exécutions
donnent le même réseau : l'initialisation, le mélange du dataset et l'ordre des
mini-batchs sont pilotés par `seed = 42`. Le découpage est lui aussi
reproductible depuis que `make_split.sh` prend une graine (42 par défaut). Les
trois réseaux livrés ont été entraînés sur le découpage corrigé (graine 42) ;
un nouveau tirage changerait le jeu de test et les chiffres de quelques dixièmes
de point.

**Durées.** Mesurées sur une machine à 4 cœurs / 8 threads avec `g++ -O3` et
`OMP_NUM_THREADS=4`. `basic` : 905 s (15,1 min), `medium` : 3 948 s
(65,8 min), `full` : 3 366 s (56,1 min). Ce sont des temps muraux réels,
sensibles à la charge de la machine : ils servent à comparer les ordres de
grandeur, pas à prédire une durée exacte sur une autre machine. Avec la
test-time augmentation, l'inférence des 72 303 positions prend 3,33 s (`basic`),
8,36 s (`medium`) et 9,10 s (`full`) sur la même machine.

## 7. Contenu du dossier

```
benchmarks/
├── results/                    # chiffres, tous générés par les binaires ou les scripts
│   ├── benchmarks.csv          # tableau principal (une ligne par réseau)
│   ├── learning_curves.csv     # 150 lignes : loss, précision, F1 par epoch (medium)
│   ├── class_metrics.csv       # précision/rappel/F1 par classe (medium, validation)
│   ├── class_metrics_full.csv  # idem, 5 classes (full, validation)
│   ├── confusion_matrix.csv    # matrice 3 × 3 (medium, validation)
│   ├── confusion_matrix_full.csv # matrice 5 × 5 (full, validation)
│   └── test_evaluation.txt     # sortie de evaluate.py sur le jeu de test (avec TTA)
└── plots/                      # images prêtes à lire (PNG, 120 dpi)
    ├── learning_curves.png
    ├── confusion_matrix.png
    ├── confusion_matrix_full.png
    └── benchmarks.png
```

Les fichiers `learning_curves.csv`, `class_metrics*.csv` et
`confusion_matrix*.csv` sont écrits automatiquement par `--train` à côté du
`.nn` (module `Report`), puis copiés ici pour le rendu. Régénérer les images
(matplotlib requis) :

```bash
./scripts/plot_learning_curves.py benchmarks/results/learning_curves.csv benchmarks/plots/learning_curves.png
./scripts/plot_confusion_matrix.py benchmarks/results/confusion_matrix.csv benchmarks/plots/confusion_matrix.png
./scripts/plot_confusion_matrix.py benchmarks/results/confusion_matrix_full.csv benchmarks/plots/confusion_matrix_full.png
./scripts/plot_benchmarks.py benchmarks/results/benchmarks.csv benchmarks/plots/benchmarks.png
```
