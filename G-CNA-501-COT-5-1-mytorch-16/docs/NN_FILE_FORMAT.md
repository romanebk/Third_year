# NN_FILE_FORMAT.md

> **Responsable** : Divine · **Semaine** : 2 · **Dépend de** : `include/mytorch/Serializer.hpp`, `include/mytorch/NetworkConfig.hpp`

**Rôle** : Spécification exacte du format binaire `.nn` (réseau de neurones) et du format
texte `.conf` (description d'un réseau). Un fichier `.nn` doit pouvoir être lu sans le
programme : c'est la garantie que `my_torch_analyzer --predict` charge exactement le
réseau qui a été entraîné.

---

## 1. Pourquoi un format binaire

Un réseau de niveau *medium* (773 → 256 → 128 → 64 → 3) contient environ 250 000 poids.
Les écrire en texte coûtent plusieurs mégaoctets et ralentissent le chargement. Le format
binaire est compact, se charge vite, et refuse explicitement les fichiers corrompus
(le *magic* et la *version* sont vérifiés avant toute interprétation).

Contraintes retenues :

- le fichier est **auto-suffisant** : architecture, poids, hyperparamètres d'entraînement
  et libellés de classes y figurent, l'analyseur n'a besoin d'aucun autre fichier ;
- il est **versionné** : un `.nn` produit par une version future du projet est refusé
  avec un message clair, jamais interprété de travers ;
- il est **vérifiable** : les tests `tests/test_serialization.cpp` font un aller-retour
  complet et comparent les poids **bit à bit** ainsi que les sorties du réseau.

## 2. Conventions

- **Entiers** : `uint32` (4 octets, non signés).
- **Réels** : `float` IEEE 754 (4 octets).
- **Chaînes** : `uint32` longueur (en octets) suivi des octets UTF-8, sans `\0` final.
- **Ordre des octets** : *ordre natif de la machine* (little-endian sur x86-64, l'architecture
  de développement et de rendu). Le format est donc portable entre machines de même
  endianness, pas entre architectures différentes. Ce choix est assumé : les `.nn` sont
  produits et consommés sur la même machine, et il garantit que l'en-tête et les matrices
  (écrites par `Matrix::write`) se lisent de la même façon.
- **Alignement** : aucun. Les champs sont écrits en séquence, sans bourrage.

## 3. En-tête d'un fichier `.nn`

| Offset | Type | Champ | Valeur |
|--------|------|-------|--------|
| 0 | `char[4]` | magic | `MYTN` (0x4D 0x59 0x54 0x4E) |
| 4 | `uint32` | version | `2` pour cette version du format |
| 8 | `uint32` | nbLayers | nombre de couches, ≥ 1 |
| 12 | `uint32` | inputSize | taille de l'entrée (773) |
| 16 | `uint32` | numClasses | nombre de classes en sortie |
| 20 | `uint32` | labelsLength | taille en octets du bloc de libellés |
| 24 | `char[]` | labels | libellés, chacun suivi d'un `\0` (y compris le dernier) |

Les libellés sont ceux affichés par `--predict` : `Nothing`, `Check`, `Checkmate` pour le
niveau *basic* ; `Nothing`, `Check White`, `Check Black`, `Checkmate White`,
`Checkmate Black` pour le niveau *full*.

## 4. Bloc d'hyperparamètres

Vient immédiatement après les libellés, toujours dans cet ordre :

| Type | Champ | Rôle |
|------|-------|------|
| `uint32` | epochs | nombre de passes sur le jeu d'entraînement |
| `uint32` | batchSize | taille des mini-batchs |
| `float` | learningRate | pas d'apprentissage |
| `float` | momentum | coefficient de momentum de la descente (0 = SGD simple) |
| `float` | l2 | poids de la régularisation L2 |
| `float` | dropout | taux de dropout (conservé pour compatibilité, sans effet : aucune couche Dropout n'est générée) |
| `uint32` | seed | graine du générateur aléatoire |

Ces valeurs sont nécessaire parce que `my_torch_analyzer --train LOADFILE CHESSFILE` ne
dispose d'aucune option pour les fournir : elles sont lues dans le `.nn` au chargement.
Le champ `dropout` est lu et réécrit tel quel dans un `.nn`, mais il est inerte : la
régularisation retenue est L2 + augmentation + sélection du meilleur epoch. En revanche,
un fichier `.conf` qui demande `dropout` ≠ 0 est refusé à la génération
(`NetworkConfig::validateConfig`, code 84) : aucune couche Dropout n'existe.

## 5. Les couches

Pour chaque couche, dans l'ordre du réseau :

| Type | Champ | Rôle |
|------|-------|------|
| `uint32` | typeLength | longueur du nom de type |
| `char[]` | type | `"dense"`, `"relu"`, `"sigmoid"`, `"tanh"` ou `"softmax"` |
| — | payload | paramètres de la couche, dépendant du type |

### Payload d'une couche `dense`

Écrit par `Dense::save`, relu par `Dense::load` :

1. `Matrix::write(poids)` — `uint32 rows`, `uint32 cols`, puis `rows × cols` `float` (matrice `nIn × nOut`) ;
2. `Matrix::write(biais)` — `uint32 rows`, `uint32 cols`, puis `rows × cols` `float` (matrice `1 × nOut`).

### Payload d'une activation

Vide : une activation n'a aucun paramètre à apprendre (`relu`, `sigmoid`, `tanh`, `softmax`).

## 6. Règles de validation

Au chargement, dans cet ordre :

| Contrôle | Erreur levée |
|----------|--------------|
| fichier absent ou illisible | `FileError` |
| magic différent de `MYTN` | `FormatError` (« ce fichier n'est pas un réseau my_torch ») |
| version différente de `2` | `FormatError` (« version de format non supportée ») |
| `nbLayers` nul ou absurdement grand (> 4096) | `FormatError` |
| type de couche inconnu | `FormatError` (via `makeActivation`) |
| fichier tronqué au milieu d'un champ | `FileError` |
| dimensions de matrice absurdes | `FormatError` (via `Matrix::read`) |
| biais incohérent avec les poids | `FormatError` (via `Dense::load`) |

Toutes ces erreurs remontent jusqu'à `main`, qui les écrit sur **stderr** et renvoie le
code de sortie **84**. Un fichier invalide ne provoque jamais de crash.

## 7. Historique des versions

Le champ `version` permet d'évoluer sans casser les fichiers existants :

- un lecteur accepte **exactement** la version qu'il connaît ;
- une version supérieure est refusée avec un message explicite, jamais devinée ;
- ajouter un champ impose de passer à la version suivante.

| Version | Contenu | État |
|---------|---------|------|
| 1 | format initial (sans momentum) | obsolète, refusé par le code actuel |
| 2 | ajout du champ `momentum` dans le bloc d'hyperparamètres | version actuelle |

Le passage de la version 1 à la version 2 date du 22/10/2026 : le momentum est
devenu un hyperparamètre enregistré. Il est lu par l'`Optimizer` du cœur de réseau
(`src/mytorch/Optimizer.cpp`), qui a remplacé le moteur de repli `StackTrainer` le
25/10/2026 (cf. `docs/INTERFACES.md`).

## 8. Format `.conf` (description d'un réseau)

Le `.conf` est un fichier **texte** lu par `my_torch_generator` pour produire un `.nn`.
Une ligne `clé = valeur`, les commentaires commencent par `#`, les espaces autour du `=` sont
ignorés. La clé `label` peut être répétée (une ligne par classe).

| Clé | Type | Défaut | Rôle |
|-----|------|--------|------|
| `input_size` | entier | 773 | taille de l'entrée |
| `num_classes` | entier | 3 | nombre de classes en sortie |
| `label` | texte | — | libellé d'une classe (répétable) |
| `hidden_sizes` | liste d'entiers | — | taille des couches cachées (obligatoire) |
| `hidden_activation` | texte | `relu` | activation entre les couches cachées |
| `hidden_init` | texte | `he` | initialisation des poids cachés (`xavier`, `he`, `lecun`) |
| `output_init` | texte | `xavier` | initialisation de la couche de sortie |
| `epochs` | entier | 20 | nombre d'époques |
| `batch_size` | entier | 32 | taille des mini-batchs |
| `learning_rate` | réel | 0.01 | pas d'apprentissage |
| `momentum` | réel | 0.0 | coefficient de momentum (0 = descente simple) |
| `l2` | réel | 0.0 | poids de la régularisation L2 |
| `dropout` | réel | 0.0 | taux de dropout |
| `seed` | entier | 42 | graine du générateur aléatoire |

Règles : une clé inconnue, une valeur non numérique, une liste vide, un nombre de
libellés différent de `num_classes`, un `learning_rate` nul ou négatif ou un
`momentum` hors de l'intervalle `[0, 1[` sont des `FormatError`. Le nombre de
libellés doit être exactement `num_classes`.

Exemple (`configs/basic_network.conf`) :

```ini
input_size = 773
num_classes = 3
label = Nothing
label = Check
label = Checkmate
hidden_sizes = 64 32
hidden_activation = relu
hidden_init = he
output_init = xavier
epochs = 150
batch_size = 128
learning_rate = 0.05
momentum = 0.9
l2 = 0.0
dropout = 0.0
seed = 42
```

## 9. Chaîne complète

```bash
./my_torch_generator configs/basic_network.conf models/basic.nn
./my_torch_analyzer --train  models/basic.nn split/train.txt
./my_torch_analyzer --predict models/basic.nn split/test.txt
```

Le `.nn` produit par le générateur et le `.nn` réécrit par `--train` (sans `--save`)
ont exactement le même format : l'entraînement ne change que les poids.
