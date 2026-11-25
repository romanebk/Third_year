# INTERFACES.md

> **Responsable** : Divine · **Destinataire** : Ariel · **Semaine** : 2-3
> **Dépend de** : `include/mytorch/Layer.hpp`, `include/mytorch/StackTrainer.hpp`

**Rôle** : Ce document fixe les interfaces entre le cœur de réseau (Ariel) et le
module données + analyseur (Divine). Il est la source de vérité pour les
signatures que les deux parties doivent respecter : sans lui, `Network`, `Loss`,
`Optimizer` et `Trainer` ne peuvent pas être branchés sur l'analyseur.

**Statut au 26/10/2026** : `Layer`, `Dense`, `ReLU`, `Sigmoid`, `Tanh`, `Softmax`,
`Matrix`, `Loss`, `Network`, `Optimizer` et `Trainer` sont terminés, testés et
branchés sur l'analyseur (branche `feature/10-core`). `Dropout` n'est pas
implémenté : la régularisation retenue est L2 + augmentation + sélection du
meilleur epoch (§10, §11 et §18 de `DESIGN_CHOICES.md`). La recherche
d'hyperparamètres est fournie par `scripts/hyperparameter_search.py` (random
search reproductible, journal CSV), et non par une classe C++ vide. `StackTrainer`
n'est plus utilisé par l'analyseur : il est conservé uniquement comme **oracle de
test** (équivalence des gradients et des poids, cf. `tests/test_network.cpp`).

---

## 1. Ce qui est figé (ne pas modifier)

Ces classes sont écrites, testées et utilisées par l'analyseur. Leur interface ne
doit plus changer, seulement être complétée.

```cpp
class Layer {
    virtual Matrix forward(const Matrix &input) = 0;
    virtual Matrix backward(const Matrix &gradOutput) = 0;
    virtual std::vector<Parameter> parameters();
    virtual std::string type() const = 0;
    virtual void save(std::ostream &out) const = 0;
    virtual void load(std::istream &in) = 0;
    void setTraining(bool training);
    bool isTraining() const;
};
```

`Parameter` est `{ Matrix *value; Matrix *gradient; }` : les deux pointeurs restent
valides tant que la couche existe. `Dense` expose deux paramètres (poids `nIn x
nOut` et biais `1 x nOut`).

`Matrix` fournit le calcul nécessaire : produit matriciel, `hadamard`, `map`, `transpose`,
`sumRows`, `addRowVector`, `selectRows`, `argmaxRows`, `write`/`read`.

## 2. Format de fichier `.nn`

Le format binaire est figé et documenté dans [`NN_FILE_FORMAT.md`](NN_FILE_FORMAT.md).
Deux points structurants pour le cœur de réseau :

- une couche s'écrit avec `layer->type()` puis `layer->save(out)` : le cœur de
  réseau n'a **rien** à ajouter pour être sérialisable ;
- le fichier contient aussi les hyperparamètres d'entraînement (`TrainSettings`),
  les libellés de classes et le nombre de classes.

## 3. Contrat attendu du cœur de réseau

### 3.1 `Network`

```cpp
// include/mytorch/Network.hpp
namespace mytorch {

// Le réseau est la pile de couches + les métadonnées du fichier .nn.
class Network {
public:
    Network() = default;
    // Prend la possession des couches de la description sérialisée.
    explicit Network(NetworkFile file);

    // Fichier .nn (voir docs/NN_FILE_FORMAT.md).
    void save(const std::string &path) const;
    static Network load(const std::string &path);

    // Passe avant sur toutes les couches ; renvoie la sortie (N x numClasses).
    Matrix forward(const Matrix &input);
    // Passe avant en mode prédiction (le dropout est désactivé).
    Matrix predict(const Matrix &input);
    // Rétropropagation : renvoie le gradient par rapport à l'entrée.
    Matrix backward(const Matrix &gradOutput);

    // Accès aux couches et aux métadonnées.
    std::vector<std::unique_ptr<Layer>> &layers();
    const std::vector<std::unique_ptr<Layer>> &layers() const;
    const NetworkFile &file() const;
};

} // namespace mytorch
```

`Network::load` et `Network::save` s'appuient sur `mytorch/Serializer.hpp` (écrit par
Divine, déjà disponible) : le cœur de réseau n'écrit pas de sérialisation.

### 3.2 `Loss`

```cpp
// include/mytorch/Loss.hpp
namespace mytorch {

struct LossResult {
    double value = 0.0;   // perte moyenne sur le lot
    Matrix gradient;      // gradient de la perte par rapport aux probabilités (N x C)
};

// Entropie croisée : probabilités d'une sortie Softmax et cibles one-hot (N x C).
LossResult crossEntropy(const Matrix &probabilities, const Matrix &targets);

} // namespace mytorch
```

Le gradient renvoyé est `dL/dp` avec `p` la sortie softmax. Rappel utile :
`Softmax::backward` applique le vrai jacobien, donc il faut passer
`dL/dp = (p - y) / p` (ou la forme exacte `-y / (p·N)`, équivalente à une
constante près que la jacobienne annule) pour obtenir `dL/dz = (p - y) / N`.
L'implémentation utilise la forme exacte, directement vérifiable par différences
finies (cf. `include/mytorch/Loss.hpp`).

