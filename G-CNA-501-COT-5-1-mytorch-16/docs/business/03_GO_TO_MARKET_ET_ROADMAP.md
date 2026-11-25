# 03 — Go-to-market, roadmap et risques

> Les objectifs et les chiffres de ce fichier sont des hypothèses `[H]`.

## 1. Objectif à 12 mois

> **3 pilotes payants signés, 10 entretiens clients documentés, 1 000
> téléchargements du moteur, et une première version 3 du format `.nn`.**

Le but n'est pas de faire 1 M€ la première année. C'est de prouver que le besoin
existe et que quelqu'un paie.

## 2. Les quatre phases

### Phase 0 — Crédibilité open source (mois 0 à 3)

| Action | Livrable | Coût |
|--------|----------|------|
| Publier le dépôt propre | README, benchmarks, `check_release.sh` | 0 |
| Écrire 3 articles techniques | « gradient check en C++ », « zéro dépendance », « 86 % sur 72 k positions » | temps |
| Ouvrir les issues / discussions | template de bug, guide de contribution | 0 |
| Préparer une démo reproductible | `make && ./scripts/check_release.sh` | 0 |

**KPI de sortie** : 300 visites GitHub/mois, 50 téléchargements, 5 retours
qualifiés.

### Phase 1 — Design partners (mois 3 à 6)

| Action | Livrable |
|--------|----------|
| 20 entretiens (10 industrie, 5 embarqué, 5 écoles) | grille de besoins remplie |
| 3 pilotes gratuits ou à prix coûtant | intégration réelle, retour écrit |
| Mesure du temps d'intégration | « 2 jours au lieu de 3 mois » `[H]` |
| Première grille de prix validée | 3 propositions envoyées |

**KPI de sortie** : 3 pilotes, 2 lettres de recommandation, 1 premier contrat
payant.

### Phase 2 — Premiers revenus (mois 6 à 12)

| Action | Livrable |
|--------|----------|
| Vendre 3 à 5 supports annuels | 30 à 50 k€ `[H]` |
| Vendre 2 intégrations | 40 k€ `[H]` |
| Publier un cas client anonymisé | preuve sociale |
| Mettre en place un CRM simple | pipeline suivi |

**KPI de sortie** : 50 à 90 k€ de revenu, pipeline de 10 opportunités, CAC
mesuré.

### Phase 3 — Produit et récurrence (mois 12 à 24)

| Action | Livrable |
|--------|----------|
| Version 3 du format `.nn` | CNN, dropout, Adam |
| Support multi-plateforme | Linux, macOS, Windows, ARM |
| Offre Pro structurée | SLA, documentation, portail |
| Recrutement | 1 ingénieur, 1 commercial (si revenus) |

**KPI de sortie** : 15 à 25 contrats de support, 200 k€ de revenu récurrent.

## 3. Canaux d'acquisition

| Canal | Coût | Délai | Priorité |
|-------|------|-------|----------|
| Contenu technique (blog, GitHub) | temps | 3 à 6 mois | **1** |
| Meetups C++ / conférences | 1 à 3 k€ | 3 à 9 mois | **2** |
| LinkedIn ciblé (CTO, R&D) | temps | 1 à 3 mois | **3** |
| Écoles et formations | 0 à 2 k€ | 1 à 6 mois | **4** |
| Incubateurs / accélérateurs | 0 à 5 k€ | 6 à 12 mois | 5 |
| Publicité payante | 2 à 5 k€/mois | immédiat | **non** |

### 3.1 Pourquoi le contenu d'abord

Le produit est technique et le marché est étroit. Un article qui explique
comment vérifier un gradient par différences finies attire exactement les
personnes qui peuvent décider d'acheter. La publicité généraliste attire tout le
monde sauf les bons clients.

### 3.2 Entonnoir cible (année 1)

```
1 000 visiteurs GitHub / mois
   └─ 10 % téléchargent              = 100
        └─ 20 % compilent et testent = 20
             └─ 25 % parlent        = 5 conversations
                  └─ 20 % achètent  = 1 client / mois
```

Pour 10 clients la première année, il faut donc environ 10 000 visites, soit
~830 par mois. C'est ambitieux sans audience, d'où l'importance des meetups et
des écoles.

## 4. Roadmap technique

### 4.1 Version 1 (livrée)

- `Matrix`, `Dense`, ReLU/sigmoid/tanh/softmax.
- SGD + momentum + L2.
- `.nn` version 2, générateur, analyseur.
- 13 suites de tests, gradient check.
- Benchmarks reproductibles.

### 4.2 Version 2 (0 à 6 mois)

| Fonctionnalité | Pourquoi | Effort |
|----------------|----------|--------|
| Export/import ONNX | parler à l'écosystème existant | 3 à 4 semaines |
| Bindings C (API stable) | intégration facile dans tout langage | 2 semaines |
| CMake + paquet Conan/vcpkg | installation en une ligne | 2 semaines |
| CI multi-OS (Linux/macOS/Windows) | crédibilité | 1 semaine |
| Tests ARM (Raspberry Pi) | promesse embarqué | 1 semaine |
| Quantization int8 | modèles plus petits, plus rapides | 3 semaines |

