import {
  WidgetFetchError,
  WidgetRateLimitError,
  WidgetValidationError,
} from "@/server/widgets/errors";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ITEMS = 5;
const MAX_ITEMS = 10;

// Quota gratuit : 10 000 unités/jour pour tout le serveur. Chaque appel utilisé
// ici coûte 1 unité (channels, playlistItems, videos) — jamais search.list
// (100 unités), d'où la résolution de chaîne par forHandle/id plutôt que par
// recherche libre.
// La clé est résolue par l'appelant (cf. widgets/data.ts) : celle de
// l'utilisateur, sinon celle du serveur.
async function youtubeGet(
  path: string,
  params: Record<string, string>,
  apiKey: string | undefined,
): Promise<unknown> {
  const key = apiKey?.trim();
  if (!key) {
    throw new WidgetValidationError(
      "A YouTube API key is required: add yours by reconnecting YouTube on the Services page",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${YOUTUBE_API}${path}?${new URLSearchParams({ ...params, key })}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach YouTube");
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { code: number; message?: string; errors?: { reason?: string }[] };
  } | null;
  if (response.ok && body) return body;

  const reason = body?.error?.errors?.[0]?.reason;
  if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
    throw new WidgetRateLimitError("YouTube API daily quota exceeded, try again tomorrow");
  }
  if (reason === "invalidRegionCode") {
    throw new WidgetValidationError(`unknown region code: ${params.regionCode}`);
  }
  // Clé invalide/restreinte : problème de configuration, pas du widget. YouTube
  // signale une clé inconnue par un 400 "badRequest" (constaté sur l'API).
  const invalidKey =
    reason === "keyInvalid" ||
    reason === "forbidden" ||
    reason === "accessNotConfigured" ||
    (reason === "badRequest" && /API key/i.test(body?.error?.message ?? ""));
  if (invalidKey) {
    throw new WidgetFetchError("YouTube API key is invalid or the API is not enabled for it");
  }
  throw new WidgetFetchError(`YouTube API responded with status ${response.status}`);
}

function clampItems(maxItems: number | undefined): number {
  return Math.min(Math.max(Math.trunc(maxItems ?? DEFAULT_MAX_ITEMS), 1), MAX_ITEMS);
}

// "channel" accepte ce qu'un utilisateur copie naturellement : "@MrBeast",
// "MrBeast", un id "UC…" (24 caractères) ou une URL youtube.com/@x | /channel/UC….
function channelLookup(channel: string): Record<string, string> {
  const raw = channel.trim();
  const fromUrl = raw.match(/youtube\.com\/(?:channel\/(UC[\w-]{22})|(@[\w.-]+))/i);
  const value = fromUrl ? (fromUrl[1] ?? fromUrl[2]) : raw;
  if (/^UC[\w-]{22}$/.test(value)) return { id: value };
  return { forHandle: value.startsWith("@") ? value : `@${value}` };
}

interface ChannelResource {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  statistics?: {
    viewCount?: string;
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

async function fetchChannel(channel: string, apiKey: string | undefined): Promise<ChannelResource> {
  if (!channel?.trim()) throw new WidgetValidationError("channel is required");
  const data = (await youtubeGet(
    "/channels",
    { part: "snippet,statistics,contentDetails", ...channelLookup(channel) },
    apiKey,
  )) as { items?: ChannelResource[] };
  const found = data.items?.[0];
  // Handle/id inconnu : YouTube répond 200 avec une liste vide.
  if (!found) throw new WidgetValidationError(`YouTube channel not found: ${channel}`);
  return found;
}

function bestThumbnail(thumbnails: Record<string, { url: string }> | undefined): string | null {
  return thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null;
}

function toCount(value: string | undefined): number | null {
  return value === undefined ? null : Number(value);
}

export interface ChannelStatsResult {
  channelId: string;
  title: string;
  handle: string | null;
  avatarUrl: string | null;
  // null si la chaîne masque son nombre d'abonnés.
  subscribers: number | null;
  views: number | null;
  videos: number | null;
}

export async function fetchChannelStats({
  channel,
  apiKey,
}: {
  channel: string;
  apiKey?: string;
}): Promise<ChannelStatsResult> {
  const found = await fetchChannel(channel, apiKey);
  const stats = found.statistics ?? {};
  return {
    channelId: found.id,
    title: found.snippet.title,
    handle: found.snippet.customUrl ?? null,
    avatarUrl: bestThumbnail(found.snippet.thumbnails),
    subscribers: stats.hiddenSubscriberCount ? null : toCount(stats.subscriberCount),
    views: toCount(stats.viewCount),
    videos: toCount(stats.videoCount),
  };
}

export interface VideoSummary {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  url: string;
}

interface VideoResource {
  id: string;
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url: string }>;
  };
  statistics?: { viewCount?: string };
}

