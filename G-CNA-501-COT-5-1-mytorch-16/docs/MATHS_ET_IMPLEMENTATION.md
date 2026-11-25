# MY_TORCH — Les maths expliquées simplement (et comment les coder en C++)

> Complète [EXPLICATION_PROJET.md](EXPLICATION_PROJET.md). Ici : **comment un réseau apprend**, avec un exemple chiffré à la main, puis les formules à coder.
>
> **Comment lire ce document sans te perdre** : lis les sections dans l'ordre. Chaque section a un encadré **À retenir** de 2-3 lignes. Si tu ne comprends pas une section, relis seulement son « À retenir » et l'exemple chiffré (section 8), puis continue : ça se clarifie en codant.

## État d'implémentation (mis à jour le 27/10/2026)

Ce document explique **la théorie** ; il a été écrit avant le code. Voici ce qui a été
réellement fait dans `my_torch`, et où. Les encadrés « **Dans my_torch** » le long du
texte signalent chaque endroit où le code diffère de la théorie ou du plan initial.

| Section | Dans my_torch | Où |
|---|---|---|
| 3. Forward | ✔ | `Dense::forward`, `Network::forward` |
| 4. Activations | ✔ ReLU, Sigmoid, Tanh, Softmax (stable) | `src/mytorch/Activation.cpp` |
| 5. Perte | ✔ entropie croisée | `src/mytorch/Loss.cpp` |
| 6. Rétropropagation | ✔ | `backward` de chaque couche, `Network::backward` |
| 7. SGD, mini-batch, momentum | ✔ (avec L2) | `src/mytorch/Optimizer.cpp`, `Trainer.cpp`, `src/analyzer/TrainMode.cpp` |
| 7.4 Adam | ✘ non implémenté | — |
| 8. Exemple chiffré | ✔ reproduit par un test | `tests/test_layers.cpp` |
| 9. Initialisation | ✔ Xavier, He, LeCun | `src/mytorch/Init.cpp` |
| 10. Overfitting | L2 ✔, meilleur epoch ✔, augmentation ✔ ; dropout ✘, MC dropout ✘, arrêt anticipé avec patience ✘ | `Optimizer.cpp`, `TrainMode.cpp`, `src/chess/Augment.cpp` |
| 11. Métriques | ✔ précision, rappel, F1, matrice de confusion | `src/mytorch/Metrics.cpp`, `Report.cpp` |
| 12. Hyperparamètres | ✔ random search en script Python, 40 essais | `scripts/hyperparameter_search.py` |
| 13. Gradient numérique | ✔ | `tests/test_layers.cpp`, `tests/test_network.cpp` |

---

## Plan de lecture

| # | Section | Difficulté | Tu en as besoin pour coder… |
|---|---|:---:|---|
| 1 | L'idée globale | ★ | tout |
| 2 | Notations | ★ | tout |
| 3 | Forward : un réseau = des multiplications de matrices | ★★ | `Dense::forward` |
| 4 | Activations (ReLU, softmax) | ★★ | `Activation` |
| 5 | La loss (cross-entropy) | ★★ | `Loss` |
| 6 | Backpropagation | ★★★ | `backward` de chaque couche |
| 7 | Mise à jour des poids (SGD, momentum, Adam) | ★★ | `Optimizer` |
| 8 | **Exemple chiffré complet** (à faire à la main) | ★★ | comprendre 3 à 7 d'un coup |
| 9 | Initialisation des poids | ★ | `Init` |
| 10 | Overfitting et régularisation | ★★ | early stopping, dropout, L2 |
| 11 | Mesurer : accuracy, F1, matrice de confusion | ★ | benchmarks |
| 12 | Optimiser les hyperparamètres | ★★ | semaine 3 |
| 13 | Vérifier que ton code est juste (gradient check) | ★★ | **indispensable** |
| 14 | Ordre d'implémentation conseillé | ★ | savoir par où commencer |

---

## 1. L'idée globale

Entraîner un réseau = **répéter 4 étapes** :

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                         │
        ▼                                                         │
  1. FORWARD            2. LOSS              3. BACKWARD      4. UPDATE
  « Fais ta prédiction » « À quel point      « Quel poids a      « Corrige un peu
                          t'es-tu trompé ? »  causé l'erreur,     chaque poids dans
                                              et dans quel        le bon sens »
                                              sens ? »
