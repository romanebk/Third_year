# 01 — Marché, problème et concurrence

> Rappel : les chiffres marqués `[H]` sont des hypothèses de travail à valider,
> pas des données de marché sourcées.

## 1. Le problème

### 1.1 Le constat

Un modèle de machine learning vit presque toujours dans un écosystème Python :
PyTorch ou TensorFlow pour l'entraînement, un export ONNX pour l'inférence, puis
un runtime à intégrer. C'est raisonnable pour une équipe data. Ça l'est beaucoup
moins pour une équipe produit qui livre un binaire C++ :

- **Pas de Python en production.** Beaucoup d'environnements industriels,
  embarqués, défense ou finance interdisent un interpréteur Python dans le
  binaire livré.
- **Pas de dépendance lourde.** Un runtime type LibTorch pèse des centaines de
  mégaoctets et entraîne une chaîne de dépendances difficile à auditer.
- **Pas de GPU.** Sur un automate, un boîtier edge ou un poste client, le CPU
  suffit pour un petit modèle — mais il faut que le modèle tienne et que
  l'inférence soit rapide.
- **Besoin d'auditabilité.** Dans un contexte réglementé, « le modèle est dans
  une boîte noire Python » est un problème de conformité. Un code C++ de quelques
  milliers de lignes, testé, déterministe, s'audite.
- **Besoin de reproductibilité.** Un résultat qui change d'une exécution à
  l'autre est inacceptable pour une certification ou un test de non-régression.

### 1.2 La douleur, en une phrase

> « Je veux ajouter un petit classifieur à mon logiciel C++, sans embarquer
> Python, sans GPU, sans dépendance externe, et pouvoir expliquer comment il
> calcule sa sortie. »

### 1.3 Ce que fait MyTorch

MyTorch répond à ce besoin avec un moteur C++17 autonome :

- **créer** un réseau depuis un fichier `.conf` ;
- **sauvegarder / charger** un réseau dans un format binaire documenté (`.nn`) ;
- **entraîner** le réseau (SGD, momentum, L2, mini-batchs) ;
- **prédire** en lot, avec un format de sortie strict ;
- **mesurer** (accuracy, F1 macro, précision/rappel/F1 par classe, matrice de
  confusion) et exporter les résultats en CSV.

Le tout sans PyTorch, TensorFlow, Eigen, BLAS ou NumPy dans le chemin de calcul.
NumPy n'apparaît que dans un script de graphiques, hors binaire.

## 2. Segments de marché

### 2.1 Segment principal : l'industrie et l'embarqué en C++

