# bonus/ — bonus livrés

> **Responsable** : Ariel · **Semaine** : 3 · **Dépend de** : `src/mytorch/Matrix.cpp`

Le socle du projet n'a pas besoin de ce dossier : il n'existe pas de cible
`make bonus` et le `Makefile` racine ne lit aucun fichier d'ici.

## Parallélisation du produit matriciel (livrée)

Le bonus de parallélisme est **intégré au cœur** plutôt que dupliqué ici : le
produit matriciel est la brique utilisée par l'entraînement et la prédiction, et
le module doit rester utilisable tel quel. `Matrix::operator*` parallélise les
lignes de sortie avec OpenMP ; la compilation ajoute `-fopenmp` et
`-march=native` par défaut.

```bash
make                      # OpenMP + AVX2/FMA
make OPENMP=0 NATIVE=0    # référence portable, sans parallélisme
export OMP_NUM_THREADS=4  # 4 cœurs physiques sur la machine de développement
```

Mesures (réseau medium, 4 000 positions, 60 epochs) : 52,2 s en référence,
19,0 s avec 4 threads et `-march=native`, soit **2,74×**. Le résultat est
identique au bit près avec 4 threads et les `.nn` produits avec 1 ou 8 threads
sont identiques octet pour octet. Détails : `docs/DESIGN_CHOICES.md` §17.

## Non livrés

- **MC dropout** : aucune couche `Dropout` n'existe dans le cœur (le champ du
  format `.nn` est conservé mais inerte). La régularisation retenue est
  L2 + augmentation + meilleur epoch (`DESIGN_CHOICES.md` §10, §11, §12, §18).
- **Pat (7e classe)** : le dataset ne contient pas d'étiquettes de pat ;
  l'analyseur reste sur 3 ou 5 classes.