```

- Les **poids** `W` et **biais** `b` sont les réglages du réseau. Au début ils sont aléatoires → le réseau se trompe.
- La **loss** est un nombre : 0 = parfait, grand = très faux.
- Le **gradient** d'un poids dit : « si j'augmente ce poids un tout petit peu, la loss monte ou descend, et de combien ? ». On déplace alors le poids **dans le sens qui fait descendre la loss**.

```
 loss
  │ \
  │  \
  │   \          ← on « descend la colline » petit à petit
  │    \__
  │       \___     ___
  │           \___/   ← minimum
  └──────────────────────► valeur d'un poids
```

> **À retenir** : apprendre = ajuster les poids pour faire baisser un nombre (la loss), en suivant la pente (le gradient). Tout le reste est de la plomberie pour calculer cette pente efficacement.

---

## 2. Notations (on les garde partout)

| Symbole | Sens | Taille |
|---|---|---|
| `B` | taille du mini-batch (ex. 128 positions traitées ensemble) | |
| `X` | entrées : une ligne par position | `B × n_in` |
| `W` | poids d'une couche Dense | `n_in × n_out` |
| `b` | biais | `1 × n_out` (ajouté à chaque ligne) |
| `Z` | sortie d'une couche **avant** activation : `Z = X·W + b` | `B × n_out` |
| `A` | sortie **après** activation : `A = f(Z)` | `B × n_out` |
| `Y` | vraies étiquettes en « one-hot » | `B × n_classes` |
| `P` | probabilités prédites (sortie du softmax) | `B × n_classes` |
| `L` | la loss (un seul nombre) | |
| `∂L/∂W` | gradient de la loss par rapport à `W` (noté `dW`) | même taille que `W` |
| `lr` | learning rate (pas d'apprentissage), ex. 0.01 | |

**Étiquettes en one-hot** (3 classes) :
`Nothing → [1,0,0]` · `Check → [0,1,0]` · `Checkmate → [0,0,1]`

> **Règle d'or pour ne pas se tromper** : `dW` a **toujours la même taille que `W`**. Si les tailles ne collent pas dans un produit de matrices, c'est qu'il y a une erreur.

---

## 3. Forward : un réseau, c'est des multiplications de matrices

Une couche Dense :

```
Z = X · W + b
```

Pour 1 position avec 3 entrées et 2 neurones :

```
              W (3×2)
            ┌ w11 w12 ┐
[x1 x2 x3] ·│ w21 w22 │ + [b1 b2] = [ z1  z2 ]
            └ w31 w32 ┘

z1 = x1·w11 + x2·w21 + x3·w31 + b1      ← c'est exactement « un neurone » du schéma
z2 = x1·w12 + x2·w22 + x3·w32 + b2
```

Le réseau complet (2 couches cachées) :

```
X ──► Z1 = X·W1 + b1 ──► A1 = ReLU(Z1) ──► Z2 = A1·W2 + b2 ──► A2 = ReLU(Z2)
                                                                   │
        P = softmax(Z3) ◄── Z3 = A2·W3 + b3 ◄──────────────────────┘
```

**Pourquoi traiter un batch d'un coup ?** `X` a `B` lignes → un seul produit de matrices calcule les `B` positions ; c'est beaucoup plus rapide que `B` boucles séparées.

> **À retenir** : forward = enchaîner `Z = X·W + b` puis une fonction d'activation, couche après couche. Une couche **garde en mémoire** son entrée `X` (et `Z`) : on en aura besoin en backward.

---

## 4. Activations

Sans activation, empiler des couches ne sert à rien (un produit de matrices reste une matrice). L'activation ajoute la **non-linéarité**.

| Nom | Formule `f(z)` | Dérivée `f'(z)` | Usage |
|---|---|---|---|
| **ReLU** | `max(0, z)` | `1` si `z>0`, sinon `0` | couches cachées (choix par défaut) |
| Sigmoid | `1 / (1+e^-z)` | `f(z)·(1−f(z))` | sortie binaire (pas notre cas) |
| Tanh | `(e^z − e^-z)/(e^z + e^-z)` | `1 − f(z)²` | couches cachées (alternative) |
| **Softmax** | `e^zi / Σ e^zj` | voir section 6 | **dernière couche** (classification) |

```
ReLU               Sigmoid             Tanh
  │    /             │    ___            │   ___
  │   /              │   /               │  /
──┼──/────         ──┼──/────          ──┼─/────
  │ /                │_/                _│/
```

