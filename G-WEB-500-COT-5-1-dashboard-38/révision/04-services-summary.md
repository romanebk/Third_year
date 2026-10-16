# Résumé : comment les services ont été faits

## Idée générale

Chaque service du projet est implémenté selon un même pattern :

- un dossier dédié dans `backend/src/server/services/`
- un fichier `index.ts` pour décrire le service et ses widgets
- un fichier `fetch.ts` pour faire les appels HTTP aux APIs externes
- un enregistrement final dans `backend/src/server/widgets/data.ts`

Cela permet d’ajouter un service ou un widget sans casser l’architecture globale du dashboard.

## Structure type d’un service

Un service a généralement cette forme :

```
backend/src/server/services/<service>/
├── index.ts
└── fetch.ts
```

### `index.ts`

Ce fichier sert à déclarer le service dans le catalogue du projet.

Il contient :
- le nom du service (`weather`, `github`, `rss`, `crypto`, etc.)
- une description
- le niveau d’authentification requis (`"none"`, OAuth, clé API, etc.)
- la liste des widgets associés à ce service
- les paramètres attendus pour chaque widget

Exemple de logique :
- `weather` expose `weather_city_current` et `weather_city_forecast`
- `crypto` expose `crypto_price` et `crypto_top_coins`
- `github` expose des widgets comme `github_recent_commits` ou `github_user_profile`

### `fetch.ts`

Ce fichier contient les vraies requêtes vers les APIs externes.

Chaque fonction :
- valide les paramètres d’entrée
- construit l’URL de la requête
- fait un `fetch(...)`
- gère les erreurs HTTP et les cas limites
- retourne un objet propre, exploitable par le frontend

La logique est standardisée :
- validation des paramètres
- timeout via `AbortSignal.timeout(...)`
- gestion des réponses 429, 400, 500, etc.
- création d’erreurs explicites (`WidgetFetchError`, `WidgetValidationError`)

## Exemple : service Crypto

Le service crypto est un bon exemple de cette architecture.

### `backend/src/server/services/crypto/index.ts`

Il décrit :
- le service `crypto`
- `auth: "none"` : aucun compte requis
- deux widgets :
  - `crypto_price`
  - `crypto_top_coins`

Chaque widget a des paramètres types :
- `crypto_price` : `coin`, `currency`
- `crypto_top_coins` : `currency`, `limit`

### `backend/src/server/services/crypto/fetch.ts`

Le code appelle directement CoinGecko :
- `https://api.coingecko.com/api/v3`

Il contient deux fonctions principales :

1. `fetchCryptoPrice({ coin, currency })`
   - appelle `/simple/price`
   - récupère le prix actuel
   - récupère aussi la variation sur 24h
   - valide si la cryptomonnaie ou la devise sont inconnues

2. `fetchCryptoTopCoins({ currency, limit })`
   - appelle `/coins/markets`
   - récupère le classement des cryptomonnaies par capitalisation
   - limite le nombre de résultats à un maximum raisonnable

## Rôle du registre central

Tous les services sont ensuite reliés dans :

`backend/src/server/widgets/data.ts`

C’est ici que le projet fait le mapping suivant :

- `weather.weather_city_current` → `fetchCityCurrent`
- `github.github_recent_commits` → `fetchRecentCommits`
- `crypto.crypto_price` → `fetchCryptoPrice`
- `rss.rss_article_list` → `fetchArticleList`
- etc.

Autrement dit, ce fichier centralise le lien entre :
- le nom du widget déclaré dans le service
- la fonction qui va aller chercher les données

Cela évite de dupliquer des routes ou des gestionnaires dans chaque API.

## Pourquoi l’architecture est bien pensée

Le projet suit une logique modulaire claire :

- `services/` = définition et appels vers les APIs externes
- `widgets/` = liaison entre widgets et fetchers
- `dashboard/` = gestion des instances de widgets pour l’utilisateur
- `timer/` = rafraîchissement automatique des données

Les avantages :
- ajout de services simple
- code plus lisible
- gestion uniforme des erreurs
- architecture extensible pour de nouveaux widgets
- séparation claire entre “description du service” et “récupération des données”

## En résumé

Les services ont été faits selon un modèle standardisé :

1. déclaration dans `index.ts`
2. logique réseau dans `fetch.ts`
3. enregistrement dans `backend/src/server/widgets/data.ts`
4. utilisation dans le dashboard et le timer central

C’est cette structure qui permet au projet d’être à la fois extensible et bien organisé.

## Conclusion

Le projet ne traite pas chaque service comme un cas unique isolé : il les considère tous comme des “adaptateurs” entre une API externe et le système interne du dashboard.

C’est la clé de l’architecture :
- un service = une description + un fetcher
- un widget = un service + ses paramètres
- une instance = un widget configuré pour un utilisateur

Cette séparation est précisément ce qui rend le projet robuste et évolutif.
