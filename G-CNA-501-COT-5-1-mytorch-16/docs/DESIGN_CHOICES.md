# DESIGN_CHOICES.md

> **Responsable** : Ariel + Divine · **Semaine** : 3 · **Dépend de** : benchmarks/README.md, docs/NN_FILE_FORMAT.md

**Rôle** : Justification de tous les choix de conception. Chaque section
reprend : les alternatives envisagées, la mesure obtenue, la décision et sa
raison.

Toutes les mesures viennent du dataset complet (723 019 positions) découpé en
80 % entraînement / 10 % validation / 10 % test par `scripts/make_split.sh`.
Les chiffres sont reproductibles avec la graine 42.

---

## 1. Encodage de l'entrée : 773 valeurs

**Choix.** Une case = 12 valeurs (un `1` pour chaque type de pièce, ordre
`PNBRQKpnbrqk`), donc 64 × 12 = 768 valeurs, plus 1 pour le trait et 4 pour les
droits de roque, soit **773**.

**Alternatives.** Une case = 1 valeur (64 + 5 = 69) perd le type de pièce :
impossible de distinguer une dame d'un pion ; un encodage par plans (12 plans de
64 cases) est équivalent au nôtre mais plus difficile à lire ; un encodage
dense 64 cases × 64 cases × 12 = 49 152 valeurs est inutilisable ici.

**Pourquoi.** Le plan fixe l'encodage à 773 valeurs. Le type de pièce est
indispensable : un échec se détecte par la géométrie des pièces (pion, cavalier,
fou, tour, dame), pas par leur simple présence.

**Limite assumée.** Le trait et les roques sont des entrées **scalaires** et non
des one-hot : ils ont été ajoutés parce que la position à lui seule ne dit pas
qui doit jouer, et parce que les droits de roque changent la légalité de
certains coups.

## 2. Architecture : 773 → 64 → 32 → 3 (basic), 773 → 256 → 128 → 64 → 3 (medium) et 773 → 256 → 128 → 64 → 5 (full)

**Choix.** Une couche d'entrée dense, deux ou trois couches cachées ReLU, une
sortie dense + softmax. Le basic reste volontairement petit (64-32) pour servir
de référence rapide ; le medium ajoute de la capacité ; le full reprend
l'architecture du medium avec cinq sorties (la couleur du camp qui donne
l'échec).

**Alternatives.** Une seule couche cachée (moins de paramètres, mais la
détection d'échec est une relation *entre deux cases* : il faut au moins deux
couches) ; un réseau convolutif (hors périmètre et hors format `.nn`).

**Mesure.** Protocole final : 150 epochs, learning rate 0,05, momentum 0,9,
batch 128, graine 42, sur 520 574 positions d'entraînement et 57 841 de
validation (10 % de `split/train.txt`). `medium` et `full` utilisent
l'augmentation par symétries et `l2 = 1e-3` ; `basic` est entraîné sans
augmentation et avec `l2 = 0` (§11, §18). Le réseau livré est celui du meilleur
epoch de validation ; le test est mesuré sur 72 303 positions jamais vues.

| Réseau | Paramètres | Meilleur epoch | Val. | F1 val. | Test (TTA) | F1 test (TTA) |
|--------|------------|----------------|------|---------|------------|---------------|
| basic (64-32) | 51 715 | 117 | 83,72 % | 83,14 % | 87,26 % | 86,62 % |
| medium (256-128-64) | 239 491 | 133 | 90,08 % | 89,45 % | **93,05 %** | **92,50 %** |
| full (256-128-64, 5 sorties) | 239 621 | 142 | **90,11 %** | 89,47 % | 93,00 % | 92,44 % |

La validation est mesurée en une passe (elle sert à choisir le meilleur epoch) ;
le test inclut la **test-time augmentation** du prédicteur livré : moyenne des
probabilités sur les quatre symétries exactes de l'échiquier (§19).