| Caractéristique | Valeur |
|-----------------|--------|
| Taille d'entreprise | PME et ETI, 20 à 2 000 personnes |
| Secteurs | industrie, énergie, transport, défense, finance, santé, jeu vidéo |
| Contrainte | code C++ existant, pas de Python en production, pas de GPU |
| Besoin | un petit modèle (classification, détection d'anomalie, scoring) |
| Décideur | CTO, responsable R&D, architecte logiciel |
| Budget | 10 à 50 k€ par projet `[H]` |

### 2.2 Segment secondaire : la formation et l'enseignement

Le moteur est volontairement lisible : `Matrix`, `Dense`, `Softmax`, `Loss`,
`Optimizer` tiennent en quelques fichiers, avec un test de gradient par
différences finies. C'est un support pédagogique pour comprendre un réseau sans
boîte noire.

| Caractéristique | Valeur |
|-----------------|--------|
| Cible | écoles d'ingénieurs, formations C++, bootcamps |
| Besoin | un exemple complet, compilable, sans dépendance |
| Modèle | licence de support, ateliers, contenu |
| Prix | 2 à 10 k€ par session `[H]` |

### 2.3 Segment vitrine : l'analyse d'échecs

Le classifieur `Nothing` / `Check` / `Checkmate` est un **démonstrateur**, pas le
produit. Il a l'avantage d'être :

- vérifiable (les règles des échecs sont connues) ;
- mesurable (72 303 positions de test) ;
- crédible (93,05 % d'accuracy, 8,4 s pour 72 k positions).

Un produit d'analyse d'échecs se heurterait à Stockfish et aux moteurs NNUE, qui
sont bien meilleurs et gratuits. On ne construit **pas** l'entreprise là-dessus.
Les échecs servent à prouver que le moteur fonctionne sur un problème réel.

### 2.4 Ce qu'on ne vise pas

- Les équipes qui ont déjà une stack Python/GPU : elles n'ont pas le problème.
- Les microcontrôleurs à 64 Ko de RAM : TFLite Micro est mieux placé.
- Les LLM : le moteur n'est pas fait pour ça.
- Le grand public : pas de produit SaaS grand public dans les 24 premiers mois.

## 3. Taille de marché (bottom-up)

Plutôt qu'un TAM global impossible à défendre, on construit le marché par le bas.

### 3.1 Hypothèses

| # | Hypothèse | Valeur `[H]` |
|---|-----------|--------------|
| H1 | entreprises dans le monde avec une base C++ et un projet ML actif | 30 000 |
| H2 | part qui ne peut pas ou ne veut pas de Python/runtime lourd en production | 20 % |
| H3 | part qui paierait pour un moteur léger, auditable et supporté | 30 % |
| H4 | revenu annuel moyen par client (support + intégration amortie) | 15 k€ |

### 3.2 Calcul

```
SAM = H1 × H2 × H3 × H4
    = 30 000 × 0,20 × 0,30 × 15 000 €
    = 27 M€ / an
```

- **TAM** (toutes les entreprises C++ ayant un besoin ML, même avec Python) :
  30 000 × 15 k€ = **450 M€** `[H]`.
- **SAM** (celles qui ont la contrainte « pas de Python / pas de runtime
  lourd ») : **27 M€** `[H]`.
- **SOM à 3 ans** (part réaliste pour une équipe de deux) : **~50 clients**,
  soit **700 k€ de revenu annuel** `[H]`.

### 3.3 Ordre de grandeur global

Le marché de l'IA embarquée / edge AI est régulièrement décrit en dizaines de
milliards de dollars. C'est un **contexte**, pas notre marché : notre SAM est
étroit et c'est assumé. Un plan qui revendique 1 % d'un marché de 50 Md$ n'est
pas crédible pour une équipe de deux ; un plan qui vise 50 clients identifiés
l'est davantage.

### 3.4 Test de réalité

Avant d'investir, valider H1 à H4 par **20 entretiens** :

1. 10 CTO/architectes de PME industrielles européennes ;
2. 5 responsables R&D embarqué ;
3. 5 écoles/formations C++.

Question centrale : « combien coûte aujourd'hui l'intégration d'un petit modèle
dans votre code C++, et combien paieriez-vous pour ne plus le faire ? »

## 4. Concurrence

| Acteur | Ce qu'il fait | Force | Faiblesse pour notre cible |
|--------|---------------|-------|----------------------------|
| **PyTorch / LibTorch** | framework complet, C++ API | écosystème, GPU, autograd | lourd, build complexe, difficile à auditer, dépendances |
| **TensorFlow / TFLite** | entraînement + déploiement | outillage, mobile | runtime et format externes, surface énorme |
| **ONNX Runtime** | inférence C++ | performant, standard | **inférence seulement**, pas d'entraînement, dépendance |
| **TFLite Micro** | microcontrôleurs | très léger | ops limitées, pas d'entraînement, cible différente |
| **ggml / llama.cpp** | inférence LLM en C/C++ | performances, communauté | orienté LLM, pas généraliste, pas d'entraînement |
| **Stockfish / NNUE** | moteur d'échecs | force de jeu | spécifique aux échecs, ce n'est pas une bibliothèque ML |
| **Leela Chess Zero** | RL pour les échecs | très fort | lourd, GPU, pas un moteur embarquable |
| **« on le fait nous-mêmes »** | code interne | contrôle total | 3 à 6 mois d'ingénieur, tests à écrire, maintenance |

### 4.1 La vraie alternative : le faire soi-même

Le concurrent principal n'est pas PyTorch. C'est le **statu quo** :

- un data scientist exporte un modèle ONNX ;
- un ingénieur C++ écrit une couche d'intégration ;
- l'équipe maintient un runtime externe ;
- ou bien on renonce à la fonctionnalité.

Le coût caché est de plusieurs mois-homme, plus la maintenance. C'est ce coût
que MyTorch vend, pas une supériorité algorithmique.

### 4.2 Pourquoi pas LibTorch ?

C'est la question la plus dangereuse. Réponse honnête :

- LibTorch est **excellent** si on a le droit à une dépendance lourde et si on
  veut l'écosystème PyTorch.
- MyTorch vise le cas inverse : **un binaire autonome, petite surface, code
  auditable, comportement déterministe**.
- MyTorch n'a **pas** l'ambition de remplacer PyTorch. Il couvre les petits
  modèles `Dense` dans les environnements où PyTorch est trop gros ou interdit.

Si le client peut utiliser LibTorch, il doit utiliser LibTorch. Le produit
n'existe que pour ceux qui ne peuvent pas.

## 5. Positionnement

### 5.1 Énoncé

> Pour les équipes qui livrent du C++ et ne peuvent pas embarquer Python ni un
> runtime ML lourd, **MyTorch** est un moteur de réseaux de neurones autonome,
> entraînable et auditable, qui tient dans deux archives statiques.
> Contrairement à PyTorch/LibTorch, il ne demande aucune dépendance externe ;
> contrairement à ONNX Runtime, il sait aussi entraîner.

### 5.2 Ce qui nous différencie

| Atout | Preuve dans le dépôt |
|-------|----------------------|
| zéro dépendance tierce | `ar t libmytorch.a`, aucun `#include` externe (hors C++ standard/OpenMP) |
| séparation moteur / métier | `libmytorch.a` vs `libchess.a` |
| déterminisme | graine 42, OpenMP sans réduction, résultat identique au bit près |
| auditabilité | ~15 fichiers, 13 suites de tests, gradient check |
| format documenté | `docs/NN_FILE_FORMAT.md`, magic `MYTN`, version 2 |
| petit modèle | 239 491 paramètres, < 1 Mo, 22 µs/position |
| double usage | entraînement **et** inférence en C++ |

### 5.3 Ce qui n'est pas un moat

Il faut le dire avant le jury :

- le code est **copiable** (open source) ;
- les algorithmes sont **classiques** (SGD, ReLU, softmax) ;
- la performance pure n'est pas meilleure qu'une bibliothèque optimisée ;
- il n'y a **pas de brevet** ni de technologie propriétaire.

Le moat réel est la **confiance** : tests, documentation, support, intégration,
et la relation avec les premiers clients. C'est un moat de service, pas de
technologie.

## 6. Risques de marché

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| PyTorch/LibTorch devient assez léger | moyenne | élevé | rester sur l'auditabilité et le zéro dépendance |
| ONNX Runtime ajoute l'entraînement | faible | moyen | se différencier par la simplicité et le support |
| Le marché est trop petit | moyenne | élevé | valider par 20 entretiens avant d'investir |
| Les clients préfèrent le faire eux-mêmes | élevée | moyen | vendre l'intégration et la maintenance, pas la licence |
| Cycle de vente industriel long | élevée | élevé | commencer par des pilotes courts (4 à 8 semaines) |
| IA réglementée (AI Act) | moyenne | opportunité | l'auditabilité devient un argument de vente |

## 7. Ce qu'il faut retenir pour la soutenance

1. Le produit n'est **pas** un moteur d'échecs : c'est un moteur C++ générique.
2. Les échecs sont la **preuve mesurée**, pas le marché.
3. Le concurrent principal est le **statu quo**, pas PyTorch.
4. Le marché est **petit mais accessible** : 50 clients à 3 ans, pas 1 % du
   monde.
5. Le moat est la **confiance** (tests, doc, support), pas un algorithme secret.
