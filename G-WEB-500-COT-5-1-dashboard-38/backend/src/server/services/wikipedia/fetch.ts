import { WidgetFetchError, WidgetRateLimitError, WidgetValidationError } from "@/server/widgets/errors";

// Wikipédia (APIs publiques Wikimedia, sans clé) :
// - "Ce jour-là" : GET /feed/v1/wikipedia/{lang}/onthisday/selected/{MM}/{DD}
// - plus lus     : GET /feed/v1/wikipedia/{lang}/featured/{YYYY}/{MM}/{DD} -> mostread
// Politique d'usage Wikimedia : un User-Agent identifiant l'app est requis
// (même raisonnement que Nominatim dans weather/fetch.ts).
const FETCH_TIMEOUT_MS = 8000;
const WIKIMEDIA_API = "https://api.wikimedia.org/feed/v1/wikipedia";
const WIKIMEDIA_HEADERS = { "User-Agent": "HublyDashboard/1.0 (Epitech project)" };

function normalizeLang(value: string | undefined): string {
  const lang = (value ?? "").trim().toLowerCase();
  if (!/^[a-z-]{2,12}$/.test(lang)) {
    throw new WidgetValidationError('lang must look like "fr" or "en"');
  }
  return lang;
}

function boundLimit(limit: number | undefined, def: number, max: number): number {
  // GET direct (?max_items=abc) arrive ici en NaN via Number() dans data.ts :
  // retomber sur le défaut plutôt que slice(0, NaN) = liste vide.
  const raw = typeof limit === "number" ? limit : Number(limit);
  const safe = Number.isFinite(raw) ? raw : def;
  return Math.min(Math.max(Math.trunc(safe), 1), max);
}

export interface WikiOnThisDayParams {
  lang: string;
  maxItems?: number;
}

export interface WikiOnThisDayEvent {
  year: number | null;
  text: string;
  pages: { title: string; url: string | null }[];
}

export interface WikiOnThisDayResult {
  lang: string;
  month: number;
  day: number;
  events: WikiOnThisDayEvent[];
}

export async function fetchWikiOnThisDay({
  lang,
  maxItems,
}: WikiOnThisDayParams): Promise<WikiOnThisDayResult> {
  const language = normalizeLang(lang);
  const max = boundLimit(maxItems, 5, 10);
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");

  let response: Response;
  try {
    response = await fetch(`${WIKIMEDIA_API}/${encodeURIComponent(language)}/onthisday/selected/${mm}/${dd}`, {
      headers: WIKIMEDIA_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach the Wikipedia service");
  }

  if (response.status === 429) {
    throw new WidgetRateLimitError("Wikipedia rate limit exceeded, try again shortly");
  }
  if (response.status === 404 || response.status === 400) {
    throw new WidgetValidationError(`unsupported language: ${language}`);
  }
  if (!response.ok) {
    throw new WidgetFetchError(`Wikipedia service responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    selected?: Array<{
      year?: number;
      text?: string;
      pages?: Array<{ title?: string; content_urls?: { desktop?: { page?: string } } }>;
    }>;
  };

  const events: WikiOnThisDayEvent[] = (data.selected ?? []).slice(0, max).map((event) => ({
    year: typeof event.year === "number" ? event.year : null,
    text: event.text ?? "",
    pages: (event.pages ?? []).slice(0, 3).map((page) => ({
      title: (page.title ?? "").replace(/_/g, " "),
      url: page.content_urls?.desktop?.page ?? null,
    })),
  }));

  return { lang: language, month, day, events };
}

export interface WikiTopReadParams {
  lang: string;
  maxItems?: number;
}

export interface WikiTopReadArticle {
  title: string;
  views: number;
  rank: number | null;
  url: string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

export interface WikiTopReadResult {
  lang: string;
  date: string;
  articles: WikiTopReadArticle[];
}

export async function fetchWikiTopRead({ lang, maxItems }: WikiTopReadParams): Promise<WikiTopReadResult> {
  const language = normalizeLang(lang);
  const max = boundLimit(maxItems, 5, 20);

  // Le classement du jour est incomplet en cours de journée : on prend celui
  // d'hier (UTC), toujours finalisé.
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yyyy = yesterday.getUTCFullYear();
  const mm = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(yesterday.getUTCDate()).padStart(2, "0");

  let response: Response;
  try {
    response = await fetch(`${WIKIMEDIA_API}/${encodeURIComponent(language)}/featured/${yyyy}/${mm}/${dd}`, {
      headers: WIKIMEDIA_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach the Wikipedia service");
  }

  if (response.status === 429) {
    throw new WidgetRateLimitError("Wikipedia rate limit exceeded, try again shortly");
  }
  if (response.status === 404 || response.status === 400) {
    throw new WidgetValidationError(`unsupported language: ${language}`);
  }
  if (!response.ok) {
    throw new WidgetFetchError(`Wikipedia service responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    mostread?: {
      date?: string;
      articles?: Array<{
        title?: string;
        views?: number;
        rank?: number;
        content_urls?: { desktop?: { page?: string } };
        description?: string;
        thumbnail?: { source?: string };
      }>;
    };
  };

  const articles: WikiTopReadArticle[] = (data.mostread?.articles ?? [])
    // Pages techniques, pas des articles à afficher dans un widget.
    .filter((article) => {
      const title = article.title ?? "";
      return (
        title &&
        !title.startsWith("Special:") &&
        !title.startsWith("Spécial:") &&
        title !== "Main_Page" &&
        title !== "Accueil"
      );
    })
    .slice(0, max)
    .map((article) => ({
      title: (article.title ?? "").replace(/_/g, " "),
      views: article.views ?? 0,
      rank: typeof article.rank === "number" ? article.rank : null,
      url: article.content_urls?.desktop?.page ?? null,
      description: article.description ?? null,
      thumbnailUrl: article.thumbnail?.source ?? null,
    }));

  return { lang: language, date: data.mostread?.date ?? `${yyyy}-${mm}-${dd}`, articles };
}