Dans son espace natif de 5 classes, le `full` obtient 90,11 % de précision et
88,44 % de F1 macro en validation, puis **93,00 %** et **91,53 %** au test ; les
chiffres du tableau sont sa projection en 3 classes, pour être comparable aux
deux autres réseaux. Il est au niveau du medium en 3 classes (93,00 % contre
93,05 %, F1 92,44 % contre 92,50 %) : distinguer la couleur du camp n'apporte
pas de gain mesurable, et coûte 0,9 point de F1 macro dans son espace natif
(91,53 % contre 92,44 % une fois les couleurs regroupées).

Le medium gagne **5,8 points** sur le basic (93,05 % contre 87,26 %) pour
4,6 fois plus de paramètres. Le basic est limité par sa capacité : sa précision
d'entraînement (88,5 %) dépasse sa validation (83,72 %), alors que le medium ne
sur-apprend plus (90,9 % en entraînement pour 90,08 % en validation) :
l'augmentation et le L2 contiennent la mémorisation, et il culmine à l'epoch 133
avant de se stabiliser (89,83 % à l'epoch 150). Le seuil de 90 % du plan est
largement atteint au test ; les marges restantes sont la capacité et, surtout,
l'encodage.

La limite de fond est l'**encodage** : les 773 valeurs décrivent le matériel, le
trait et les droits de roque, mais pas les attaques ; la relation entre deux
cases doit être apprise à partir des 520 574 positions. Les confusions du medium
sur le test sont `Check → Checkmate` (2 716 positions), `Checkmate → Check`
(1 550) et `Nothing → Check` (1 324) : l'erreur porte sur la nature de l'échec,
pas sur la présence d'une pièce. Un encodage qui exposerait les lignes d'attaque
(lignes de vue, cases contrôlées) est la piste structurelle la plus prometteuse.

## 3. Activation cachée : ReLU

**Choix.** ReLU sur les couches cachées.

**Alternatives.** Sigmoïde et tanh (plus lisses, mais gradients qui
disparaissent et coût de calcul plus élevé) ; LeakyReLU (utile si le ReLU
"meurt", pas observé ici : les gradients ne sont pas nuls).

**Pourquoi.** ReLU converge plus vite en SGD, c'est la valeur par défaut avec
l'initialisation de He, et le réseau ne souffre pas de gradient vanishing sur
ces données.

**Note.** Le gradient du réseau complet a été vérifié numériquement (différences
finies) pour les trois activations tanh, sigmoid et ReLU, sur tous les poids et
biais (`tests/test_network.cpp`) : l'écart reste sous la tolérance
`2e-3 + 2 %` du gradient numérique. Le test passe aussi avec ReLU ; les points
de non-dérivabilité (préactivation exactement nulle) sont improbables avec des
entrées aléatoires et ne sont pas spécifiquement testés.

## 4. Activation de sortie : Softmax

**Choix.** Couche Softmax en sortie, les cibles sont one-hot.

**Alternatives.** Logits bruts + log-sum-exp (mathématiquement équivalent, mais
il faut gérer la stabilité numérique à la main) ; une sortie par classe avec
sigmoid (plus lent à converger, et la perte ne serait plus convexe en
joint).

**Pourquoi.** Softmax + entropie croisée est convexe en joint sur les
probabilités et donne `dL/dz = p - y`, un gradient simple et stable.

## 5. Initialisation : He pour le caché, Xavier pour la sortie

**Choix.** `he` (normale d'écart-type `sqrt(2 / n_in)`) pour les couches
cachées ReLU, `xavier` (uniforme `±sqrt(6 / (n_in + n_out))`) pour la couche de
sortie softmax.

**Alternatives.** Zéros (le réseau n'apprend rien, les gradients nuls) ;
`lecun` (adapté aux sigmoid/tanh) ; une constante faible (le réseau met
beaucoup de temps à sortir de la zone plate).

**Pourquoi.** He compense la variance de l'activation ReLU, Xavier celle de la
sortie softmax. La graine est celle du `.conf` (42) : deux exécutions avec la
même graine donnent exactement le même réseau.

## 6. Perte : entropie croisée

**Choix.** Entropie croisée `-log(p_classe)` sur la sortie softmax, moyennée sur
le mini-batch.

**Alternatives.** Erreur quadratique (mauvais pour une classification
probabiliste, gradients qui s'effondrent) ; hinge / perceptron-loss (moins
stable, pas de probabilités).

**Pourquoi.** C'est la perte naturelle pour une sortie softmax et elle pousse
directement la bonne classe vers 1. Le gradient implémenté est la dérivée exacte
`dL/dp = -y / (p·N)` ; passée dans le vrai jacobien du softmax, elle redonne
`dL/dz = (p - y) / N`. La forme `(p - y) / p` de `docs/INTERFACES.md` est
équivalente (les deux diffèrent d'une constante que la jacobienne annule), mais
la nôtre est directement vérifiable par différences finies.

## 7. Optimiseur : SGD avec momentum 0,9

**Choix.** Descente de gradient sur mini-batchs, avec une vitesse accumulée :
`v = 0,9 × v + gradient`, puis `poids -= lr × v`.

**Alternatives.** SGD simple (mesuré : 80,9 % de précision de validation contre
83 % avec momentum, à architecture et données identiques) ; momentum plus faible
(0,5 : convergence plus lente) ; AdaGrad, RMSProp, Adam (non implémentés : le
format `.nn` ne stocke pas encore le type d'optimiseur).

**Pourquoi.** Le momentum amortit les oscillations de la descente et accélère la
convergence : à epoch 4, le réseau basic atteint déjà 76,7 % de précision de
validation, contre 68,1 % sans momentum. L'écart se creuse ensuite (83 % contre
80,9 % à convergence), ce qui montre que l'optimiseur, et pas seulement la
capacité, limitait la précision.

**Implémentation.** Le coefficient de momentum, le L2 et le learning rate sont
stockés dans le `.nn` (version 2 du format) et configurables dans le `.conf`, ce
qui rend l'entraînement reproductible. `Optimizer::setLearningRate` permet de
faire décroître le pas entre deux epochs sans changer le format, mais aucune
politique de décroissance n'est encore appliquée.

**Prochaine étape.** Adam convergence plus vite et libère le learning rate ; il
demande d'ajouter un champ « type d'optimiseur » au `.nn` (version 3) et de
retoucher le code de Divine. Reporté après le rendu du socle.

## 8. Learning rate : 0,05

**Choix.** 0,05 avec des mini-batchs de 128.

**Alternatives.** 0,01 (convergence trop lente : 74 % de précision d'entraînement
après 60 epochs sur 99 000 positions), 0,1 et 0,05 divergaient tant que le
gradient n'était pas moyenné sur le lot.

**Pourquoi.** Le gradient est **moyenné** sur le mini-batch : sans cela, le pas
effectif de mise à jour dépendait de la taille du batch (divergence à 0,05) et
le réglage du learning rate n'aurait pas été reproductible d'une configuration à
l'autre. Avec le momentum, le pas effectif est multiplié par `1 / (1 - 0,9)` :
0,05 est donc un réglage déjà « accéléré », ce qui explique qu'il reste le
meilleur choix mesuré.

## 9. Batch size : 128

**Choix.** 128 positions par mini-batch.

**Alternatives.** 32 (plus de pas de mise à jour, plus de bruit, plus lent) ;
1024 (mémoire et temps de calcul par pas plus importants, moins de pas par
epoch).

**Pourquoi.** 128 positions par mini-batch tient dans le cache mémoire : un
epoch sur 520 574 positions dure environ 12 s pour le réseau basic et 69 s pour
le medium **avant parallélisation**. Avec 4 threads et `-march=native`, le
benchmark reproductible (4 000 positions, 60 epochs, medium) passe de 52,2 s à
19,0 s (2,7×). Sur l'entraînement complet mesuré à 150 epochs, les temps muraux
sont de 15 min pour le basic, 66 min pour le medium et 56 min pour le full
(ils dépendent de la charge de la machine).

## 10. Dropout : non utilisé

**Choix.** `dropout = 0.0` dans les `.conf` ; toute valeur non nulle est
**refusée** par `NetworkConfig::validateConfig` (erreur `FormatError`, code 84).

**Pourquoi.** Le module `Dropout` du cœur de réseau n'est pas écrit : la couche
existe dans le format `.nn` (le champ est lu et écrit) mais le générateur
n'insère aucune couche de dropout entre `Dense` et l'activation. Refuser une
valeur non nulle évite de laisser croire que le réglage est actif. Le
sur-apprentissage est traité autrement : L2 (§11), sélection du meilleur epoch
(§12) et augmentation par symétries (§18), qui est la piste la plus rentable
mesurée (+4,5 points). Avec ce protocole, la précision d'entraînement et celle de
validation restent proches sur le medium (90,5 % contre 89,8 % au dernier epoch) :
le sur-apprentissage est contenu sans dropout. Le dropout reste une piste
ouverte, à comparer à l'augmentation.

## 11. Régularisation L2 : 1e-3 (medium et full), 0,0 (basic)

**Choix.** `l2 = 0.001` pour les réseaux medium et full ; `l2 = 0.0` pour le
basic.

**Alternatives.** 0,0 partout ; 1e-4 ; une valeur plus forte (1e-2).

**Pourquoi.** Le criblage §18 montre que L2 apporte environ +1 point de
validation en plus de l'augmentation. Le basic, lui, sous-entraîne déjà avec
64-32 : ajouter une pénalité sur les poids ne ferait que réduire encore sa
capacité utile, donc son L2 reste nul. Le cœur de réseau applique la pénalité
dans `Optimizer::step` (`lr · l2 · poids`) et la clé existe dans le `.conf` comme
dans le `.nn`.

## 12. Sélection du modèle : meilleur epoch de validation

**Choix.** Le nombre d'epochs est fixe (150, écrit dans le `.conf` et dans le
`.nn`), mais le `.nn` est réécrit à chaque amélioration de la précision de
validation. Le modèle livré est donc celui du meilleur epoch, pas celui du
dernier.

**Alternatives.** Livrer le dernier epoch (plus simple, mais sur le premier
protocole à 60 epochs, le medium perdait 0,4 point : 84,6 % contre 85,0 %) ;
arrêter l'entraînement sur stagnation (early stopping, qui aurait arrêté le
medium à l'epoch 21 et perdu la remontée observée ensuite).

**Pourquoi.** L'entraînement reste reproductible et de durée fixe, tout en
gardant le meilleur modèle ; les CSV de confusion et de métriques sont calculés
sur le `.nn` rechargé, donc sur le modèle réellement livré. Sur le medium à
150 epochs, la validation culmine à l'epoch 133 (90,08 %) puis se stabilise
(89,83 % au dernier epoch) : la sélection n'enlève presque rien, elle protège
les entraînements où la courbe se retourne (le basic culmine à l'epoch 117 avec
83,72 %, contre 83,49 % au dernier epoch).

## 13. Rééquilibrage des classes

**Choix.** Le dataset brut est déséquilibré (Nothing 42 %, Check 35 %,
Checkmate 24 % sur la validation). Le module de données fournit deux outils :
`Dataset::getClassWeights()` (poids inverse fréquence) et
`Dataset::balanceClasses()` (sous-échantillonnage à la classe la plus rare).

**Mesure.** En mode 3 classes, `balanceClasses` ramène chaque classe au
minimum disponible, soit 173 719 positions par classe (521 157 au total), au
lieu de 42 % / 35 % / 24 %. Les 79 424 positions par classe (79 424 × 5 =
397 120 au total) correspondent au mode full à 5 classes, pas au mode 3
classes. Le pic mémoire du sous-échantillonnage en place est de 2,23 Go
(contre 5,6 Go avec une copie).

**Pourquoi.** Le rééquilibrage est une option, pas un choix par défaut. Les
deux outils sont disponibles mais non utilisés par l'entraînement : les poids
de classes ne sont ni stockés dans le fichier `.nn` ni utilisés par
l'entraîneur. Le garde-fou retenu est le F1 macro (moyenne des F1 par
classe), suivi pour qu'une classe rare ne soit pas noyée dans la précision
globale.

## 14. Découpage des données

**Choix.** 80 % entraînement / 10 % validation / 10 % test, découpage **par
classe** (`scripts/make_split.sh`), mélange uniforme et reproductible : le
générateur de Python est semé par la graine (42 par défaut, 3e argument
optionnel du script). Le script vérifie ensuite que la répartition par nombre de
pièces (≤ 10, 11-20, > 20) est la même dans l'entraînement et dans le test à
3 points près, et l'affiche.

**Pourquoi.** Le découpage par classe garantit que chaque classe est présente
dans les trois lots. Le lot de validation est pris **à l'intérieur** du fichier
d'entraînement (10 % des positions, fixées après le mélange) et le lot de test
est un fichier séparé, jamais vu pendant l'entraînement : il n'y a pas de fuite
de données.

**Correction du 25/10.** La version précédente utilisait
`shuf --random-source=<(yes 42)`. Ce flux ne contient que trois valeurs d'octets
distinctes, ce qui biaise fortement les tirages de `shuf` : le mélange est
reproductible mais **pas uniforme**. Mesures :

- sur 100 000 entiers, la moyenne des 10 000 premiers tirés est 37 262 au lieu
  de 50 000, et celle des 10 000 derniers 65 284 : l'ordre d'origine est
  conservé en tendance ;
- sur le dataset, les positions sont stockées par nombre de pièces
  (`10_pieces.txt`, `20_pieces.txt`, `many_pieces.txt`), donc ce biais se
  traduit directement dans le découpage : le jeu de test contenait **37,6 %** de
  positions à plus de 20 pièces contre **17,9 %** dans l'entraînement, et 24,4 %
  de finales contre 36,1 %.

Le test n'était donc pas un échantillon de la même distribution que
l'entraînement : il mesurait une population plus difficile, et les chiffres
publiés avant le 25/10 (dont 85,15 % pour le medium) ne sont pas comparables à
ceux obtenus après correction. Le script mélange désormais avec le générateur
de Python semé par la graine, et affiche les deux compositions :
`33,7 / 44,7 / 21,6 %` pour l'entraînement contre `33,8 / 44,7 / 21,5 %` pour le
test.

## 15. Choix techniques C++

| Choix | Alternative | Pourquoi |
|-------|-------------|----------|
| `Matrix` maison (float, ligne par ligne) | Eigen / BLAS | pas de dépendance externe, contrôle total sur les messages d'erreur |
| Format `.nn` binaire (magic `MYTN`, version 2) | JSON / sérialisation texte | binaire = lecture rapide et taille constante ; le format est documenté dans `docs/NN_FILE_FORMAT.md` |
| Erreurs = exceptions derivatives de `Error`, code de sortie 84 | codes de retour | le message d'erreur va sur stderr, le processus se termine proprement |
| `unique_ptr<Layer>` dans `NetworkFile` | `shared_ptr` | une seule porte sur une couche, transfert de propriété explicite |
| Un commit par fichier, messages en anglais | commits groupés | relecture simple, historique lisible |

## 16. Ce qui n'a pas été retenu, et pourquoi

- **Adam / RMSProp / Adagrad** : non implémentés. Le format `.nn` version 2 ne
  stocke pas le type d'optimiseur ; le SGD avec momentum est livré et mesuré.
- **Dropout** : module non écrit ; l'augmentation, le L2 et la sélection du
  meilleur epoch contiennent déjà le surapprentissage (précision d'entraînement
  et de validation à moins d'un point sur le medium).
- **Encodage positionnel plus riche** (cases en coordonnées, attacks
  pré-calculées) : hors du format imposé (773 valeurs).
- **Distribution multi-machines** : le parallélisme retenu est intra-processus
  (OpenMP), pas un entraînement distribué.
- **Early stopping strict** : la sélection du meilleur epoch garde le meilleur
  modèle sans arrêter l'entraînement ; un arrêt sur stagnation aurait coupé la
  progression de validation avant le pic (le `medium` culmine à l'epoch 133).

## 17. Parallélisme du produit matriciel (bonus)

**Choix.** `Matrix::operator*` parallélise la boucle sur les **lignes de sortie**
avec OpenMP. Chaque ligne est indépendante : aucune réduction, donc l'ordre des
additions est inchangé et le résultat reste **identique au bit près**. Le
parallélisme est désactivé sous un seuil de travail (200 000 opérations) pour ne
pas payer le coût d'une région parallèle sur les petites matrices. La
compilation ajoute `-fopenmp` et `-march=native` (AVX2/FMA).

**Mesure.** Réseau medium, 4 000 positions, 60 epochs, même réseau de départ :

| Configuration | Temps | Gain |
|---------------|-------|------|
| 1 thread, sans AVX | 52,2 s | référence |
| 1 thread, `-march=native` | 40,4 s | 1,29× |
| 4 threads, `-march=native` | **19,0 s** | **2,74×** |

La machine a 4 cœurs physiques et 8 threads logiques. Au-delà de 4 threads, la
bande passante mémoire sature et le temps remonte (8 threads mesurés plus lents
que 1 thread) : les scripts et le README recommandent `OMP_NUM_THREADS=4`.

**Vérification.** Les fichiers `.nn` produits avec 1 et 8 threads sont identiques
octet pour octet, et les prédictions des trois réseaux sur 3 000 positions sont
identiques à la version sans OpenMP. Le parallélisme ne change donc ni
l'apprentissage ni les résultats, seulement la durée.

## 18. Augmentation par les symétries de l'échiquier

**Constat.** Sans augmentation ni L2, le réseau medium plafonnait : la
précision de validation atteignait 84,9 % dès l'epoch 16 et ne bougeait plus
pendant 44 epochs, alors que la précision d'entraînement montait de 94 % à 98 %.
Le problème n'était donc ni la durée d'entraînement ni le learning rate : le
réseau apprenait par cœur des positions qu'il ne généralisait pas. Aucune
régularisation ne peut inventer de l'information ;
il faut en ajouter.

**Choix.** À chaque mini-batch, chaque position est transformée par l'une des
quatre symétries du jeu, tirée uniformément avec le générateur du `.nn` (donc
reproductible à graine égale) :

| Symétrie | Effet sur l'encodage |
|----------|----------------------|
| identité | aucune |
| miroir gauche-droite | case (rangée, colonne) → (rangée, 7 − colonne) ; roques `K`↔`Q`, `k`↔`q` |
| inversion des couleurs | canaux `PNBRQK` ↔ `pnbrqk` ; **rangées retournées (8 ↔ 1)** ; trait inversé ; roques `KQ` ↔ `kq` |
| les deux | composées |

**Exactitude des symétries.** Le miroir gauche-droite est une symétrie exacte du
jeu : toutes les attaques, pions compris, sont symétriques de gauche à droite.
Pour l'inversion des couleurs, les pièces autres que les pions ne posent aucun
problème (un cavalier, un fou, une tour, une dame ou un roi attaquent de la même
façon quelle que soit leur couleur). Les pions, si : un pion blanc attaque vers le
haut et un pion noir vers le bas, donc pour que « Check » reste « Check » quand un
pion donne l'échec, il faut **aussi retourner l'échiquier verticalement**
(rangée 8 ↔ rangée 1). Ce
retournement a été **ajouté le 27/10/2026** ; avant, `swapColors` n'échangeait que
les couleurs (voir « Défaut corrigé » ci-dessous). En mode `full`, où la couleur
est une classe, l'inversion échange
`Check White` ↔ `Check Black` et `Checkmate White` ↔ `Checkmate Black` ;
l'étiquette est échangée en même temps que l'entrée. Seules les entrées
d'entraînement sont transformées : la validation reste intacte, sinon la mesure ne
serait plus comparable d'un epoch à l'autre.

**Alternatives.** Ne rien faire (le `basic` sans augmentation plafonne à
83,69 % sans TTA à l'inférence, 87,26 % avec) ; dropout (module toujours non
écrit) ; L2 seul (mesuré : +0,8 point) ;
doubler le dataset en mémoire (2× la RAM, et la même position revue à l'identique
à chaque epoch au lieu de quatre orientations).

**Mesure** (réalisée **avec la version d'avant la correction**, voir « Défaut
corrigé » plus bas). Criblage sur 100 000 positions du stratum le plus difficile
(positions à 20 pièces, là où la marge est la plus grande), réseau medium,
40 epochs, même initialisation (graine 42), 4 threads :

| Configuration | Meilleure précision val. | F1 macro val. | Précision train à l'epoch 40 |
|---------------|--------------------------|---------------|------------------------------|
| sans | 67,95 % | 0,6670 | 99,1 % |
| L2 = 1e-3 | 68,72 % | 0,6748 | 96,7 % |
| augmentation | 71,51 % | 0,7037 | 83,7 % |
| **augmentation + L2 = 1e-3** | **72,48 %** | **0,7152** | **80,3 %** |

Les valeurs absolues ne sont pas comparables aux 86 % du dataset complet (ce
criblage ne contient que des positions à 20 pièces, plus difficiles) ; seuls les
écarts le sont. L'augmentation apporte **+4,5 points** et fait chuter la précision
d'entraînement de 19 points : c'est bien le surapprentissage qui recule. Elle
coûte environ 7 % de temps par epoch. Le L2 reste utile en plus (+1 point), donc
les deux sont conservés.

**Cas du basic.** Le réseau 64-32 n'a pas la capacité d'exploiter quatre
orientations par position : entraîné avec augmentation, il plafonne à 76,8 % de
validation à l'epoch 92 (contre 83,7 % pour le même réseau sans augmentation, au
meilleur epoch 117). `scripts/train_basic.sh` désactive donc l'augmentation
(`MYTORCH_AUGMENT=0`) et garde `l2 = 0` ; medium et full l'activent. Avec
augmentation, le basic sous-entraîne (entraînement et validation bloqués autour
de 77 %) ; sans augmentation, il apprend mieux mais reste limité par sa capacité
(83,7 % de validation).

**Vérification.** `tests/test_augment.cpp` compare le résultat des transformations
à des FEN écrits à la main (miroir, inversion des couleurs, et trois cas d'échec de
**pion** qui doivent rester des échecs), vérifie les droits de roque, la
conservation des 32 pièces et du codage one-hot, l'échange des classes en mode
`full` et la reproductibilité du tirage. Ces tests ont été écrits pour le
comportement corrigé et échouent bien avec l'ancien code (6 vérifications). En plus,
le 27/10/2026, les trois symétries du **vrai code C++** ont été appliquées à 120 000
positions du dataset et relues par le détecteur d'échec indépendant de
`scripts/audit_augmentation.py` : **100,00 % des `Check`/`Checkmate` restent un
échec et aucun `Nothing` ne devient un échec**, pour le miroir, l'inversion des
couleurs et leur composition.

**Défaut corrigé (audit du 27/10/2026).** Jusqu'à cette date, `swapColors`
(`src/chess/Augment.cpp`) échangeait les couleurs, le trait et les droits de roque
mais **ne retournait pas l'échiquier**. `./scripts/audit_augmentation.py` embarque
son propre détecteur d'échec (validé contre les étiquettes : 100,00 % des
`Check`/`Checkmate` ont bien leur roi du trait attaqué, 0,00 % des `Nothing`) et
mesure, sur 120 000 positions tirées au hasard du dataset :

| Transformation | `Check`/`Checkmate` qui restent un échec | échecs avec un pion qui restent un échec | `Nothing` qui deviennent un échec |
|----------------|-----------------------------------------|------------------------------------------|-----------------------------------|
| ancienne version (couleurs seules) | 95,12 % | 1,12 % | 1,03 % |
| version actuelle (couleurs **et** échiquier retourné) | 100,00 % | 100,00 % | 0,00 % |

Un pion participe à l'attaque dans 4,94 % des échecs et des mats. Pour ces
positions, l'ancienne inversion des couleurs produisait une entrée dont l'étiquette
était fausse. Comme l'inversion est tirée dans 2 des 4 symétries, cela représentait
environ **1,8 % des échantillons augmentés** (95,12 % de conservation sur 67,8 % de
positions d'échec, 98,97 % sur 32,2 % de `Nothing`, divisé par deux).

**Ce qui est corrigé, et l'effet mesuré.**

- Le **code** est corrigé (retournement des rangées dans `swapColors`) et testé.
- Les réseaux **`medium` et `full` livrés ont été réentraînés le 5/11/2026 avec la
  version corrigée**, à graine et découpage identiques. Sur le jeu de test, en
  une passe (sans TTA) : `medium` 86,15 % → **89,97 %** (F1 85,45 % → 89,32 %) et
  `full` 86,04 % → **90,00 %** (F1 85,36 % → 89,34 %), soit +3,8 et +4,0 points de
  précision. Tous les chiffres de `benchmarks/` viennent de ces modèles.
- Le `basic` n'est pas concerné (entraîné sans augmentation). Réentraîné à
  l'identique, il produit **le même fichier** (même empreinte md5), ce qui
  confirme le déterminisme de la chaîne et isole l'effet du correctif.
- Les +4,5 points du criblage ci-dessus avaient été mesurés avec l'ancienne
  version ; le réentraînement montre que le gain réel sur le dataset complet est
  encore plus élevé.
- L'augmentation ne sert qu'à l'entraînement : elle ne change pas les poids du
  `.nn` livré. La prédiction applique en plus une TTA explicite (§19), qui
  moyenne les sorties de quatre orientations sans modifier le réseau.

## 19. Test-time augmentation à la prédiction

**Problème.** Le réseau est entraîné sur les quatre symétries exactes de
l'échiquier (§18), mais il prédit une position dans son orientation d'origine.
Sur certaines configurations, une même position tournée ou coloriée produit une
sortie différente : le modèle a appris une fonction qui n'est pas parfaitement
invariante, et l'`argmax` d'une seule passe conserve ce biais d'orientation.

**Choix.** À la prédiction, chaque position est présentée aux **quatre
symétries exactes** (identité, miroir gauche-droite, inversion des couleurs avec
retournement des rangées, les deux). Les probabilités Softmax des quatre passes
sont moyennées, puis on prend l'`argmax`. En mode 5 classes, les colonnes
`Check White` ↔ `Check Black` et `Checkmate White` ↔ `Checkmate Black` sont
rééchangées après les symétries qui inversent les couleurs ; en mode 3 classes,
aucune colonne n'est échangée (les libellés ne nomment pas de couleur).

**Pourquoi c'est légitime.** Aucun poids n'est modifié et aucune donnée de test
n'est utilisée pour l'apprentissage : c'est un **ensemble de quatre vues** de la
même position, exactement les transformations qui conservent la classe. Le coût
est de quatre passes avant au lieu d'une.

**Mesure sur le jeu de test (72 303 positions).**

| Réseau | Avant TTA | Après TTA | Gain |
|--------|-----------|-----------|------|
| basic | 83,69 % | 87,26 % | +3,57 |
| medium | 89,97 % | 93,05 % | +3,08 |
| full (3 classes) | 90,00 % | 93,00 % | +3,00 |
| full (5 classes, exact) | 90,00 % | 93,00 % | +3,00 |

Le F1 macro du `full` passe de 88,27 % à **91,53 %** dans son espace natif. Sur
les positions où un camp est en échec ou mat, la couleur seule est prédite à
**98,44 %**. Sur la démo des cinq FEN du sujet, le `full` corrige aussi le mat
de l'imbécile : `Check Black` devient `Checkmate Black`.

**Limites.** La TTA ne remplace pas un meilleur modèle : elle réduit la variance
d'orientation, pas l'erreur de frontière entre `Check` et `Checkmate`. Elle
multiplie le temps d'inférence par quatre (3,33 s pour `basic`, 8,36 s pour
`medium`, 9,10 s pour `full` sur les 72 303 positions). L'implémentation est
dans `src/analyzer/PredictMode.cpp`, fonction `predictWithSymmetries`.
