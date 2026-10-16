"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { RefreshIcon } from "@/components/icons";
import WeatherCurrent, { type WeatherCurrentData } from "@/components/widgets/weather-current";
import WeatherWeek from "@/components/widgets/weather-week";
import { readWidgetError, widgetErrorMessage } from "@/lib/widget-errors";
import DataPreview from "@/components/widgets/previews/data-preview";
import RssArticlesPreview, { type RssArticlesData } from "@/components/widgets/previews/rss";
import {
  GithubAlertsPreview,
  GithubCommitsPreview,
  GithubProfilePreview,
  type GithubCommit,
  type GithubProfileData,
  type GithubSecurityAlert,
} from "@/components/widgets/previews/github";
import {
  SteamGameNewsPreview,
  SteamMostPlayedPreview,
  type SteamGameNewsData,
  type SteamMostPlayedData,
} from "@/components/widgets/previews/steam";
import {
  CryptoPricePreview,
  CryptoTopCoinsPreview,
  type CryptoPriceData,
  type CryptoTopCoinsData,
} from "@/components/widgets/previews/crypto";
import {
  MapDistancePreview,
  MapLocationPreview,
  type MapDistanceData,
  type MapLocationData,
} from "@/components/widgets/previews/maps";
import {
  YoutubeChannelStatsPreview,
  YoutubeVideoListPreview,
  type YoutubeChannelStatsData,
  type YoutubeVideoListData,
} from "@/components/widgets/previews/youtube";
import {
  DevisesHistoryPreview,
  DevisesRatePreview,
  type DevisesHistoryData,
  type DevisesRateData,
} from "@/components/widgets/previews/devises";
import {
  WikiOnThisDayPreview,
  WikiTopReadPreview,
  type WikiOnThisDayData,
  type WikiTopReadData,
} from "@/components/widgets/previews/wikipedia";
import { NasaApodPreview, type NasaApodData } from "@/components/widgets/previews/nasa";

type FetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: unknown };

// Forme connue de données du widget weather_city_forecast — cf.
// CityForecastResult (weather/fetch.ts) côté backend. Le rendu vit dans
// WeatherWeek ; ce type n'existe que pour le cast au point d'appel.
interface WeatherForecastDay {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  weatherCode: number;
  humidityMax: number;
  windMaxKmh: number;
  apparentMax: number;
  pressureHpa: number;
}

interface WeatherForecastData {
  city: string;
  days: WeatherForecastDay[];
  aqi?: number | null;
}

const CENTERED_WIDGETS = new Set([
  "crypto_price",
  "youtube_channel_stats",
  "map_distance",
]);