### 3.3 `Optimizer`

```cpp
// include/mytorch/Optimizer.hpp
namespace mytorch {

class Optimizer {
public:
    // L'optimiseur met à jour les paramètres de toutes les couches du réseau.
    explicit Optimizer(Network &network, const TrainSettings &settings);
    // Applique une mise à jour (SGD, momentum ou Adam selon l'implémentation).
    void step();
    // Remet tous les gradients à zéro (à appeler entre deux mini-batchs).
    void zeroGradients();
};

} // namespace mytorch
```

Le moteur de repli (`StackTrainer`) implémente déjà un SGD avec momentum
(`v = momentum * v + gradient`, puis `poids -= learningRate * v`) : c'est la
référence à reproduire, et le coefficient est stocké dans le `.nn` (champ
`momentum` de `TrainSettings`) pour que l'entraînement reste reproductible.

### 3.4 `Trainer`

```cpp
// include/mytorch/Trainer.hpp
namespace mytorch {

class Trainer {
public:
    Trainer(Network &network, Optimizer &optimizer, const TrainSettings &settings);
    // Entraîne une epoch sur un lot ; renvoie la perte moyenne sur le lot.
    double trainEpoch(const Matrix &inputs, const Matrix &targets);
};

} // namespace mytorch
```

`TrainSettings` (`include/mytorch/TrainSettings.hpp`, écrit par Divine) porte
`epochs`, `batchSize`, `learningRate`, `momentum`, `l2`, `dropout` et `seed` : ce
sont exactement les champs stockés dans le `.nn`, il n'y a donc pas de doublon à faire.

## 4. Implémentation de repli côté analyseur

Pour ne pas bloquer la fin de pipeline (le module `Trainer`/`Optimizer`/`Loss` du
cœur de réseau n'était pas disponible le 22/10), `mytorch/StackTrainer.hpp` fournit
la même chose en s'appuyant uniquement sur l'interface publique `Layer` :

```cpp
class StackTrainer {
public:
    explicit StackTrainer(const TrainSettings &settings);
    Matrix forward(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input) const;
    Matrix predict(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &input) const;
    Matrix backward(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &gradOutput) const;
    double crossEntropy(const Matrix &probabilities, const Matrix &targets, Matrix &gradient) const;
    void update(std::vector<std::unique_ptr<Layer>> &layers) const;
    void resetOptimizerState();
    double trainEpoch(std::vector<std::unique_ptr<Layer>> &layers, const Matrix &inputs,
                       const Matrix &targets) const;
};
```

La mise à jour est une descente de gradient avec momentum (`TrainSettings::momentum`,
0 = SGD simple) et régularisation L2 optionnelle. `tests/test_stack_trainer.cpp`
vérifie que cette implémentation apprend le XOR et que son gradient est correct
(différences finies, écart < 1e-4).

**Fait le 25/10** : `Network`, `Loss`, `Optimizer` et `Trainer` sont écrits,
testés, et l'analyseur (`src/analyzer/`) ne dépend plus de `StackTrainer`. Le
point de bascule est bien resté unique (`TrainMode.cpp`). `StackTrainer` est
conservé comme oracle de test : le supprimer ferait perdre le test d'équivalence
qui garantit que le nouveau moteur reproduit exactement l'ancien. Il ne doit plus
être utilisé en production.

## 5. Contrat de l'analyseur (côté Divine, déjà écrit)

```cpp
// include/analyzer/Cli.hpp
struct Options {
    Mode mode;            // Train ou Predict
    std::string loadFile; // fichier .nn
    std::string chessFile;// fichier de positions (FEN + étiquette)
    bool hasSave = false;
    std::string saveFile; // fichier .nn de sortie
};
```

- `--train [--save FICHIER] LOADFILE CHESSFILE` : sans `--save`, `LOADFILE` est
  réécrit ; avec `--save`, c'est `SAVEFILE` qui est écrit.
- `--predict LOADFILE CHESSFILE` : une ligne de sortie par position, dans l'ordre
  du fichier ; `--save` est refusé dans ce mode.
- Toute erreur est écrite sur **stderr** et le programme se termine avec le code
  **84** ; `--help` renvoie 0.

## 6. Répartition proposée

| Élément | Responsable | État |
|---------|-------------|------|
| `Matrix`, `Init`, `Layer`, `Dense`, activations | Ariel | terminé, testé |
| `Loss`, `Optimizer`, `Trainer`, `Network` | Ariel | terminé, testé, branché |
| `Dropout` | Ariel | non implémenté ; L2 + augmentation + meilleur epoch |
| `HyperSearch` | Ariel | remplacé par `scripts/hyperparameter_search.py` (random search) |
| `Fen`, `Labels`, `Dataset` | Divine | terminé, testé |
| `Serializer`, `NetworkConfig`, générateur, `.conf` | Divine | terminé, testé |
| `Metrics`, export CSV, scripts de tracé | Divine | terminé, testé |
| `StackTrainer` (repli) | Divine | conservé comme oracle de test uniquement |
| `Cli`, `main`, `TrainMode`, `PredictMode` | Divine | terminé, testé, branché sur le cœur |
