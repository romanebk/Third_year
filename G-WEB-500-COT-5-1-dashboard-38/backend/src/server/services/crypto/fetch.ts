import { WidgetFetchError, WidgetValidationError } from "@/server/widgets/errors";

// Même raisonnement que weather/steam/github (cf. leurs fetch.ts) : sans timeout
// explicite, un fetch() qui ne reçoit jamais de réponse bloque la requête entrante
// indéfiniment avec lui.
const FETCH_TIMEOUT_MS = 8000;
const COINGECKO_API = "https://api.coingecko.com/api/v3";

export interface CryptoPriceParams {
  coin: string;
  currency?: string;
}

export interface CryptoPriceResult {
  coin: string;
  currency: string;
  price: number;
  change24hPercent: number | null;
}

// CoinGecko identifie une pièce par son "id" (ex: "bitcoin", "ethereum"), pas
// son symbole ("BTC") — on transmet tel quel plutôt que de maintenir notre
// propre table de correspondance symbole -> id.
export async function fetchCryptoPrice({
  coin,
  currency,
}: CryptoPriceParams): Promise<CryptoPriceResult> {
  if (!coin?.trim()) throw new WidgetValidationError("coin is required");
  const vsCurrency = (currency?.trim() || "usd").toLowerCase();

  let response: Response;
  try {
    response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=${encodeURIComponent(vsCurrency)}&include_24hr_change=true`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the crypto price service");
  }

  if (response.status === 429) {
    throw new WidgetFetchError("crypto price service rate limit exceeded, try again shortly");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`crypto price service responded with status ${response.status}`);
  }

  const data = (await response.json()) as Record<
    string,
    Record<string, number> | undefined
  >;
  const entry = data[coin];
  const price = entry?.[vsCurrency];
  // CoinGecko répond 200 avec un objet vide pour un id/devise inconnu, plutôt
  // qu'une erreur HTTP — donc "prix absent" est un problème de config
  // (déterministe), pas une panne transitoire de l'API.
  if (entry === undefined || price === undefined) {
    throw new WidgetValidationError(`unknown coin or currency: ${coin}/${vsCurrency}`);
  }

  const changeKey = `${vsCurrency}_24h_change`;
  const change = entry[changeKey];

  return {
    coin,
    currency: vsCurrency,
    price,
    change24hPercent: typeof change === "number" ? change : null,
  };
}

export interface CryptoTopCoinsParams {
  currency?: string;
  limit?: number;
}

export interface CryptoTopCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24hPercent: number | null;
  marketCapRank: number | null;
}

export interface CryptoTopCoinsResult {
  currency: string;
  coins: CryptoTopCoin[];
}

export async function fetchCryptoTopCoins({
  currency,
  limit,
}: CryptoTopCoinsParams): Promise<CryptoTopCoinsResult> {
  const vsCurrency = (currency?.trim() || "usd").toLowerCase();
  // Borné (1-20) comme github_recent_commits/max_commits : un widget "top
  // pièces" n'a pas de sens au-delà d'une poignée de lignes affichables.
  const perPage = Math.min(Math.max(Math.trunc(limit ?? 5), 1), 20);

  let response: Response;
  try {
    response = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=${encodeURIComponent(vsCurrency)}&order=market_cap_desc&per_page=${perPage}&page=1&price_change_percentage=24h`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the crypto price service");
  }

  if (response.status === 429) {
    throw new WidgetFetchError("crypto price service rate limit exceeded, try again shortly");
  }
  if (response.status === 400) {
    // Devise vs_currency inconnue de CoinGecko (ex: "xyz") -> 400 côté API.
    throw new WidgetValidationError(`unknown currency: ${vsCurrency}`);
  }
  if (!response.ok) {
    throw new WidgetFetchError(`crypto price service responded with status ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number | null;
    market_cap_rank: number | null;
  }>;

  return {
    currency: vsCurrency,
    coins: data.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: coin.current_price,
      change24hPercent: coin.price_change_percentage_24h,
      marketCapRank: coin.market_cap_rank,
    })),
  };
}
