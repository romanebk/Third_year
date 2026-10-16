# Rapport de charge, après ajout de l'index géospatial GIST

**Date** : 2026-09-10. **Outil** : k6 (même script `carte-offres.js` que le rapport du 3 septembre, inchangé).
**Cible** : backend réel, `http://localhost:3010/api`. **Base** : 539 offres actives / 58 communes.

## Rappel du problème identifié le 3 septembre

Le rapport précédent (`RAPPORT-2026-09-03.md`) avait mesuré un test propre (0% d'erreur) mais avait
relevé, via `EXPLAIN ANALYZE`, un `Seq Scan on "Offer"` sur la requête de proximité : aucun index
géospatial n'existait, `ST_DWithin` recalculait `ST_MakePoint(longitude, latitude)` à la volée pour
chaque ligne, un calcul que Postgres ne peut pas indexer. Le correctif recommandé à l'époque n'avait
alors pas encore été appliqué.

## Correctif appliqué (migration `20260910095827_add_geo_point_gist_index`)

- Colonne dédiée `geoPoint geography(Point, 4326)` sur `Offer`, synchronisée automatiquement depuis
  `latitude`/`longitude` par un trigger PostgreSQL (`offer_geopoint_sync`), pas par du code applicatif :
  aucun chemin d'écriture (création d'offre, migration IGN, scripts de reprise, seed) ne peut l'oublier.
- Index **GIST** sur cette colonne (`Offer_geoPoint_idx`).
- Requêtes (`GET /offers/nearby`, `GET /offers`) réécrites pour utiliser `o."geoPoint"` directement au
  lieu de recalculer `ST_MakePoint` dans la clause `WHERE`.

## Preuve : plan d'exécution avant / après

**Avant** (3 septembre, 537 lignes) :
```
Seq Scan on "Offer" o
  Filter: (status = 'ACTIVE' AND st_dwithin((st_makepoint(longitude, latitude))::geography, ...))
  Rows Removed by Filter: 484
Execution Time: ~22 ms
```

**Après** (10 septembre, 539 lignes, `EXPLAIN ANALYZE` réel sur la même requête) :
```
Bitmap Heap Scan on "Offer" o
  Filter: (status = 'ACTIVE' AND st_dwithin("geoPoint", ...))
  Rows Removed by Filter: 7
  ->  Bitmap Index Scan on "Offer_geoPoint_idx"
        Index Cond: ("geoPoint" && _st_expand(...))
Execution Time: 27.7 ms
```

L'index est maintenant utilisé (`Bitmap Index Scan on "Offer_geoPoint_idx"`). Sur ce volume de données
(539 lignes), le temps d'exécution brut est comparable, ce n'est pas là que se voit la correction : ce
qui change, c'est que le coût ne dépend plus du nombre total de lignes de la table mais du nombre de
lignes réellement dans la zone recherchée (`Rows Removed by Filter` : 484 avant, 7 après, sur un volume
de table équivalent). C'est cette propriété, pas le chiffre en millisecondes à 539 lignes, qui évite la
dégradation linéaire annoncée dans le rapport du 3 septembre à 50 000 ou 500 000 offres.

## Résultats du test de charge (50 utilisateurs, 3 minutes, identique au 3 septembre)

| Métrique | 3 septembre (avant) | 10 septembre (après) |
|---|---|---|
| Requêtes totales | 7 800 | 7 556 |
| Taux d'erreur | 0,00 % | 0,00 % |
| `nearby`, médiane (p50) | 18,5 ms | **8,96 ms** |
| `nearby`, p95 | non isolé dans le rapport précédent | **33,55 ms** |
| Requêtes globales, médiane | 18,5 ms | 14,87 ms |
| Requêtes globales, p95 | 105,3 ms | **45,67 ms** |
| Temps de réponse max | 562 ms | 402,7 ms |

p95 des requêtes globales divisé par plus de deux (105,3 ms → 45,67 ms), sur un volume de données
quasiment identique. La différence se creusera davantage à mesure que le nombre d'offres augmente,
c'est justement le problème que l'ancien plan d'exécution ne pouvait pas éviter.

## Honnêteté du résultat

Même volume de données que le rapport précédent, donc le gain n'est pas spectaculaire en millisecondes
brutes à cette échelle : c'est attendu et normal, PostgreSQL restait rapide même en Seq Scan sur 537
lignes. La preuve de la correction n'est pas le chronomètre à ce volume, c'est le plan d'exécution
(Bitmap Index Scan au lieu de Seq Scan) et le comportement structurel (coût dépendant de la zone
recherchée, plus du volume total de la table).
