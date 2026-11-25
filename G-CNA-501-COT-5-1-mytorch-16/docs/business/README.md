# Plan business — MyTorch

> **Statut** : document de travail pour la soutenance. Il ne fait pas partie du
> sujet technique et ne change aucune promesse du rendu.
>
> **Avertissement méthodologique** : les chiffres de marché, les prix et les
> projections de ce dossier sont des **hypothèses de travail**, pas des données
> constatées. Chaque fois qu'un chiffre est une hypothèse, il est marqué
> `[H]`. Les seules données mesurées sont les résultats techniques du projet
> (accuracy, F1, temps, taille du modèle), reproductibles depuis le dépôt.

---

## 1. Résumé exécutif

**Le problème.** Une équipe qui développe un logiciel en C++ (industrie,
embarqué, défense, finance, jeu vidéo) veut ajouter un petit modèle de
classification à son produit. Aujourd'hui, elle doit soit intégrer Python et un
runtime lourd (PyTorch, TensorFlow), soit exporter vers ONNX et ajouter un moteur
d'inférence externe. Dans les environnements contraints — pas de Python en
production, pas de GPU, pas de dépendance externe, besoin d'auditer chaque
ligne — ces options sont coûteuses ou interdites.

**La solution.** `MyTorch` est un moteur de réseaux de neurones **écrit en C++17
sans bibliothèque tierce** : matrices, couches `Dense`, activations,
rétropropagation, SGD avec momentum et L2, sérialisation binaire, métriques. Il
sait **créer, sauvegarder, charger et entraîner** un réseau, et il tient dans
deux archives statiques (`libmytorch.a`, `libchess.a`).

> « Sans dépendance » signifie ici : pas de PyTorch, TensorFlow, Eigen, BLAS,
> NumPy ni Python dans le chemin de calcul. Le runtime C++ standard et OpenMP
> (optionnel) restent nécessaires, comme pour tout binaire C++.

**La preuve.** Sur un problème de référence — classer 72 303 positions d'échecs
jamais vues en `Nothing` / `Check` / `Checkmate` — le réseau medium atteint
**93,05 % d'accuracy et 92,50 % de F1 macro**, contre 41,49 % pour un modèle
constant. L'inférence prend **1,6 s pour 72 303 positions** (environ 22 µs par
position) sur un laptop, sans GPU. Le modèle pèse **239 491 paramètres** (moins
d'un mégaoctet).

**Le marché visé.** Le *beachhead* n'est pas le jeu d'échecs : c'est l'**inférence
et l'entraînement de petits modèles dans du code C++ contraint**. Les échecs
servent de démonstrateur crédible, mesuré et reproductible.

**Le modèle économique.** Open-core : le moteur est open source pour l'adoption ;
les revenus viennent du support, de l'intégration, de la formation et des
licences commerciales pour les entreprises qui ne peuvent pas ouvrir leur code.
Trois contrats de support et deux intégrations suffisent à couvrir les coûts de
la première année dans le scénario de base `[H]`.

**La demande.** `250 k€` de pré-amorçage `[H]` pour financer 24 mois de
développement produit, ou un démarrage bootstrappé en services. Détail et
scénarios : `02_OFFRE_ET_MODELE_ECONOMIQUE.md`.

**L'équipe.** Ariel (cœur du réseau, optimisation, build, tests) et Divine
(données, CLI, sérialisation, benchmarks, documentation). Le projet est un
livrable académique EPITECH 2026 ; le plan business est un exercice de
valorisation, pas une société existante.

---

## 2. Sommaire

| Fichier | Contenu |
|---------|---------|
| `01_MARCHE_ET_CONCURRENCE.md` | problème, segments, TAM/SAM/SOM, concurrents, positionnement |
| `02_OFFRE_ET_MODELE_ECONOMIQUE.md` | offre, pricing, coûts, projections, financement, licence |
| `03_GO_TO_MARKET_ET_ROADMAP.md` | acquisition, phases, roadmap technique, KPIs, risques |
| `04_PITCH_ET_QUESTIONS.md` | pitch 10 slides, scripts 30 s / 2 min, questions business |

---

## 3. Les 5 chiffres à retenir

| Chiffre | Sens | Source |
|---------|------|--------|
| **93,05 %** | accuracy du medium sur le test | mesuré, `README.md` §7 |
| **22 µs** | temps d'inférence par position | mesuré, 1,6 s / 72 303 |
| **239 491** | paramètres du medium (< 1 Mo) | mesuré, architecture |
| **0** | dépendance externe du moteur | mesuré, `ar t libmytorch.a` |
| **10 k€/an** | prix moyen hypothétique d'un contrat de support | `[H]` |

---

## 4. Comment utiliser ce dossier en soutenance

- **Slide 1** : le problème (Python interdit / runtime lourd) + la solution en une
  phrase.
- **Slide 2** : la démo technique (les 5 FEN, `ar t libmytorch.a`).
- **Slide 3** : le marché et le modèle (beachhead, open-core, 3 revenus).
- **Slide 4** : la demande et la roadmap (ou « bootstrappé », si le jury préfère
  la prudence).

Ne pas présenter les projections comme des prévisions. Dire : « voici le
scénario de base et ses hypothèses ; la seule chose mesurée, c'est le produit. »

---

## 5. Ce que ce plan n'est pas

- Ce n'est pas une promesse de financement.
- Ce n'est pas une étude de marché sourcée : les ordres de grandeur `[H]` doivent
  être validés par 20 entretiens clients avant toute décision.
- Ce n'est pas un changement de périmètre technique : le rendu reste le moteur,
  l'analyseur, le générateur et les trois réseaux pré-entraînés.
