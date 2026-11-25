# 02 — Offre, modèle économique et financement

> Tous les montants marqués `[H]` sont des hypothèses de travail. Ils servent à
> montrer la structure du modèle, pas à promettre un résultat.

## 1. Proposition de valeur

| Segment | Douleur | Ce qu'on vend | Bénéfice mesurable |
|---------|---------|---------------|--------------------|
| Industrie / embarqué | intégrer un modèle dans du C++ sans Python | moteur + intégration | 2 à 6 mois-homme économisés `[H]` |
| Éditeur logiciel | dépendance runtime lourde | archive statique, zéro dépendance | binaire autonome, surface d'audit réduite |
| Finance / défense | audit et reproductibilité | code testé, graine, format documenté | chaque sortie est explicable |
| École / formation | comprendre un réseau sans boîte noire | moteur lisible + atelier | 1 journée pour former une promo |
| Chess tech (vitrine) | classifier des positions | démonstrateur | 93,05 % sur 72 303 positions |

La promesse centrale :

> **« Un réseau de neurones dans votre binaire C++, sans Python, sans GPU, sans
> dépendance, avec un comportement reproductible et un code que vous pouvez
> auditer. »**

## 2. L'offre, en quatre niveaux

### 2.1 Community (gratuit)

- Le moteur `libmytorch.a` et les outils (`my_torch_generator`,
  `my_torch_analyzer`).
- La documentation, les tests, les exemples.
- Licence open source (voir §7).
- Support communautaire : issues GitHub, pas de SLA.

**Rôle** : adoption, crédibilité, vivier de clients.

### 2.2 Pro Support (abonnement)

- SLA de réponse 48 h ouvrées.
- Correctifs prioritaires et accès aux versions avant release.
- Revue de code d'intégration (2 h/mois).
- Mises à jour de sécurité.

**Prix : 10 k€ / an** `[H]`, facturé annuellement.

**Rôle** : revenu récurrent, base du modèle.

### 2.3 Intégration (forfait)

- Audit du besoin et du format de données.
- Intégration du moteur dans le build du client (CMake/Make).
- Conversion du modèle, tests de non-régression, documentation.
- Formation de l'équipe (1/2 journée).

**Prix : 15 à 30 k€ par projet** `[H]`, 2 à 6 semaines.

**Rôle** : trésorerie immédiate, compréhension fine des besoins.

### 2.4 Formation et audit (forfait)

- Atelier « écrire un réseau en C++ » (1 à 2 jours).
- Audit d'un modèle existant : reproductibilité, gradients, performance.
- Rapport écrit.

**Prix : 5 à 15 k€ par session** `[H]`.

**Rôle** : revenu sans dépendance à un gros contrat, porte d'entrée.

### 2.5 Licence commerciale (option)

Si le cœur est publié sous AGPL-3.0, une entreprise qui veut redistribuer le
moteur dans un produit fermé achète une **licence commerciale** :

**Prix : 20 k€ / an** `[H]` pour un droit de redistribution fermée.

**Rôle** : monétiser les intégrateurs sans bloquer l'adoption open source.

## 3. Modèle économique (Business Model Canvas)

| Bloc | Contenu |
|------|---------|
| **Segments** | PME/ETI industrielles, éditeurs C++, écoles, chess tech (vitrine) |
| **Proposition de valeur** | moteur C++ autonome, auditable, entraînable, sans dépendance |
| **Canaux** | GitHub, contenu technique, meetups C++, LinkedIn, écoles, incubateurs |
| **Relation client** | self-service pour Community, contrat pour Pro, projet pour l'intégration |
| **Revenus** | support annuel, intégration, formation/audit, licence commerciale |
| **Ressources clés** | code, tests, documentation, expertise C++/ML, premiers clients |
| **Activités clés** | développement, support, intégration, contenu, vente |
| **Partenaires** | écoles, incubateurs, intégrateurs C++, communautés open source |
| **Coûts** | salaires, juridique, infrastructure, marketing, déplacements |

## 4. Prix et unit economics

### 4.1 Grille de prix

| Offre | Prix `[H]` | Récurrence | Marge brute `[H]` |
|-------|------------|------------|-------------------|
| Community | 0 € | — | — |
| Pro Support | 10 000 €/an | annuelle | 80 % |
| Intégration | 20 000 €/projet | ponctuelle | 60 % |
| Formation / audit | 7 500 €/session | ponctuelle | 70 % |
| Licence commerciale | 20 000 €/an | annuelle | 95 % |