### Softmax : transformer des scores en probabilités

```
z = [2.0, 1.0, 0.1]   →   e^z = [7.39, 2.72, 1.11]   →   somme = 11.22
                          P = [0.66, 0.24, 0.10]      (somme = 1)
```

⚠️ **Piège numérique** : `e^1000` déborde. Astuce **obligatoire** : soustraire le maximum avant l'exponentielle.
```cpp
float m = *std::max_element(z, z + n);          // max de la ligne
float sum = 0;
for (i) { e[i] = std::exp(z[i] - m); sum += e[i]; }
for (i) p[i] = e[i] / sum;                       // même résultat, sans overflow
```

> **À retenir** : ReLU dans les couches cachées, softmax en sortie. Pour softmax, toujours soustraire le max.

---

## 5. La loss : mesurer l'erreur

Pour la classification : **cross-entropy**.

```
L = − log( P[bonne classe] )          (pour une position)
```

| Proba donnée à la bonne classe | Loss |
|---|---|
| 0.99 (très sûr, a raison) | 0.01 |
| 0.50 | 0.69 |
| 0.10 (très sûr, a tort) | 2.30 |
| 0.01 | 4.61 |

→ Plus le réseau est confiant **et faux**, plus la punition est forte.

Pour un batch : on prend la **moyenne** des `B` loss.

⚠️ `log(0)` = −∞. Protéger : `log(max(p, 1e-12))`.

> **À retenir** : loss = `−log` de la probabilité qu'on a donnée à la bonne réponse. Objectif : la faire tendre vers 0.

---

## 6. Backpropagation : le cœur du projet

But : calculer `dW` et `db` pour **chaque** couche. On part de la fin et on remonte, avec la **règle de la chaîne** : *« si A dépend de B qui dépend de C, alors la sensibilité de A à C = (sensibilité de A à B) × (sensibilité de B à C) »*.

```
FORWARD  :   X ──► [Couche 1] ──► [Couche 2] ──► [Couche 3] ──► P ──► L
BACKWARD :   dX ◄── [Couche 1] ◄── [Couche 2] ◄── [Couche 3] ◄── dZ3 ◄── L
                    (dW1, db1)     (dW2, db2)     (dW3, db3)
```

Chaque couche reçoit en backward **`dOut`** (le gradient venant de la couche suivante) et doit :
1. calculer ses propres gradients (`dW`, `db`) → pour l'optimiseur,
2. renvoyer **`dIn`** (gradient par rapport à son entrée) → pour la couche précédente.

### 6.1 Le point de départ (softmax + cross-entropy) — le plus beau résultat du cours

Quand on combine softmax et cross-entropy, tout se simplifie :

```
dZ_last = (P − Y) / B
```

C'est tout. « Proba prédite moins vraie réponse », divisé par la taille du batch (car la loss est une moyenne).

> Exemple : `P = [0.82, 0.18]`, vrai = `[1, 0]` → `P − Y = [−0.18, +0.18]` : « augmente le score de la classe 0, baisse celui de la classe 1 ». Intuitif !

> **Dans my_torch** : la simplification n'est pas codée « en dur ». `Softmax::backward`
> applique la **vraie jacobienne** (`dIn_i = s_i · (g_i − Σ_j g_j·s_j)`), donc la couche est
> correcte seule et se vérifie par différences finies. `crossEntropy` renvoie la **vraie
> dérivée** de la perte par rapport aux probabilités, `dL/dp = −y / (p·N)`. Le produit des
> deux redonne exactement `dL/dz = (P − Y) / N`, ce que `tests/test_network.cpp` vérifie. Le
> résultat est celui de la théorie ; seule la façon d'y arriver change.

### 6.2 Couche Dense

Avec `dOut = ∂L/∂Z` (gradient arrivant sur la sortie `Z = X·W + b`) :

```
dW  = Xᵀ · dOut            (n_in × B) · (B × n_out) = n_in × n_out   ✔ même taille que W
db  = somme des lignes de dOut          (1 × n_out)
dIn = dOut · Wᵀ            (B × n_out) · (n_out × n_in) = B × n_in   ✔ même taille que X
```

(`ᵀ` = transposée.) Le **nom** de chaque formule se retient par les tailles : pas besoin de les apprendre par cœur, il n'y a qu'une façon de faire coller les dimensions.

