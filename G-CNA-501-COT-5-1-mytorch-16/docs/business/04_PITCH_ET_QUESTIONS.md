# 04 — Pitch et questions business

> Les montants et parts de marché de ce fichier sont des hypothèses `[H]`.
> Les chiffres techniques sont mesurés et reproductibles.

## 1. Le pitch en 10 slides

### Slide 1 — Titre

**MyTorch** — un réseau de neurones dans votre C++, sans Python, sans GPU, sans
dépendance.

Sous-titre : *moteur C++17 écrit de zéro, entraînable et auditable — démontré sur
72 303 positions d'échecs.*

### Slide 2 — Le problème

Trois phrases, une image :

- « Mon produit est en C++. »
- « Je ne peux pas embarquer Python ni un runtime de 500 Mo. »
- « Je veux quand même un petit modèle, et pouvoir expliquer sa sortie. »

Chiffres : un runtime ML lourd = des centaines de Mo et une chaîne de
dépendances ; une intégration maison = 3 à 6 mois-homme `[H]`.

### Slide 3 — La solution

- Moteur C++17 autonome : matrices, couches `Dense`, softmax, SGD + momentum +
  L2.
- Créer, sauvegarder, charger, entraîner, prédire.
- Deux archives : `libmytorch.a` (moteur) et `libchess.a` (données).
- Format `.nn` documenté, magic `MYTN`, version 2.

Preuve : `ar t libmytorch.a` ne montre aucun objet métier.

### Slide 4 — La preuve technique

| Métrique | Valeur |
|----------|--------|
| Accuracy (test, 72 303 positions) | **93,05 %** |
| F1 macro | **92,50 %** |
| Référence « toujours Nothing » | 41,49 % |
| Inférence | **1,6 s** pour 72 303 positions (~22 µs/position) |
| Paramètres | 239 491 (< 1 Mo) |
| Dépendances | **0** |

Le problème des échecs est un **démonstrateur** : vérifiable, mesurable,
crédible. Le produit est le moteur générique.

### Slide 5 — Le marché

- **TAM** `[H]` : 450 M€ (entreprises C++ avec un besoin ML).
- **SAM** `[H]` : 27 M€ (celles qui ne peuvent pas utiliser Python/runtime
  lourd).
- **SOM à 3 ans** `[H]` : ~50 clients, 700 k€ de revenu.
- Beachhead : PME/ETI industrielles européennes, éditeurs C++, écoles.

Pas de « 1 % d'un marché de 50 Md$ ». Un marché étroit, des clients identifiables.

### Slide 6 — La concurrence

| Acteur | Pourquoi ce n'est pas la même chose |
|--------|-------------------------------------|
| PyTorch / LibTorch | lourd, dépendances, difficile à auditer |
| ONNX Runtime | inférence seulement, pas d'entraînement |
| TFLite Micro | microcontrôleurs, ops limitées |
| Stockfish / NNUE | spécifique aux échecs |
| **Statu quo** | 3 à 6 mois-homme, maintenance à la charge du client |

Le vrai concurrent est le **« on le fait nous-mêmes »**.

### Slide 7 — Le modèle économique

Open-core :

| Offre | Prix `[H]` | Récurrence |
|-------|------------|------------|
| Community | 0 € | — |
| Pro Support | 10 k€/an | annuelle |
| Intégration | 20 k€/projet | ponctuelle |
| Formation / audit | 5 à 15 k€ | ponctuelle |
| Licence commerciale | 20 k€/an | annuelle |

LTV / CAC `[H]` : 8. Marge brute support : 80 %.

### Slide 8 — Go-to-market

- Mois 0–3 : open source + contenu technique.
- Mois 3–6 : 20 entretiens, 3 pilotes.
- Mois 6–12 : 3 à 5 supports, 2 intégrations.
- Mois 12–24 : produit v3 (CNN, dropout, Adam), 15 à 25 contrats.

Canaux : GitHub, meetups C++, LinkedIn ciblé, écoles.

### Slide 9 — Projections

| | Année 1 | Année 2 | Année 3 |
|---|---|---|---|
| Revenu `[H]` | 85 k€ | 300 k€ | 700 k€ |
| Coûts `[H]` | 115 k€ | 190 k€ | 300 k€ |
| EBITDA `[H]` | −30 k€ | +110 k€ | +400 k€ |

Hypothèses : 2 fondateurs, 1 recrutement en année 2, cycle de vente 3 à 6 mois.

### Slide 10 — La demande

- **250 k€** de pré-amorçage `[H]` : 24 mois de salaires, juridique,
  infrastructure, marketing.
- Ou **bootstrap** par 2 à 3 intégrations.
- Jalon go/no-go : **3 pilotes payants à M6**.
- Si échec : pivot vers la formation et l'audit, pas vers un SaaS généraliste.

---

## 2. Le script de 30 secondes

