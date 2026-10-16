import { fetchRecentCommits, fetchSecurityAlerts, fetchUserProfile } from "@/server/services/github/fetch";
import { fetchCityCurrent, fetchCityForecast } from "@/server/services/weather/fetch";
import { fetchGameNews, fetchMostPlayedGames } from "@/server/services/steam/fetch";
import { fetchArticleList, fetchInterestFeed } from "@/server/services/rss/fetch";
import { fetchCryptoPrice, fetchCryptoTopCoins } from "@/server/services/crypto/fetch";
import { fetchDevisesHistory, fetchDevisesRate } from "@/server/services/devises/fetch";
import { fetchWikiOnThisDay, fetchWikiTopRead } from "@/server/services/wikipedia/fetch";
import { fetchMapDistance, fetchMapLocation } from "@/server/services/maps/fetch";
import { fetchChannelStats, fetchLatestVideos, fetchTrending } from "@/server/services/youtube/fetch";
import { fetchUpcomingEvents, fetchTodayEvents } from "@/server/services/google-calendar/fetch";
import { fetchApod, fetchApodRandom } from "@/server/services/nasa/fetch";
import { fetchUpcomingHolidays, fetchYearHolidays } from "@/server/services/holidays/fetch";
import { fetchCurrentIpgeo, fetchIpgeoLookup } from "@/server/services/ipgeo/fetch";
import { fetchUnisByCountry, fetchUnisSearch } from "@/server/services/universities/fetch";
import { decryptApiKeyParam } from "@/server/dashboard/validate-params";
import { WidgetFetchError, WidgetRateLimitError, WidgetValidationError } from "@/server/widgets/errors";

// Tokens tiers déchiffrés de l'utilisateur connecté, indexés par provider (ex:
// "github") — absent si l'utilisateur n'a pas lié ce service. Générique (pas
// "githubToken" en dur) pour que Steam (apikey côté J4) réutilise la même forme
// sans repasser par la route générique.
export interface WidgetFetchContext {
  accessTokens: Partial<Record<string, string>>;
  // Clé d'API à utiliser par service "apikey" (steam, youtube) : celle de
  // l'utilisateur, sinon celle du serveur (cf. server/services/api-keys.ts).
  apiKeys: Partial<Record<string, string>>;
}

export type WidgetDataFetcher = (
  params: Record<string, string>,
  context: WidgetFetchContext,
) => Promise<unknown>;

