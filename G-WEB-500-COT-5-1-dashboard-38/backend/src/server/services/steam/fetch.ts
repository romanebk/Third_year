import { WidgetFetchError, WidgetValidationError } from "@/server/widgets/errors";

const STEAM_API = "https://api.steampowered.com";

// Steam ne fournit le temps de jeu que sur deux fenêtres : les 2 dernières
// semaines (playtime_2weeks) et tout temps confondu (playtime_forever). La
// notion de "période" du widget est donc bornée : <= 14 jours → 2 semaines,
// sinon → total enregistré.
const TWO_WEEKS_DAYS = 14;
const MAX_RANKED_GAMES = 10;
const DEFAULT_NEWS_ITEMS = 5;
const MAX_NEWS_ITEMS = 20;

async function steamGet(path: string, params: Record<string, string>): Promise<Response> {
  const query = new URLSearchParams({ format: "json", ...params }).toString();
  let response: Response;
  try {
    response = await fetch(`${STEAM_API}${path}?${query}`, {
      headers: { Accept: "application/json" },
      // Sans timeout, un fetch qui ne reçoit jamais de réponse bloque
      // indéfiniment la requête entrante avec lui.
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new WidgetFetchError("could not reach Steam");
  }
  return response;
}

export interface MostPlayedParams {
  steamId: string;
  periodDays?: number;
  apiKey?: string;
}

export interface MostPlayedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
}

export interface MostPlayedResult {
  steamId: string;
  source: "two_weeks" | "all_time";
  games: MostPlayedGame[];
}

// La clé est résolue par l'appelant (cf. widgets/data.ts) : celle de
// l'utilisateur, sinon celle du serveur.
function resolveApiKey(apiKey: string | undefined): string {
  const key = apiKey?.trim();
  if (!key) {
    throw new WidgetValidationError(
      "A Steam Web API key is required: add yours by reconnecting Steam on the Services page",
    );
  }
  return key;
}

export async function fetchMostPlayedGames({
  steamId,
  periodDays,
  apiKey,
}: MostPlayedParams): Promise<MostPlayedResult> {
  if (!steamId?.trim()) {
    throw new WidgetValidationError("steam_id is required");
  }
  if (!/^\d{17}$/.test(steamId.trim())) {
    throw new WidgetValidationError("steam_id must be a 17-digit Steam64 ID");
  }
  // Borné (1-30) : au-delà d'un mois le widget n'apporte rien de plus et Steam
  // ne fournit de toute façon que 2 semaines de granularité.
  const period = Math.min(Math.max(Math.trunc(periodDays ?? TWO_WEEKS_DAYS), 1), 30);
  const key = resolveApiKey(apiKey);

  const response = await steamGet("/IPlayerService/GetOwnedGames/v0001/", {
    key,
    steamid: steamId.trim(),
    include_appinfo: "1",
    include_played_free_games: "1",
  });

  if (response.status === 401 || response.status === 403) {
    throw new WidgetValidationError("Steam rejected the API key");
  }
  if (response.status === 404 || response.status >= 500) {
    throw new WidgetFetchError(`Steam API responded with status ${response.status}`);
  }
  if (!response.ok) {
    throw new WidgetValidationError(`Steam API responded with status ${response.status}`);
  }

  const body = (await response.json()) as {
    response?: {
      games?: Array<{
        appid: number;
        name?: string;
        playtime_forever?: number;
        playtime_2weeks?: number;
      }>;
    };
  };

  const rawGames = body.response?.games;
  if (body.response === undefined || rawGames === undefined) {
    throw new WidgetValidationError("Steam profile not found or marked as private");
  }

  const usingTwoWeeks = period <= TWO_WEEKS_DAYS;
  const games: MostPlayedGame[] = rawGames
    .filter((game) => game.name)
    .map((game) => ({
      appId: game.appid,
      name: game.name as string,
      playtimeMinutes: usingTwoWeeks
        ? (game.playtime_2weeks ?? 0)
        : (game.playtime_forever ?? 0),
    }))
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .slice(0, MAX_RANKED_GAMES);

  return {
    steamId: steamId.trim(),
    source: usingTwoWeeks ? "two_weeks" : "all_time",
    games,
  };
}

export interface GameNewsParams {
  appId: number;
  maxItems?: number;
}

export interface GameNewsItem {
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: string | null;
}

export interface GameNewsResult {
  appId: number;
  items: GameNewsItem[];
}

// GetNewsForApp est public (pas de clé requise), contrairement à GetOwnedGames —
// pas de resolveApiKey ici, volontairement.
export async function fetchGameNews({
  appId,
  maxItems,
}: GameNewsParams): Promise<GameNewsResult> {
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new WidgetValidationError("app_id must be a positive integer");
  }
  const limit = Math.min(Math.max(Math.trunc(maxItems ?? DEFAULT_NEWS_ITEMS), 1), MAX_NEWS_ITEMS);

  const response = await steamGet("/ISteamNews/GetNewsForApp/v0002/", {
    appid: String(appId),
    count: String(limit),
    maxlength: "0",
  });

  if (response.status === 404 || response.status >= 500) {
    throw new WidgetFetchError(`Steam API responded with status ${response.status}`);
  }
  if (!response.ok) {
    throw new WidgetValidationError(`Steam API responded with status ${response.status}`);
  }

  const body = (await response.json()) as {
    appnews?: { newsitems?: Array<{ title: string; url?: string; author?: string; date?: number }> };
  };

  const rawItems = body.appnews?.newsitems;
  if (rawItems === undefined) {
    throw new WidgetValidationError("Steam app not found");
  }
  if (rawItems.length === 0) {
    throw new WidgetFetchError("no news found for this app");
  }

  return {
    appId,
    items: rawItems.slice(0, limit).map((item) => ({
      title: item.title,
      url: item.url ?? null,
      author: item.author?.trim() || null,
      publishedAt: item.date ? new Date(item.date * 1000).toISOString() : null,
    })),
  };
}