function toVideoSummary(video: VideoResource): VideoSummary {
  return {
    id: video.id,
    title: video.snippet.title,
    channelTitle: video.snippet.channelTitle,
    thumbnailUrl: bestThumbnail(video.snippet.thumbnails),
    publishedAt: video.snippet.publishedAt ?? null,
    views: toCount(video.statistics?.viewCount),
    url: `https://www.youtube.com/watch?v=${video.id}`,
  };
}

export interface LatestVideosResult {
  channelTitle: string;
  videos: VideoSummary[];
}

// Dernières vidéos = playlist "uploads" de la chaîne (1 unité), puis un appel
// videos.list groupé pour leurs vues (1 unité) — playlistItems ne les donne pas.
export async function fetchLatestVideos({
  channel,
  maxItems,
  apiKey,
}: {
  channel: string;
  maxItems?: number;
  apiKey?: string;
}): Promise<LatestVideosResult> {
  const found = await fetchChannel(channel, apiKey);
  const uploads = found.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return { channelTitle: found.snippet.title, videos: [] };

  const playlist = (await youtubeGet(
    "/playlistItems",
    { part: "contentDetails", playlistId: uploads, maxResults: String(clampItems(maxItems)) },
    apiKey,
  )) as { items?: { contentDetails: { videoId: string } }[] };
  const ids = (playlist.items ?? []).map((item) => item.contentDetails.videoId);
  if (ids.length === 0) return { channelTitle: found.snippet.title, videos: [] };

  const details = (await youtubeGet(
    "/videos",
    { part: "snippet,statistics", id: ids.join(",") },
    apiKey,
  )) as { items?: VideoResource[] };
  // videos.list ne garantit pas l'ordre des ids demandés : on réaligne sur
  // l'ordre de la playlist (du plus récent au plus ancien).
  const byId = new Map((details.items ?? []).map((video) => [video.id, video]));
  const videos = ids.flatMap((id) => {
    const video = byId.get(id);
    return video ? [toVideoSummary(video)] : [];
  });

  return { channelTitle: found.snippet.title, videos };
}

export interface TrendingResult {
  region: string;
  videos: VideoSummary[];
}

export async function fetchTrending({
  region,
  maxItems,
  apiKey,
}: {
  region?: string;
  maxItems?: number;
  apiKey?: string;
}): Promise<TrendingResult> {
  const regionCode = (region?.trim() || "FR").toUpperCase();
  if (!/^[A-Z]{2}$/.test(regionCode)) {
    throw new WidgetValidationError("region must be a 2-letter country code (e.g. FR, US)");
  }

  const data = (await youtubeGet(
    "/videos",
    {
      part: "snippet,statistics",
      chart: "mostPopular",
      regionCode,
      maxResults: String(clampItems(maxItems)),
    },
    apiKey,
  )) as { items?: VideoResource[] };

  return { region: regionCode, videos: (data.items ?? []).map(toVideoSummary) };
}
