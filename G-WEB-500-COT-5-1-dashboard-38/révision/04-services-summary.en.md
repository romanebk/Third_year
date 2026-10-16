# Summary: how the services were implemented

## General idea

Each service in the project follows the same pattern:

- a dedicated folder in `backend/src/server/services/`
- an `index.ts` file to describe the service and its widgets
- a `fetch.ts` file to make HTTP requests to external APIs
- a final registration in `backend/src/server/widgets/data.ts`

This keeps the overall dashboard architecture clean and makes it easy to add new services or widgets without breaking the system.

## Typical structure of a service

A service usually looks like this:

```
backend/src/server/services/<service>/
├── index.ts
└── fetch.ts
```

### `index.ts`

This file declares the service in the project catalog.

It contains:
- the service name (`weather`, `github`, `rss`, `crypto`, etc.)
- a description
- the authentication level required (`"none"`, OAuth, API key, etc.)
- the list of widgets attached to that service
- the parameters expected for each widget

Examples:
- `weather` exposes `weather_city_current` and `weather_city_forecast`
- `crypto` exposes `crypto_price` and `crypto_top_coins`
- `github` exposes widgets such as `github_recent_commits` or `github_user_profile`

### `fetch.ts`

This file contains the actual logic that calls external APIs.

Each function:
- validates the input parameters
- builds the request URL
- performs a `fetch(...)`
- handles HTTP and edge-case errors
- returns a clean object that the frontend can render

The logic is standardized:
- input validation
- timeout management using `AbortSignal.timeout(...)`
- handling of 429, 400, 500, and other statuses
- explicit errors such as `WidgetFetchError` and `WidgetValidationError`

## Example: the crypto service

The crypto service is a good example of this architecture.

### `backend/src/server/services/crypto/index.ts`

It declares:
- the service `crypto`
- `auth: "none"` because no login or subscription is required
- two widgets:
  - `crypto_price`
  - `crypto_top_coins`

Each widget has specific parameters:
- `crypto_price`: `coin`, `currency`
- `crypto_top_coins`: `currency`, `limit`

### `backend/src/server/services/crypto/fetch.ts`

The code calls CoinGecko directly:
- `https://api.coingecko.com/api/v3`

It contains two main functions:

1. `fetchCryptoPrice({ coin, currency })`
   - calls `/simple/price`
   - retrieves the current price
   - retrieves the 24h variation too
   - validates whether the coin or currency is unknown

2. `fetchCryptoTopCoins({ currency, limit })`
   - calls `/coins/markets`
   - retrieves the top cryptocurrencies by market cap
   - limits the number of results to a reasonable maximum

## Role of the central registry

All services are then connected in:

`backend/src/server/widgets/data.ts`

This is where the project builds the mapping:

- `weather.weather_city_current` → `fetchCityCurrent`
- `github.github_recent_commits` → `fetchRecentCommits`
- `crypto.crypto_price` → `fetchCryptoPrice`
- `rss.rss_article_list` → `fetchArticleList`
- etc.

In other words, this file centralizes the link between:
- the widget name declared by the service
- the function that fetches the data

This avoids duplicating routes or handlers across the API.

## Why this architecture is well designed

The project follows a clear modular logic:

- `services/` = service descriptions and calls to external APIs
- `widgets/` = link between widgets and fetchers
- `dashboard/` = user widget instances management
- `timer/` = automatic refresh of data

Advantages:
- easy addition of new services
- cleaner code
- consistent error handling
- extensible architecture for future widgets
- clear separation between “service description” and “data retrieval”

## In short

The services were implemented using a standardized pattern:

1. declaration in `index.ts`
2. network logic in `fetch.ts`
3. registration in `backend/src/server/widgets/data.ts`
4. use in the dashboard and central timer

This is what makes the project both extensible and well organized.

## Conclusion

The project does not treat each service as a completely isolated case: it treats them all as “adapters” between an external API and the dashboard’s internal model.

This is the key idea behind the architecture:
- a service = a description + a fetcher
- a widget = a service + its parameters
- an instance = a widget configured for a user

This separation is precisely what makes the project robust and scalable.