### 4.3 Version 3 (6 à 12 mois)

| Fonctionnalité | Pourquoi | Effort |
|----------------|----------|--------|
| Entrée 8×8×12 + couche convolution | localité, gain attendu sur l'image | 4 à 6 semaines |
| Dropout | régularisation | 1 semaine |
| Adam | convergence | 1 semaine |
| Format `.nn` version 3 | accueillir les nouveaux champs | 2 semaines |
| Sauvegarde de l'état de l'optimiseur | reprendre un entraînement | 1 semaine |
| Bindings Python (optionnels) | prototypage, pas production | 2 semaines |

### 4.4 Ce qui reste hors périmètre

- GPU / CUDA.
- LLM / transformers.
- Autograd général (graphe dynamique).
- Distributed training.

## 5. KPIs

### 5.1 Produit

| KPI | Cible 12 mois | Pourquoi |
|-----|---------------|----------|
| temps « clone → première prédiction » | < 10 min | friction d'adoption |
| tests au vert | 100 % | confiance |
| couverture des cas CLI | 100 % | contrat du sujet |
| latence d'inférence | < 50 µs/position | promesse embarqué |
| taille du binaire | < 5 Mo | promesse légèreté |

### 5.2 Business

| KPI | Cible 12 mois |
|-----|---------------|
| entretiens clients | 20 |
| pilotes | 3 |
| contrats payants | 3 à 5 |
| revenu | 50 à 90 k€ `[H]` |
| CAC | < 3 k€ `[H]` |
| churn support | < 10 %/an `[H]` |
| pipeline | 10 opportunités |

### 5.3 Communauté

| KPI | Cible 12 mois |
|-----|---------------|
| visites GitHub / mois | 800 |
| téléchargements | 1 000 |
| issues traitées < 7 jours | 90 % |
| contributeurs externes | 3 |

**Attention aux vanity metrics** : les étoiles GitHub ne paient pas. Le KPI qui
compte est le nombre de personnes qui compilent, testent et rappellent.

## 6. Risques et mitigation

### 6.1 Risques techniques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance insuffisante face à BLAS | élevée | moyen | assumer la niche « petit modèle », benchmarker, optimizer le produit matriciel |
| Bug de gradient / régression | moyenne | élevé | gradient check en CI, tests de non-régression |
| Format `.nn` incompatible entre versions | moyenne | élevé | version dans le magic, migrations documentées |
| Sécurité (fichier `.nn` malveillant) | faible | élevé | validation des tailles, pas d'exécution de code |
| Dépendance à OpenMP | moyenne | faible | build sans OpenMP supporté |

### 6.2 Risques marché

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Marché trop étroit | moyenne | élevé | 20 entretiens avant d'investir |
| PyTorch devient la norme embarquée | moyenne | élevé | se différencier sur l'auditabilité, pas la performance |
| Clients préfèrent le DIY | élevée | moyen | vendre l'intégration et la maintenance |
| Cycle de vente long | élevée | élevé | pilotes 4 à 8 semaines, prix d'entrée bas |

### 6.3 Risques juridiques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Licence du dataset | moyenne | élevé | vérifier la provenance avant diffusion |
| AGPL refusée par un client | moyenne | moyen | proposer la licence commerciale |
| Marque « MyTorch » déjà prise | faible | moyen | recherche d'antériorité |
| Contrats de travail des fondateurs | faible | élevé | accord écrit entre les deux |

### 6.4 Risques d'exécution

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Deux personnes seulement | élevée | élevé | rester sur la niche, automatiser |
| Temps partagé avec les études | élevée | moyen | jalons courts, scope réduit |
| Perte d'un fondateur | faible | critique | documentation, code ouvert, pas de secret |

## 7. Jalons et go / no-go

| Moment | Jalon | Décision |
|--------|-------|----------|
| M0 | dépôt public, démo | continuer |
| M3 | 10 entretiens, 300 visites/mois | ajuster le discours |
| M6 | **3 pilotes, 1 premier contrat** | **go** si oui, sinon pivot |
| M9 | 3 contrats de support | recruter ou non |
| M12 | 50 à 90 k€ de revenu | lever ou bootstrapper |
| M18 | 10 contrats récurrents | version 3 |
| M24 | 200 k€ de récurrent | embaucher |

### 7.1 Le critère de pivot

Si à M6 il n'y a **aucun** pilote payant :

1. Revenir à l'enseignement (le moteur est un excellent support de cours).
2. Proposer des audits de modèles plutôt que des licences.
3. Garder le projet open source comme vitrine, sans chercher à en faire une
   société.

Ce n'est pas un échec : c'est un signal que le marché n'est pas là où on
croyait.

## 8. Ce qu'il faut dire au jury

1. Le plan est **séquencé** : open source → pilotes → récurrent → produit.
2. Le premier jalon est **commercial**, pas technique : 3 pilotes.
3. Le risque principal est **le marché**, pas le code.
4. Le critère de pivot est **explicite** : pas de pilote à M6, on change de
   modèle.
5. Les chiffres sont des **hypothèses**, et on le dit.