// Widget générique : affiche les données réelles d'une instance ajoutée via le
// catalogue (service/widget/params/id ne sont pas connus à l'avance, contrairement
// aux 6 panneaux "overview" qui ont chacun leur composant dédié). Chaque service
// a son rendu dans widgets/previews/<service>.tsx ; les widgets sans rendu dédié
// retombent sur DataPreview (clé/valeur récursif).
//
// Rafraîchissement : un fetch initial (premier affichage immédiat, sans attendre
// jusqu'à refreshRateSeconds), puis un abonnement SSE à /api/dashboard/[id]/stream
// pour les mises à jour suivantes — c'est le timer central (cf. src/server/timer/)
// qui rafraîchit côté serveur et pousse ici, pas un setInterval côté navigateur.
// refreshKey (bouton "refresh" manuel du dashboard) redéclenche juste le fetch
// initial, en plus du flux, pour un refresh immédiat à la demande.
export default function InstanceWidget({
  id,
  service,
  widget,
  params,
  refreshKey,
}: {
  id: string;
  service: string;
  widget: string;
  params: Record<string, string | number>;
  refreshKey: number;
}) {
  const [state, setState] = useState<FetchState>({ status: "loading" });
  // Bouton "Retry" de l'état d'erreur : relance le fetch initial sans attendre
  // le prochain tick du timer serveur.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) query.set(key, String(value));

    fetch(`/api/widgets/${service}/${widget}?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readWidgetError(response));
        const json = (await response.json()) as { data: unknown };
        if (!cancelled) setState({ status: "ready", data: json.data });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Something went wrong.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, widget, JSON.stringify(params), refreshKey, retryNonce]);

  useEffect(() => {
    const source = new EventSource(`/api/dashboard/${id}/stream`);
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as
          | { type: "data"; data: unknown }
          | { type: "error"; status: number; message: string };
        if (parsed.type === "data") {
          setState({ status: "ready", data: parsed.data });
        } else {
          setState({ status: "error", message: widgetErrorMessage(parsed.status, parsed.message) });
        }
      } catch {
        // événement malformé (ne devrait pas arriver, la route contrôle le format) :
        // on ignore plutôt que de casser l'affichage courant.
      }
    };
    return () => source.close();
  }, [id]);

  if (state.status === "loading") {
    // Squelette plutôt qu'un spinner : réserve la place du contenu (pas de saut
    // de mise en page à l'arrivée des données) et paraît plus rapide.
    return (
      <div className="flex flex-col gap-3 py-1" role="status" aria-label="Loading">
        <div className="h-7 w-2/5 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.05]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="flex h-full min-h-28 flex-col items-center justify-center gap-3 text-center"
        role="alert"
        aria-live="assertive"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-amber-400/10 text-amber-300" aria-hidden="true">
          <RefreshIcon className="size-4" />
        </span>
        <p className="max-w-[28ch] text-sm text-muted-foreground">{state.message}</p>
        <button
          type="button"
          onClick={() => setRetryNonce((nonce) => nonce + 1)}
          className="cursor-pointer rounded-full border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]"
        >
          Retry
        </button>
      </div>
    );
  }

  // Widgets à valeur unique (un chiffre, une carte de stats) : centrés dans la
  // carte. Les listes (news, vidéos, commits...) partent du haut, sinon un
  // grand vide apparaît au-dessus d'elles.
  const centered = CENTERED_WIDGETS.has(widget);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className={cn("flex flex-1 flex-col", centered && "justify-center")}>
        {service === "weather" && widget === "weather_city_current" ? (
          <WeatherCurrent data={state.data as WeatherCurrentData} />
        ) : service === "weather" && widget === "weather_city_forecast" ? (
          <WeatherWeek
            data={state.data as WeatherForecastData}
            unit={typeof params.unit === "string" && params.unit === "fahrenheit" ? "fahrenheit" : "celsius"}
          />
        ) : service === "rss" &&
          (widget === "rss_article_list" || widget === "rss_interest_feed") ? (
          <RssArticlesPreview data={state.data as RssArticlesData} />
        ) : service === "github" && widget === "github_user_profile" ? (
          <GithubProfilePreview data={state.data as GithubProfileData} />
        ) : service === "github" && widget === "github_recent_commits" ? (
          <GithubCommitsPreview data={state.data as GithubCommit[]} />
        ) : service === "github" && widget === "github_security_alerts" ? (
          <GithubAlertsPreview data={state.data as GithubSecurityAlert[]} />
        ) : service === "steam" && widget === "steam_most_played" ? (
          <SteamMostPlayedPreview data={state.data as SteamMostPlayedData} />
        ) : service === "steam" && widget === "steam_game_news" ? (
          <SteamGameNewsPreview data={state.data as SteamGameNewsData} />
        ) : service === "crypto" && widget === "crypto_price" ? (
          <CryptoPricePreview data={state.data as CryptoPriceData} />
        ) : service === "crypto" && widget === "crypto_top_coins" ? (
          <CryptoTopCoinsPreview data={state.data as CryptoTopCoinsData} />
        ) : service === "maps" && widget === "map_location" ? (
          <MapLocationPreview data={state.data as MapLocationData} />
        ) : service === "maps" && widget === "map_distance" ? (
          <MapDistancePreview data={state.data as MapDistanceData} />
        ) : service === "youtube" && widget === "youtube_channel_stats" ? (
          <YoutubeChannelStatsPreview data={state.data as YoutubeChannelStatsData} />
        ) : service === "youtube" &&
          (widget === "youtube_latest_videos" || widget === "youtube_trending") ? (
          <YoutubeVideoListPreview
            data={state.data as YoutubeVideoListData}
            showChannel={widget === "youtube_trending"}
          />
        ) : service === "devises" && widget === "devise_rate" ? (
          <DevisesRatePreview data={state.data as DevisesRateData} />
        ) : service === "devises" && widget === "devise_history" ? (
          <DevisesHistoryPreview data={state.data as DevisesHistoryData} />
        ) : service === "wikipedia" && widget === "wiki_onthisday" ? (
          <WikiOnThisDayPreview data={state.data as WikiOnThisDayData} />
        ) : service === "wikipedia" && widget === "wiki_top_read" ? (
          <WikiTopReadPreview data={state.data as WikiTopReadData} />
        ) : service === "nasa" && (widget === "nasa_apod" || widget === "nasa_apod_random") ? (
          <NasaApodPreview data={state.data as NasaApodData} />
        ) : (
          <DataPreview value={state.data} />
        )}
      </div>
    </div>
  );
}