### 4.2 Unit economics (scénario de base)

| Indicateur | Valeur `[H]` | Calcul |
|------------|--------------|--------|
| ACV support | 10 000 € | prix annuel |
| Marge brute support | 8 000 € | 80 % |
| Durée de vie moyenne | 3 ans | hypothèse de rétention |
| LTV | 24 000 € | 3 × 8 000 € |
| CAC | 3 000 € | contenu + événements + temps de vente |
| LTV / CAC | 8 | sain si > 3 |
| Payback CAC | ~4,5 mois | 3 000 / (8 000/12) |

**Lecture** : le modèle tient si le coût d'acquisition reste sous 3 k€ par client.
C'est plausible en vendant par contenu technique et bouche-à-oreille, beaucoup
moins en payant de la publicité.

### 4.3 Pourquoi un prix bas ?

- Le client compare au coût du statu quo (plusieurs mois-homme), pas au prix de
  PyTorch (gratuit).
- Un prix bas réduit la friction et accélère les premiers pilotes.
- Le revenu vient de la **récurrence** et des **services**, pas d'une grosse
  licence.

## 5. Coûts

### 5.1 Structure de coûts sur 24 mois

| Poste | Montant `[H]` | Commentaire |
|-------|---------------|-------------|
| Salaires fondateurs (2 × 45 k€/an × 2 ans) | 180 000 € | coût d'opportunité, même si non versé |
| Juridique / création / contrats | 10 000 € | société, CGV, licence |
| Infrastructure (CI, serveurs, domaines) | 6 000 € | ~250 €/mois |
| Marketing / déplacements / salons | 15 000 € | 3 à 4 événements |
| Comptabilité / assurance | 8 000 € | externalisé |
| Divers / imprévus (~10 %) | 21 000 € | marge de sécurité |
| **Total** | **240 000 €** | arrondi à 250 k€ de financement |

### 5.2 Coûts variables

- Un contrat de support consomme ~20 % du prix en temps (marge 80 %).
- Une intégration consomme ~40 % du prix en temps (marge 60 %).
- Pas de coût d'inférence côté client : le modèle tourne chez lui.
- Pas de coût GPU : le moteur est CPU.

## 6. Projections à 3 ans

### 6.1 Scénario de base

Hypothèses : 2 fondateurs à temps plein, 1 recrutement en année 2, cycle de vente
de 3 à 6 mois, pas de levée après le pré-amorçage.

| Ligne | Année 1 | Année 2 | Année 3 |
|-------|---------|---------|---------|
| Contrats de support | 4 × 10 k€ = 40 k€ | 12 × 10 k€ = 120 k€ | 30 × 10 k€ = 300 k€ |
| Intégrations | 2 × 20 k€ = 40 k€ | 6 × 20 k€ = 120 k€ | 12 × 20 k€ = 240 k€ |
| Formations / audits | 1 × 5 k€ = 5 k€ | 4 × 5 k€ = 20 k€ | 8 × 5 k€ = 40 k€ |
| Licences commerciales | 0 | 2 × 20 k€ = 40 k€ | 6 × 20 k€ = 120 k€ |
| **Revenu total** | **85 k€** | **300 k€** | **700 k€** |
| Salaires | 90 k€ | 150 k€ | 240 k€ |
| Autres coûts | 25 k€ | 40 k€ | 60 k€ |
| **Coûts totaux** | **115 k€** | **190 k€** | **300 k€** |
| **EBITDA** | **−30 k€** | **+110 k€** | **+400 k€** |

Le déficit de l'année 1 est couvert par le financement. La trésorerie reste
positive si les contrats sont encaissés d'avance (annuel) ou par jalons.

### 6.2 Scénario pessimiste

- 2 contrats de support en année 1, 5 en année 2, 12 en année 3.
- Pas de licence commerciale avant l'année 3.
- Revenu : 45 k€ / 120 k€ / 300 k€.
- Conclusion : le modèle ne finance pas deux salaires ; il faut rester en
  services à temps partiel ou repositionner l'offre.

### 6.3 Scénario optimiste

- 8 contrats en année 1, 25 en année 2, 60 en année 3.
- 2 intégrations par trimestre, 3 licences commerciales dès l'année 2.
- Revenu : 190 k€ / 650 k€ / 1 400 k€.
- Conclusion : recrutement de 2 ingénieurs et d'un commercial en année 2.