> « MyTorch, c'est un moteur de réseaux de neurones écrit en C++17, sans aucune
> dépendance. Il permet à une équipe qui livre du C++ d'entraîner et d'exécuter
> un petit modèle sans embarquer Python ni un runtime lourd.
>
> On l'a prouvé sur un problème mesurable : 93,05 % d'accuracy sur 72 303
> positions d'échecs jamais vues, en 1,6 seconde, avec un modèle de moins d'un
> mégaoctet.
>
> Le marché, ce sont les PME industrielles et les éditeurs C++ qui ne peuvent pas
> utiliser PyTorch. Le modèle : open source pour l'adoption, support et
> intégration pour le revenu. On cherche 250 k€ pour 24 mois, avec un jalon
> clair : trois pilotes payants dans six mois. »

## 3. Le script de 2 minutes

**Problème (30 s).**
« Une équipe qui développe en C++ veut ajouter un petit classifieur. Aujourd'hui,
elle doit intégrer Python, un runtime de plusieurs centaines de mégaoctets, ou
exporter vers ONNX. Dans l'industrie, l'embarqué, la défense ou la finance, ces
options sont interdites ou trop coûteuses. La seule alternative, c'est de le
coder soi-même : trois à six mois d'ingénieur, plus la maintenance. »

**Solution (30 s).**
« MyTorch est un moteur C++17 autonome : matrices, couches denses, softmax,
rétropropagation, SGD avec momentum et L2, format binaire documenté. Il sait
créer, sauvegarder, charger et entraîner un réseau. Le moteur est séparé des
données métier : `libmytorch.a` ne connaît pas les échecs, `libchess.a` oui. »

**Preuve (30 s).**
« On l'a appliqué à un problème vérifiable : classer des positions d'échecs en
Nothing, Check ou Checkmate. Sur 72 303 positions de test jamais vues, le réseau
medium atteint 93,05 % d'accuracy et 92,50 % de F1 macro, contre 41,49 % pour un
modèle constant. L'inférence prend 1,6 seconde pour les 72 303 positions, sans
GPU, avec un modèle de 239 491 paramètres. Le gradient est vérifié par
différences finies sur tous les poids. »

**Business (30 s).**
« Le marché, ce sont les entreprises C++ qui ont une contrainte forte : pas de
Python, pas de runtime lourd, besoin d'audit. On estime le SAM à 27 millions
d'euros par an. Le modèle est open-core : moteur open source, support à
10 k€/an, intégration à 20 k€, licence commerciale pour les produits fermés. On
vise 50 clients en trois ans, soit 700 k€. On demande 250 k€ pour 24 mois, avec
un jalon go/no-go à six mois : trois pilotes payants. »

## 4. Questions business probables

**1. Pourquoi quelqu'un paierait alors que PyTorch est gratuit ?**
Parce que le coût n'est pas la licence, c'est l'intégration et la maintenance.
PyTorch n'est pas gratuit en environnement contraint : il faut Python, un
runtime lourd, des dépendances, et savoir l'auditer. On vend le temps d'ingénieur
économisé et la tranquillité.

**2. Quel est votre moat ?**
Honnêtement : pas la technologie. Les algorithmes sont classiques. Le moat est la
confiance — tests, documentation, support, intégration — et la relation avec les
premiers clients. C'est un moat de service.

**3. Le marché est-il assez grand ?**
Pour une équipe de deux, oui : ~50 clients, c'est 700 k€ de revenu annuel. Ce n'est pas un
marché de licorne. Si le jury cherche un marché de 10 Md€, ce n'est pas ce
projet.

**4. Qui est le premier client ?**
Une PME industrielle européenne avec du C++ et un projet ML bloqué par la
contrainte « pas de Python ». On en a identifié le profil, pas encore le nom : le
premier jalon est justement 20 entretiens.

**5. Comment trouvez-vous des clients ?**
Contenu technique (articles sur le gradient check, le zéro dépendance), meetups
C++, LinkedIn ciblé, écoles. Pas de publicité généraliste.

**6. Quel est le business model ?**
Open-core : communauté gratuite, support annuel, intégration, formation, licence
commerciale. Le récurrent vient du support ; la trésorerie vient de
l'intégration.

**7. Pourquoi open source si vous voulez gagner de l'argent ?**
Parce que l'adoption est le nerf de la guerre. Un moteur fermé que personne ne
peut tester ne se vend pas. On monétise le support et les licences, pas l'accès
au code.

**8. L'AGPL ne fait-elle pas fuir les clients ?**
Certains, oui. C'est pour ça qu'on propose une licence commerciale en parallèle.
Ceux qui acceptent l'AGPL contribuent à l'écosystème ; ceux qui veulent fermer
paient.

**9. Et si ONNX Runtime ajoute l'entraînement ?**
Tant mieux pour l'écosystème. Notre différence restera la taille, le zéro
dépendance et l'auditabilité. Si ONNX Runtime devient aussi léger, on pivote vers
le support et la formation.

**10. Et si un gros éditeur copie le code ?**
Il peut : c'est open source. Mais copier le code ne copie pas les tests, la
documentation, la relation client et la capacité à intégrer. Et un gros éditeur
n'a pas intérêt à servir 50 PME à 10 k€.

**11. Comment gagnez-vous de l'argent la première année ?**
2 intégrations à 20 k€ et 4 supports à 10 k€, plus une formation : 85 k€ `[H]`.
C'est suffisant pour couvrir une partie des coûts, pas les deux salaires
complets.