### 6.3 Couche d'activation (ReLU)

Terme à terme (pas de produit de matrices) :
```
dIn = dOut ⊙ f'(Z)         (⊙ = multiplication élément par élément)
```
Pour ReLU : `dIn[i][j] = dOut[i][j]` si `Z[i][j] > 0`, sinon `0`.

(Le softmax est traité à part, au 6.1 : mathématiquement, softmax + cross-entropy donnent directement `P − Y`. Dans le code, `Softmax::backward` reste une couche à part entière avec sa jacobienne, voir l'encadré « Dans my_torch » du 6.1.)

### 6.4 Résumé en code (pseudo-C++)

```cpp
// Dense
Matrix Dense::forward(const Matrix& X) {
    input_ = X;                          // on mémorise X pour le backward
    return X * W_ + b_;                  // b_ ajouté à chaque ligne
}
Matrix Dense::backward(const Matrix& dOut) {
    dW_ = input_.transpose() * dOut;
    db_ = dOut.sumRows();
    return dOut * W_.transpose();        // dIn
}

// ReLU
Matrix ReLU::forward(const Matrix& Z)  { z_ = Z; return Z.map([](float v){ return v > 0 ? v : 0; }); }
Matrix ReLU::backward(const Matrix& d) { return d.maskWhere(z_, [](float v){ return v > 0; }); }

// Network
Matrix out = X;
for (auto& l : layers)                    out = l->forward(out);       // forward
LossResult loss = crossEntropy(out, Y);                                // valeur + dL/dp = −y/(p·N)
Matrix grad = loss.gradient;
for (auto it = layers.rbegin(); it != layers.rend(); ++it)
    grad = (*it)->backward(grad);                                      // backward (Softmax donne (P − Y)/N)
optimizer.step();                                                      // mise à jour
```

(Dans le dépôt, ce corps de boucle est `Trainer::trainBatch`, et `Network` fait les deux parcours des couches.)

> **À retenir** : chaque couche mémorise son entrée au forward, puis au backward calcule `dW`, `db` et renvoie `dIn`. On enchaîne les `backward` à l'envers. Les formules de Dense : `dW = Xᵀ·dOut`, `dIn = dOut·Wᵀ`.

---

## 7. Mise à jour des poids (les optimiseurs)

### 7.1 SGD (le plus simple)

```
W ← W − lr · dW
b ← b − lr · db
```

- `lr` trop grand → la loss oscille ou explose.
- `lr` trop petit → l'apprentissage est très lent.

```
lr trop grand       lr bon            lr trop petit
 \    /\    /         \                 \
  \  /  \  /           \                 \
   \/    \/             \__               \  (descend à peine)
 (rebondit)           (converge)          \
```

### 7.2 Mini-batch

- **Batch complet** : un gradient sur tous les 600 000 exemples → précis mais lent.
- **Stochastique** : 1 exemple à la fois → rapide mais bruité.
- **Mini-batch** (ex. 64-256) : le bon compromis ✔. Une **epoch** = un passage complet sur le dataset ; **mélanger** les données à chaque epoch.

### 7.3 Momentum (SGD avec de l'élan)

On garde une « vitesse » `v` qui lisse les gradients :
```
v ← β·v − lr·dW          (β ≈ 0.9)
W ← W + v
```

> **Dans my_torch** (`src/mytorch/Optimizer.cpp`) : le momentum est écrit sous la forme
> équivalente `v ← β·v + dW` puis `W ← W − lr·(v + λ·W)`, où `λ` est le coefficient L2.
> Le learning rate multiplie la vitesse au moment de la mise à jour au lieu de l'être à
> chaque accumulation ; avec un `lr` constant, c'est la même trajectoire. Réglages livrés :
> `β = 0,9`, `lr = 0,05`, `λ = 1e-3` (medium et full) ou `0` (basic).

### 7.4 Adam (le plus utilisé, bon choix par défaut)

Garde une moyenne `m` du gradient et une moyenne `s` de son carré, et adapte le pas **par poids** :
```
m ← β1·m + (1−β1)·dW             (β1 = 0.9)
s ← β2·s + (1−β2)·dW²            (β2 = 0.999)
m̂ = m / (1 − β1^t)               (correction de biais, t = numéro du pas)
ŝ = s / (1 − β2^t)
W ← W − lr · m̂ / (√ŝ + ε)       (ε = 1e-8, lr ≈ 0.001)
```
Il faut stocker `m` et `s` **pour chaque matrice de paramètres** (même taille que `W`).

> **À retenir** : commence par SGD (facile à déboguer), ajoute Adam ensuite. Mini-batch + mélange à chaque epoch.

> **Dans my_torch** : **Adam n'a pas été implémenté.** Le format de fichier `.nn` (version 2)
> ne stocke pas le type d'optimiseur ; en ajouter un impose une version 3 du format
> (`docs/NN_FILE_FORMAT.md`, §7). C'est le SGD avec momentum et L2 qui est livré.

---

## 8. Exemple chiffré complet (à refaire à la main !)

Le but : voir **une** itération entière avec de vrais nombres. Réseau minuscule : 2 entrées → 2 neurones cachés (ReLU) → 2 sorties (softmax). 1 seule position.

**Données**
```
X  = [1, 2]            vraie classe = 0  →  Y = [1, 0]
W1 = [[ 0.5, -1.0],    b1 = [ 0.1, -0.2]
      [ 0.3,  0.8]]
W2 = [[ 1.0, -0.5],    b2 = [ 0.0,  0.1]
      [ 0.2,  0.7]]
lr = 0.1
```

**Étape 1 — Forward**
```
Z1 = X·W1 + b1 = [1·0.5 + 2·0.3 + 0.1 ,  1·(-1.0) + 2·0.8 − 0.2] = [1.2, 0.4]
A1 = ReLU(Z1)  = [1.2, 0.4]                      (tout est positif)
Z2 = A1·W2 + b2 = [1.2·1.0 + 0.4·0.2 + 0 ,  1.2·(-0.5) + 0.4·0.7 + 0.1] = [1.28, −0.22]
P  = softmax(Z2) = [0.8176, 0.1824]
```

**Étape 2 — Loss**
```
L = −log(P[0]) = −log(0.8176) = 0.2014
```

**Étape 3 — Backward** (B = 1, donc pas de division)
```
dZ2 = P − Y = [0.8176 − 1 , 0.1824 − 0] = [−0.1824, +0.1824]

dW2 = A1ᵀ · dZ2 = [[1.2],[0.4]] · [−0.1824, 0.1824]
    = [[−0.2189, +0.2189],
       [−0.0730, +0.0730]]
db2 = dZ2 = [−0.1824, +0.1824]

dA1 = dZ2 · W2ᵀ = [−0.1824·1.0 + 0.1824·(−0.5) ,  −0.1824·0.2 + 0.1824·0.7]
    = [−0.2736, +0.0912]

dZ1 = dA1 ⊙ ReLU'(Z1) = [−0.2736, 0.0912]       (Z1 > 0 partout → on laisse passer)

dW1 = Xᵀ · dZ1 = [[1],[2]] · [−0.2736, 0.0912]
    = [[−0.2736, +0.0912],
       [−0.5473, +0.1824]]
db1 = dZ1 = [−0.2736, +0.0912]
```

**Étape 4 — Mise à jour (SGD, lr = 0.1)**
```
W2 ← W2 − 0.1·dW2 = [[1.0219, −0.5219],      b2 ← [0.0182, 0.0818]
                     [0.2073,  0.6927]]
W1 ← W1 − 0.1·dW1 = [[0.5274, −1.0091],      b1 ← [0.1274, −0.2091]
                     [0.3547,  0.7818]]
```

**Vérification : ça a-t-il marché ?** On refait un forward avec les nouveaux poids :
```
P = [0.867, 0.133]   (avant : [0.8176, 0.1824])
L = 0.1427           (avant : 0.2014)   ✔ la loss a baissé
```

> **À retenir** : une itération = forward → loss → backward → update. Si, dans ton code, tu obtiens exactement ces nombres sur cet exemple, **ton forward, ton backward et ton SGD sont corrects**. Utilise-le comme premier test unitaire.

---

## 9. Initialisation des poids

Si tous les poids valent 0, tous les neurones font la même chose et n'apprennent jamais rien d'utile. Si ils sont trop grands, les signaux explosent ; trop petits, ils disparaissent. On tire donc des **petits nombres aléatoires, d'une taille adaptée à la couche** :

| Nom | Formule (tirage aléatoire) | Pour quelle activation |
|---|---|---|
| **Xavier / Glorot** (uniforme) | `U(−l, +l)`, `l = √(6 / (n_in + n_out))` | tanh, sigmoid, softmax |
| **He** (normale) | `N(0, σ²)`, `σ = √(2 / n_in)` | **ReLU** ✔ |
| **LeCun** (normale) | `N(0, σ²)`, `σ = √(1 / n_in)` | sigmoid, tanh |

Exemple pour notre première couche (773 → 256) : Xavier `l ≈ 0.076` ; He `σ ≈ 0.051`.
Les **biais** démarrent à 0.

```cpp
std::mt19937 gen(seed);
std::normal_distribution<float> d(0.f, std::sqrt(2.f / n_in));   // He
for (auto& w : W.data()) w = d(gen);
```

> **À retenir** : pour ReLU, utilise He. Biais à 0. Garde la `seed` configurable pour pouvoir reproduire un entraînement.

---

## 10. Overfitting et régularisation

**Overfitting** = le réseau apprend **par cœur** les exemples d'entraînement et se trompe sur de nouvelles positions.

```
 loss
  │
  │ \
  │  \            ╱ ← loss de VALIDATION remonte : ALERTE
  │   \__      __╱
  │      \____╱
  │       ╲___________  ← loss d'ENTRAÎNEMENT continue de baisser
  └──────────────────────────► epochs
              ▲
        s'arrêter ici (early stopping)
```

C'est pourquoi on coupe les données en **train / validation / test** :
- **train** : sert à calculer les gradients,
- **validation** : sert à surveiller l'overfitting et choisir les hyperparamètres,
- **test** : utilisé **une seule fois à la fin** pour donner la vraie performance.

Les parades demandées par le sujet :

| Technique | Principe | Implémentation |
|---|---|---|
| **Early stopping** | arrêter quand la loss de validation ne s'améliore plus depuis N epochs (patience), et **garder les meilleurs poids** | copier les poids quand la val loss atteint un nouveau minimum |
| **Dropout** | pendant l'entraînement, éteindre au hasard une fraction `p` des neurones (et multiplier le reste par `1/(1−p)`) ; **désactivé** à la prédiction | une couche `Dropout` avec un masque aléatoire |
| **MC dropout** (bonus) | garder le dropout actif à la prédiction, répéter N fois, faire la moyenne | boucle de prédictions |
| **L2 (weight decay)** | pénaliser les gros poids : ajouter `λ·W` au gradient `dW` | 1 ligne dans l'optimiseur |
| Plus de données / réseau plus petit | | |

> **À retenir** : toujours surveiller la loss de **validation**, pas seulement celle de train. Early stopping + dropout suffisent pour répondre à l'exigence du sujet.

> **Dans my_torch** : le dropout n'a pas été implémenté. L'overfitting est
> contenu par la sélection du **meilleur epoch de validation** (au lieu d'un
> early stopping strict), le **L2** et l'**augmentation par symétries**. Voir
> `docs/DESIGN_CHOICES.md` §10, §11, §12 et §18 pour les mesures.

---

## 11. Mesurer la qualité : ne pas se fier qu'à l'accuracy

Dataset **déséquilibré** (nothing 300 k, check 249 k, checkmate 174 k) → un réseau « paresseux » peut avoir une accuracy correcte en ignorant la classe rare. On utilise la **matrice de confusion** :

```
                    PRÉDIT
                Nothing  Check  Checkmate
 VRAI Nothing     9 400    350      250      ← lignes = vérité
      Check         500  8 800      700
      Checkmate     300    900    8 800
```

Pour une classe `c` :
```
Précision(c) = TP / (TP + FP)      « quand je dis c, ai-je raison ? »      (colonne)
Rappel(c)    = TP / (TP + FN)      « trouve-je tous les vrais c ? »        (ligne)
F1(c)        = 2 · P · R / (P + R)  moyenne harmonique des deux
Accuracy     = (somme de la diagonale) / (total)
```
(TP = vrais positifs, FP = faux positifs, FN = faux négatifs.)

On rapporte : accuracy, **F1 par classe**, F1 moyen (« macro »), matrice de confusion. Ce sont ces chiffres + courbes qui vont dans le README.

Pour corriger le déséquilibre : **sous-échantillonner** (garder le même nombre d'exemples par classe) **ou pondérer** la loss (`poids(c) = total / (n_classes · n_c)`).

> **À retenir** : accuracy seule = trompeuse. Toujours regarder F1 par classe et la matrice de confusion.

---

## 12. Optimiser les hyperparamètres

**Hyperparamètres** = réglages **choisis par toi** (pas appris) : learning rate, taille de batch, nombre et taille des couches, dropout, λ (L2), optimiseur, patience…

Méthodes, de la plus simple à la plus avancée :

| Méthode | Principe | Coût |
|---|---|---|
| Essais à la main | tu changes un paramètre à la fois | faible, peu rigoureux |
| **Grid search** | tester toutes les combinaisons d'une grille | explose vite |
| **Random search** ✔ | tirer des combinaisons au hasard dans des plages | simple, souvent meilleur que la grille |
| **Algorithme génétique** (métaheuristique) | population de configs → on garde les meilleures, on les croise et on les mute | plus long, bonus intéressant |

Procédure raisonnable :
1. Entraîner sur un **sous-échantillon** (ex. 50 k lignes) pour tester vite.
2. Chaque config → score = **F1 macro sur la validation**.
3. Garder les meilleures, réentraîner sur tout le dataset.
4. **Noter** chaque résultat (CSV) : c'est la base de vos graphiques et de la justification demandée.

Plages de départ raisonnables : `lr ∈ [1e-4, 1e-1]` (échelle log) · batch ∈ {32, 64, 128, 256} · couches cachées ∈ {1, 2, 3} × tailles {64, 128, 256, 512} · dropout ∈ [0, 0.5].

> **À retenir** : random search + F1 validation + tout consigner dans un CSV.

> **Dans my_torch** : la recherche est un script Python (`scripts/hyperparameter_search.py`)
> qui pilote `my_torch_generator` et `my_torch_analyzer` ; il n'y a pas de classe C++
> `HyperSearch` ni d'algorithme génétique. Le journal (`benchmarks/results/hyperparameter_search.csv`)
> contient **40 essais** de 30 epochs sur 20 000 positions, avec des précisions de
> validation entre 56,9 % et 65,6 % (meilleur essai n°20 : 65,6 %) : **lr 0,05** et
> **hidden 256-128-64** en tête en moyenne, ce qui confirme les réglages retenus ;
> les écarts du peloton de tête restent dans le bruit du sous-échantillon.
> Les choix finaux reposent sur ce random search et sur des expériences ciblées
> (momentum, taille du réseau, L2, augmentation), décrites dans `docs/DESIGN_CHOICES.md`
> et `benchmarks/README.md`.

---

## 13. Vérifier que le code est juste : le test du gradient numérique

Le bug le plus dangereux : une backprop **fausse** qui ne plante pas — le réseau apprend mal et on ne sait pas pourquoi. Test de sûreté (le plan le prévoit dès la semaine 1) :

Pour un poids `w`, on estime la pente **sans** backprop :
```
gradient_numérique ≈ ( L(w + ε) − L(w − ε) ) / (2ε)          avec ε ≈ 1e-4
```
et on le compare au gradient calculé par ta backprop :
```
erreur_relative = |g_backprop − g_num| / max(|g_backprop| + |g_num|, 1e-8)
```
Si `erreur_relative < 1e-4` → ✔. Si elle est `> 1e-2` → ✘ ta backprop est fausse.

```cpp
for (chaque poids w testé) {
    float old = w;
    w = old + eps; float Lp = loss(forward(X), Y);
    w = old - eps; float Lm = loss(forward(X), Y);
    w = old;
    float g_num = (Lp - Lm) / (2 * eps);
    // comparer à dW[w]
}
```
Astuces : tester sur un **petit réseau** et quelques poids pris au hasard, en `double` (le `float` manque de précision pour ce test), **sans dropout**.

Autres tests utiles :
- **L'exemple chiffré de la section 8** doit donner exactement les mêmes nombres.
- **XOR** : le réseau doit apprendre `(0,0)→0, (0,1)→1, (1,0)→1, (1,1)→0` (jalon de la semaine 1).
- **Sur-apprentissage volontaire** : sur 20 positions, la loss doit tendre vers ~0. Si ce n'est pas le cas, il y a un bug.
- **Save/load** : mêmes prédictions avant et après sauvegarde.

> **À retenir** : gradient check + exemple de la section 8 + XOR = les 3 tests qui valident tout le cœur du réseau.

> **Dans my_torch** : ces trois tests existent. Les vérifications sont faites en `float` (pas en
> `double`) : pour une couche seule, avec un pas `ε = 1e-2` et une erreur relative inférieure à
> `5e-3` ; pour un réseau complet, avec `ε = 1e-3` et une tolérance de `2e-3 + 2 %` du gradient
> numérique. Sur un petit réseau, c'est suffisant, et un bug volontairement introduit (signe du
> gradient, ordre du `backward`, momentum ignoré…) est bien détecté. Où les trouver : gradient d'une couche et exemple
> chiffré dans `tests/test_layers.cpp` ; gradient de tout le réseau, XOR et calcul à la main
> de l'optimiseur dans `tests/test_network.cpp` ; aller-retour `.nn` dans
> `tests/test_serialization.cpp`. `tests/test_network.cpp` compare aussi les poids à ceux de
> l'ancien moteur de repli `StackTrainer` (écart < 1e-4 après 30 pas).

---

## 14. Ordre d'implémentation conseillé (pour ne pas se noyer)

Chaque étape produit quelque chose de **testable** avant de passer à la suivante.

```
 1. Matrix               produit, transposée, somme des lignes, map          → test sur de petites matrices
 2. Dense.forward        Z = X·W + b                                          → test à la main (section 3)
 3. ReLU + Softmax       forward                                              → test des valeurs section 4
 4. CrossEntropy         valeur + gradient (P − Y)/B                          → test section 5
 5. Backward complet     Dense.backward, ReLU.backward                        → exemple chiffré section 8 ✔
 6. Gradient check       (section 13)                                         → erreur < 1e-4
 7. SGD                  W ← W − lr·dW                                        → XOR appris ✔  (JALON SEMAINE 1)
 8. Parseur FEN → vecteur de 773  (Divine)                                    → 1 position connue, vérifiée à la main
 9. Boucle d'entraînement sur mini-batchs + mélange                           → loss qui baisse sur 5 000 positions
10. Métriques (accuracy, F1, matrice de confusion)                            → F1 par classe
11. Save / load .nn                                                           → mêmes prédictions après rechargement
12. Analyseur --train / --predict + code 84                                   → pipeline de bout en bout (JALON SEMAINE 2)
13. Early stopping, dropout, L2, momentum puis Adam                           → comparer avec/sans (courbes)
14. Random search / génétique, benchmarks, README                             → semaine 3
```

**Découpage à deux** (cohérent avec le plan) :
- **Ariel** : étapes 1 → 7, 13, 14 (cœur NN + optimisation).
- **Divine** : étapes 8, 10, 11, 12 (données, analyseur, doc). Elle peut travailler sans attendre le réseau : le parseur FEN et la CLI sont indépendants du reste.
- **Point de rencontre** : l'interface `Network::predict(Matrix) → Matrix` et l'entraînement d'un mini-batch (`Trainer::trainBatch(entrées, cibles)`). Se mettre d'accord dessus dès le premier jour suffit pour avancer en parallèle.

> **Dans my_torch** : cet ordre a été suivi dans les grandes lignes (étapes 1 à 12 faites). À
> l'étape 13, seuls le **momentum** et le **L2** ont été réalisés ; Adam, le dropout et
> l'arrêt anticipé ne l'ont pas été (remplacés par la sélection du meilleur epoch et par
> l'augmentation de données). À l'étape 14, la recherche est un script Python et non un
> module C++ (voir le §12). Le tableau « État d'implémentation » en tête de document donne
> le détail.

---

## Glossaire express

| Mot | En clair |
|---|---|
| **Epoch** | un passage complet sur tout le dataset d'entraînement |
| **Batch / mini-batch** | groupe de positions traitées ensemble |
| **Forward / backward** | calcul de la prédiction / calcul des gradients |
| **Gradient** | la « pente » : de combien la loss change si on bouge un poids |
| **Learning rate** | taille du pas de correction |
| **Loss** | nombre mesurant l'erreur (à minimiser) |
| **Overfitting** | apprendre par cœur au lieu de généraliser |
| **Hyperparamètre** | réglage choisi par l'humain (lr, nb de couches…) |
| **One-hot** | vecteur de 0 avec un seul 1 (ex. la classe, ou la pièce sur une case) |
| **Logits** | les scores bruts avant softmax |
| **F1** | note qui combine précision et rappel |