### 6.4 Ce que les projections ne disent pas

- Elles ne tiennent pas compte d'un concurrent qui baisserait ses prix.
- Elles supposent que le produit reste assez différencié pour justifier 10 k€/an.
- Elles supposent une capacité de vente que deux ingénieurs n'ont pas au départ.
- Elles ne valorisent pas le temps des fondateurs au prix du marché.

C'est pour cela que le premier jalon n'est pas un chiffre d'affaires, mais
**20 entretiens clients**.

## 7. Licence et propriété intellectuelle

### 7.1 Le choix à faire

| Option | Avantage | Inconvénient |
|--------|----------|--------------|
| **MIT / Apache-2.0** | adoption maximale, simplicité | aucune protection, difficile de vendre une licence |
| **AGPL-3.0 + licence commerciale** | protection du cœur, revenu des intégrateurs | certaines entreprises refusent l'AGPL |
| **Source-available** (Business Source License) | contrôle commercial | pas open source au sens OSI, image moins bonne |

**Recommandation** : AGPL-3.0 pour le cœur + licence commerciale pour les
produits fermés. C'est le modèle « open-core » classique, compréhensible par un
jury et par un client.

### 7.2 Ce qu'il faut vérifier

- Les contributions des deux auteurs (accord écrit entre Ariel et Divine).
- Les données d'échecs : le dataset doit être redistribuable ; vérifier sa
  provenance avant de le livrer avec le produit.
- Le nom « MyTorch » : recherche d'antériorité avant dépôt de marque.
- Aucun brevet : le code n'en dépose pas et n'en dépend pas.

### 7.3 Ce qui n'est pas protégeable

Les algorithmes (SGD, ReLU, softmax) sont dans le domaine public. Le code, la
documentation et la marque le sont. L'avantage concurrentiel vient de
l'exécution, pas d'un secret.

## 8. Financement

### 8.1 Option A — pré-amorçage 250 k€

| Utilisation | Montant |
|-------------|---------|
| Salaires 24 mois | 180 k€ |
| Juridique / structure | 10 k€ |
| Infrastructure | 6 k€ |
| Marketing / ventes | 15 k€ |
| Comptabilité / assurance | 8 k€ |
| Imprévus | 21 k€ |
| **Total** | **240 k€** |

- Valorisation pre-money indicative : 1,0 à 1,5 M€ `[H]`.
- Dilution : 15 à 20 % `[H]`.
- Sortie visée : pas de sortie à 3 ans ; objectif de rentabilité.

### 8.2 Option B — bootstrap par les services

- Commencer par 2 à 3 intégrations (40 à 60 k€).
- Garder le support en récurrent.
- Développer le produit sur le temps libre.
- Avantage : pas de dilution, obligation de vendre tôt.
- Inconvénient : croissance lente, dépendance aux missions.

**Recommandation pour un projet étudiant** : Option B pour valider le besoin,
Option A seulement si 10 clients potentiels sont identifiés et 3 pilotes signés.

### 8.3 Ce que le financement n'achète pas

- Il n'achète pas la crédibilité technique : elle est déjà là (tests, benchmarks).
- Il n'achète pas le product-market fit : il faut des clients.
- Il n'achète pas une équipe : deux personnes, c'est peu pour produit + vente +
  support.

## 9. Ce qu'on ne fait pas

| Tentation | Pourquoi on refuse |
|-----------|--------------------|
| Un SaaS généraliste de ML | concurrence frontale avec Hugging Face, AWS, Databricks |
| Le GPU et les LLM | hors compétences et hors marché visé |
| Un produit d'analyse d'échecs | Stockfish est gratuit et plus fort |
| Une place de marché de modèles | effet de réseau impossible à amorcer à deux |
| Une licence propriétaire fermée | tue l'adoption et la crédibilité technique |

## 10. Les 6 chiffres du modèle

| Chiffre | Valeur `[H]` |
|---------|--------------|
| Prix du support | 10 k€/an |
| Panier moyen d'intégration | 20 k€ |
| Clients à 3 ans (base) | ~50 |
| Revenu année 3 (base) | 700 k€ |
| Financement demandé | 250 k€ |
| LTV / CAC | 8 |

À citer avec la mention « hypothèse », pas comme des prévisions.