**12. Quels sont vos coûts ?**
Deux salaires (180 k€ sur 24 mois), juridique (10 k€), infrastructure (6 k€),
marketing (15 k€), comptabilité (8 k€), imprévus (21 k€). Total 240 k€.

**13. Combien levez-vous ?**
250 k€, pour 24 mois, avec une valorisation pre-money indicative de 1 à 1,5 M€
`[H]`. Ou zéro si on démarre en services.

**14. Que faites-vous avec 250 k€ ?**
180 k€ de salaires, 10 k€ de juridique, 6 k€ d'infrastructure, 15 k€ de
marketing, 8 k€ de comptabilité, 21 k€ d'imprévus.

**15. Quand êtes-vous rentables ?**
Dans le scénario de base, EBITDA positif en année 2 (+110 k€ `[H]`). La
trésorerie reste positive si les contrats sont encaissés d'avance.

**16. Quelle est la sortie ?**
Aucune sortie à 3 ans. L'objectif est la rentabilité et l'indépendance, pas une
revente. Une acquisition par un éditeur d'outils embarqués est possible, pas
planifiée.

**17. Pourquoi vous ?**
Parce qu'on a écrit le moteur, les tests et les benchmarks. On sait ce qui est
fragile, où sont les limites, et on peut intégrer chez un client sans
sous-traiter.

**18. Quel est le plus gros risque ?**
Le marché, pas le code. Si personne ne paie à M6, le modèle ne tient pas. C'est
pour ça qu'on a un critère de pivot explicite.

**19. 86 %, est-ce suffisant pour la production ?**
Pour le problème des échecs, c'est un démonstrateur. Pour un client, la question
est : quelle accuracy est acceptable pour **son** cas d'usage ? Un modèle de
scoring ou de détection d'anomalie peut tolérer 85 %. Un diagnostic médical, non.
On ne prétend pas résoudre tous les problèmes.

**20. Pourquoi ne pas faire un SaaS ?**
Parce que le client veut que le modèle tourne chez lui, sans envoyer ses données.
Le SaaS est l'inverse de la promesse. On pourrait proposer un service
d'entraînement, mais pas un SaaS généraliste.

**21. Et le RGPD / l'AI Act ?**
Le modèle tourne localement : pas de transfert de données par défaut. Pour l'AI
Act, l'auditabilité et la documentation sont des atouts, pas des coûts. Il
faudra classer le système selon son usage chez le client.

**22. Le dataset d'échecs est-il redistribuable ?**
À vérifier avant de le livrer. Le code, oui. Le dataset est un livrable
académique ; pour un produit, il faudrait une source de données claire ou
générer les positions soi-même.

**23. Pourquoi deux personnes et pas une équipe ?**
Parce qu'on est deux et qu'on a livré un moteur testé en trois semaines. Une
équipe plus grande aurait été plus confortable, pas nécessaire pour la v1.

**24. Quelle est votre vision à 5 ans ?**
Devenir l'outil de référence pour les petits modèles en C++ contraint :
multi-plateforme, format ouvert, écosystème d'intégrateurs. Pas un concurrent de
PyTorch.

**25. Qu'est-ce qui vous ferait abandonner ?**
Aucun pilote payant à M6, ou un client qui dit « je préfère le faire moi-même »
dans 8 entretiens sur 10. Ce sont des signaux clairs, pas des impressions.

## 5. Les pièges à éviter

| Piège | Correction |
|-------|------------|
| Annoncer un TAM de plusieurs milliards | rester bottom-up, 27 M€ de SAM |
| Dire « pas de concurrence » | le statu quo et LibTorch sont les concurrents |
| Promettre 1 M€ en année 1 | 85 k€ en année 1, assumé |
| Dire « la techno est unique » | elle ne l'est pas ; le moat est la confiance |
| Oublier les coûts | 240 k€ sur 24 mois, détaillés |
| Confondre chiffre d'affaires et marge | marge brute 60 à 95 % selon l'offre |
| Parler d'échecs comme du produit | c'est un démonstrateur |
| Cacher les hypothèses | tout chiffre `[H]` est marqué |

## 6. Sources à préparer avant la soutenance

Si le jury demande « d'où sortent ces chiffres ? », il faut pouvoir répondre :

1. **Chiffres techniques** : `README.md` §7, `benchmarks/README.md`,
   `benchmarks/results/*.csv`, reproductibles avec `scripts/check_release.sh`.
2. **Taille du marché** : méthode bottom-up de ce dossier, hypothèses H1 à H4.
   Si on veut des sources externes, citer un rapport public sur l'edge AI
   (IDC, Gartner, Statista) **et** expliquer pourquoi on ne l'utilise pas comme
   TAM.
3. **Prix** : hypothèses issues du coût du statu quo (3 à 6 mois-homme), à
   valider par les 20 entretiens.
4. **Coûts** : salaires médians, devis juridiques, tarifs d'hébergement.

Ne jamais inventer une source. Dire « hypothèse à valider » est plus crédible
qu'une référence fausse.