// Registre service -> widget -> fonction de fetch. Ajouter un nouveau widget de
// données = une entrée ici, pas une nouvelle route (cf. la route générique
// src/app/api/widgets/[service]/[widget]/route.ts) — évite de dupliquer la gestion
// d'erreurs/params à chaque nouveau service (Steam, RSS en J4).
const fetchers: Record<string, Record<string, WidgetDataFetcher>> = {
  weather: {
    weather_city_current: (params) => fetchCityCurrent({ city: params.city, unit: params.unit }),
    weather_city_forecast: (params) =>
      fetchCityForecast({
        city: params.city,
        days: params.days ? Number(params.days) : undefined,
        unit: params.unit,
      }),
  },
  github: {
    github_recent_commits: (params, { accessTokens }) =>
      fetchRecentCommits({
        repository: params.repository,
        maxCommits: params.max_commits ? Number(params.max_commits) : undefined,
        accessToken: accessTokens.github,
      }),
    github_user_profile: (params, { accessTokens }) =>
      fetchUserProfile({ username: params.username, accessToken: accessTokens.github }),
    github_security_alerts: (params, { accessTokens }) =>
      fetchSecurityAlerts({ repository: params.repository, accessToken: accessTokens.github }),
  },
  steam: {
    steam_most_played: (params, { apiKeys }) =>
      fetchMostPlayedGames({
        steamId: params.steam_id,
        periodDays: params.period_days ? Number(params.period_days) : undefined,
        // Une clé propre à l'instance (ancien mécanisme) garde la priorité.
        apiKey: decryptApiKeyParam(params.api_key) || apiKeys.steam,
      }),
    steam_game_news: (params) =>
      fetchGameNews({
        appId: Number(params.app_id),
        maxItems: params.max_items ? Number(params.max_items) : undefined,
      }),
  },
  rss: {
    rss_article_list: (params) =>
      fetchArticleList({
        feedUrl: params.feed_url,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
      }),
    rss_interest_feed: (params) =>
      fetchInterestFeed({
        interests: params.interests,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
      }),
  },
  crypto: {
    crypto_price: (params) => fetchCryptoPrice({ coin: params.coin, currency: params.currency }),
    crypto_top_coins: (params) =>
      fetchCryptoTopCoins({
        currency: params.currency,
        limit: params.limit ? Number(params.limit) : undefined,
      }),
  },
  devises: {
    devise_rate: (params) => fetchDevisesRate({ base: params.base, target: params.target }),
    devise_history: (params) =>
      fetchDevisesHistory({
        base: params.base,
        target: params.target,
        days: params.days ? Number(params.days) : undefined,
      }),
  },
  wikipedia: {
    wiki_onthisday: (params) =>
      fetchWikiOnThisDay({ lang: params.lang, maxItems: params.max_items ? Number(params.max_items) : undefined }),
    wiki_top_read: (params) =>
      fetchWikiTopRead({ lang: params.lang, maxItems: params.max_items ? Number(params.max_items) : undefined }),
  },
  maps: {
    map_location: (params) =>
      fetchMapLocation({
        address: params.address,
        zoom: params.zoom ? Number(params.zoom) : undefined,
      }),
    map_distance: (params) =>
      fetchMapDistance({ origin: params.origin, destination: params.destination }),
  },
  youtube: {
    youtube_channel_stats: (params, { apiKeys }) =>
      fetchChannelStats({ channel: params.channel, apiKey: apiKeys.youtube }),
    youtube_latest_videos: (params, { apiKeys }) =>
      fetchLatestVideos({
        channel: params.channel,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
        apiKey: apiKeys.youtube,
      }),
    youtube_trending: (params, { apiKeys }) =>
      fetchTrending({
        region: params.region,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
        apiKey: apiKeys.youtube,
      }),
  },
  "google-calendar": {
    gcal_upcoming: (params, { accessTokens }) =>
      fetchUpcomingEvents(
        {
          maxItems: params.max_items ? Number(params.max_items) : undefined,
          daysAhead: params.days_ahead ? Number(params.days_ahead) : undefined,
        },
        accessTokens.google,
      ),
    gcal_today: (params, { accessTokens }) =>
      fetchTodayEvents(
        { maxItems: params.max_items ? Number(params.max_items) : undefined },
        accessTokens.google,
      ),
  },
  nasa: {
    nasa_apod: (params, { accessTokens }) =>
      fetchApod({
        date: params.date,
        hd: params.hd ? (Number(params.hd) as 0 | 1) : undefined,
      }, accessTokens.nasa),
    nasa_apod_random: (_params, { accessTokens }) => fetchApodRandom({}, accessTokens.nasa),
  },
  holidays: {
    holidays_upcoming: (params, { accessTokens }) =>
      fetchUpcomingHolidays({
        country: params.country,
        region: params.region,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
      }, accessTokens.holidays),
    holidays_year: (params, { accessTokens }) =>
      fetchYearHolidays({
        country: params.country,
        year: params.year ? Number(params.year) : undefined,
      }, accessTokens.holidays),
  },
  ipgeo: {
    ipgeo_current: (_params, { accessTokens }) =>
      fetchCurrentIpgeo({}, accessTokens.ipgeo),
    ipgeo_lookup: (params, { accessTokens }) =>
      fetchIpgeoLookup({ ip: params.ip }, accessTokens.ipgeo),
  },
  universities: {
    unis_by_country: (params, { accessTokens }) =>
      fetchUnisByCountry({
        country: params.country,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
      }, accessTokens.universities),
    unis_search: (params, { accessTokens }) =>
      fetchUnisSearch({
        name: params.name,
        country: params.country,
        maxItems: params.max_items ? Number(params.max_items) : undefined,
      }, accessTokens.universities),
  },
};

export function getWidgetDataFetcher(service: string, widget: string): WidgetDataFetcher | undefined {
  return fetchers[service]?.[widget];
}

const RETRY_DELAY_MS = 1000;

// Exécute un fetcher avec une seconde tentative sur panne transitoire (réseau
// coupé, DNS lent, timeout, 5xx upstream). Sans ça, un seul raté au chargement
// laissait le widget en erreur jusqu'au prochain tick du timer — jusqu'à 5-10
// min pour les widgets par défaut. Pas de retry sur une erreur de validation
// (déterministe : même résultat au second essai) ni sur un quota épuisé
// (réessayer aggraverait le rate limit), ni sur une erreur inattendue (bug).
export async function runWidgetFetcher(
  fetcher: WidgetDataFetcher,
  params: Record<string, string>,
  context: WidgetFetchContext,
): Promise<unknown> {
  try {
    return await fetcher(params, context);
  } catch (error) {
    const transient =
      error instanceof WidgetFetchError &&
      !(error instanceof WidgetValidationError) &&
      !(error instanceof WidgetRateLimitError);
    if (!transient) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return fetcher(params, context);
  }
}
