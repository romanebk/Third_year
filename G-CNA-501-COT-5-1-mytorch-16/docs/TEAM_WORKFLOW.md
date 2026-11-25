# TEAM_WORKFLOW.md

> **Responsable** : Ariel + Divine · **Semaine** : 1-3 · **Dépend de** : -

**Rôle** : Organisation du travail en équipe avec git.

## 1. Rôle des branches

| Branche | Rôle | Règle |
|---------|------|-------|
| `main` | Rendu final, toujours stable | On n'y travaille jamais directement |
| `dev` | Intégration continue | On n'y travaille jamais directement |
| `feature/<n>-<nom>` | Une branche par fonctionnalité | Créée **depuis `origin/dev`** |

- Une branche de tâche contient **une** fonctionnalité (le découpage est celui de
  `docs/plan_repartition_mytorch.pdf`).
- `dev` reçoit les branches de tâche **après relecture croisée** : chacun relit la
  branche de l'autre avant de fusionner.
- `dev` est fusionné dans `main` **à chaque jalon validé** (jalons S1, S2, S3) :
  `main` ne doit jamais être cassé.

## 2. Convention de nommage

```
feature/<numero>-<nom-court-kebab-case>
```

Exemples : `feature/03-chess-data`, `feature/06-nn-file`, `feature/07-metrics-modes`,
`feature/09-bench-docs`.

Le numéro vient du plan de répartition : il indique la position dans le planning
et le responsable (les features paires/impaires n'ont pas de règle fixe, le plan
fait foi).

## 3. Cycle de travail d'une tâche

```bash
# 1. partir de dev à jour
git fetch origin
git checkout dev && git pull origin dev
git checkout -b feature/10-nouvelle-tache

# 2. travailler, un commit par fichier, message en une ligne en anglais
git add include/mytorch/mon_fichier.hpp
git commit -m "Add my file header"

# 3. publier la branche pour la relecture
git push -u origin feature/10-nouvelle-tache

# 4. relecture croisée puis fusion dans dev (bouton "Merge pull request" de GitHub)
# 5. supprimer la branche locale et distante une fois la fusion faite
git branch -d feature/10-nouvelle-tache
git push origin --delete feature/10-nouvelle-tache
```

## 4. Conventions de commit

- **Un commit par fichier** : un commit qui ajoute trois fichiers est refusé en
  relecture.
- **Message en anglais, une seule ligne, sans corps** : `Add the CSV report export`,
  `Implement the predict mode of the analyzer`.
- Pas de mention d'IA, d'outillage ou de co-auteur dans les messages : le travail
  est signé par l'auteur du commit (`git config user.name` / `user.email`).
- Les commits de fusion (`Merge pull request...`) sont laissés tels quels par
  GitHub.

## 5. Rythme de l'équipe

- **Point de 15 minutes tous les 2 jours** : avancement, blocages, ce qui doit
  être livré avant la prochaine démo.
- **Démo chaque vendredi** : chacun montre ce qui marche (`make tests` +
  une démonstration de bout en bout).
- Chaque fin de journée, `dev` doit compiler (`make` sans warning) et les tests
  doivent passer (`make tests`).

## 6. En cas de conflit

1. Ne jamais fusionner `dev` à la main en cas de conflit : `git merge --abort`,
   prévenir l'autre membre et reprendre la fusion ensemble.
2. Les conflits d'**ajout du même fichier** (deux personnes écrivant le même
   fichier) se règlent en gardant la version la plus complète et en le signalant
   dans la relecture.
3. Les conflits d'**en-tête** (`include/mytorch/...`) se règlent en gardant les
   deux déclarations si elles ne s'excluent pas.
4. Après résolution : `make fclean && make && make tests` doit être vert avant de
   pousser.

## 7. Fichiers qui ne doivent jamais être versionnés

- `dataset/` (42 Mo de positions) : il est fourni à part (`dataset.zip`).
- Les binaires (`my_torch_analyzer`, `my_torch_generator`, `libmytorch.a`,
  `libchess.a`) et les
  objets de compilation : le `.gitignore` les exclut.
- Les fichiers `.csv` de résultats et les `.png` de benchmarks **sont** versionnés
  (ce sont des preuves pour le jury), mais pas les `.nn` de travail : le réseau
  livré à la racine `my_torch_network.nn` (full 5 classes) et les réseaux de
  démonstration `models/{basic,medium,full}.nn` sont versionnés.
