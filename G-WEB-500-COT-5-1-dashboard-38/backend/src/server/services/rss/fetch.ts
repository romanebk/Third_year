import { WidgetFetchError, WidgetValidationError } from "@/server/widgets/errors";
import { safeFetch } from "@/server/widgets/ssrf-guard";
import { feedsForInterestKeys } from "@/server/services/rss/interests";

export interface ArticleListParams {
  feedUrl: string;
  maxItems?: number;
}

export interface InterestFeedParams {
  interests: string;
  maxItems?: number;
}

export interface ArticleItem {
  title: string;
  link: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
}

export interface ArticleListResult {
  feedUrl: string;
  title: string | null;
  source: "rss" | "atom";
  articles: ArticleItem[];
}

// Un article = un bloc <item> (RSS 2.0) ou <entry> (Atom). Les deux formats
// partagent <title>, <link> (texte pour RSS, attribut href pour Atom) et une
// date (<pubDate>/<dc:date> ou <published>/<updated>). Parseur léger volontaire :
// pas de dépendance XML pour un format aussi contraint qu'un flux simple.
function firstMatch(block: string, pattern: RegExp): string | null {
  return block.match(pattern)?.[1]?.trim() ?? null;
}

function cleanText(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, inner: string) => inner)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

// Vignette d'un article : d'abord les balises spécialisées (enclosure/media),
// puis en dernier recours la première <img> du contenu HTML de l'article.
function extractImage(block: string): string | null {
  const enclosure = block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']+["']/i);
  if (enclosure) return enclosure[1];
  const mediaContent = block.match(/<media:content\b[^>]*\burl=["']([^"']+)["']/i);
  const mediaThumb = block.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i);
  if (mediaContent) return mediaContent[1];
  if (mediaThumb) return mediaThumb[1];
  const contentImg =
    block.match(/<(?:description|content(?::encoded)?)\b[\s\S]*?<img\b[^>]*\bsrc=["']([^"']+)["']/i) ??
    block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if (contentImg) return cleanText(contentImg[1]) || null;
  return null;
}

function parseRss(text: string, maxItems: number): ArticleListResult {
  const channel = text.match(/<channel\b[\s\S]*?<\/channel>/i)?.[0] ?? "";
  const title = cleanText(firstMatch(channel, /<title\b[^>]*>([\s\S]*?)<\/title>/i));
  const blocks = Array.from(text.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((m) => m[0]);

  return {
    feedUrl: "",
    title: title || null,
    source: "rss",
    articles: blocks.slice(0, maxItems).map((block) => ({
      // <title> peut porter des attributs (type="html", xml:lang…) selon
      // l'auteur du flux — on tolère les attributs pour ne pas perdre le titre
      // (Verge publie par ex. <title type="html">, BBC <title> simple).
      title: cleanText(firstMatch(block, /<title\b[^>]*>([\s\S]*?)<\/title>/i)),
      link: cleanText(firstMatch(block, /<link>([\s\S]*?)<\/link>/i)) || null,
      imageUrl: extractImage(block),
      publishedAt: toIso(
        firstMatch(block, /<pubDate>([\s\S]*?)<\/pubDate>/i) ??
          firstMatch(block, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i),
      ),
    })),
  };
}

function parseAtom(text: string, maxItems: number): ArticleListResult {
  const title = cleanText(firstMatch(text, /<feed\b[^>]*[\s\S]*?<title\b[^>]*>([\s\S]*?)<\/title>/i));
  const blocks = Array.from(text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map((m) => m[0]);

  const linkPattern = /<link\b[^>]*?rel=["']alternate["'][^>]*?href=["']([^"']+)["']/i;
  const bareLinkPattern = /<link\b[^>]*?href=["']([^"']+)["']/i;

  return {
    feedUrl: "",
    title: title || null,
    source: "atom",
    articles: blocks.slice(0, maxItems).map((block) => ({
      title: cleanText(firstMatch(block, /<title\b[^>]*>([\s\S]*?)<\/title>/i)),
      link: firstMatch(block, linkPattern) ?? firstMatch(block, bareLinkPattern) ?? null,
      imageUrl: extractImage(block),
      publishedAt: toIso(
        firstMatch(block, /<(?:published|updated)>([\s\S]*?)<\/(?:published|updated)>/i),
      ),
    })),
  };
}

export async function fetchArticleList({
  feedUrl,
  maxItems,
}: ArticleListParams): Promise<ArticleListResult> {
  if (!feedUrl?.trim()) {
    throw new WidgetValidationError("feed_url is required");
  }
  if (!/^https?:\/\//i.test(feedUrl.trim())) {
    throw new WidgetValidationError("feed_url must start with http(s)://");
  }
  return fetchAndParseFeed(feedUrl.trim(), maxItems);
}

// Flux agrégé d'un intérêt (rss_interest_feed) : résout les clés d'intérêt en
// flux RSS (cf. interests.ts), va tous les chercher puis fusionne les articles
// en une seule liste triée par date de publication décroissante — le panneau
// "se lit comme un flux médiatique" et non comme une concaténation brute.
export async function fetchInterestFeed({
  interests,
  maxItems,
}: InterestFeedParams): Promise<ArticleListResult> {
  const feeds = feedsForInterestKeys(interests);
  if (feeds.length === 0) {
    throw new WidgetValidationError("no valid interest selected");
  }

  // Chaque flux est récupéré indépendamment ; un flux mort (réseau, 5xx) ne
  // doit pas empêcher les autres d'être rendus — on collecte les résultats
  // réussis et on lève seulement si aucun n'a abouti.
  const settled = await Promise.allSettled(feeds.map((feed) => fetchAndParseFeed(feed, maxItems)));
  const merged: ArticleItem[] = settled
    .filter((result): result is PromiseFulfilledResult<ArticleListResult> => result.status === "fulfilled")
    .flatMap((result) => result.value.articles);

  if (merged.length === 0) {
    throw new WidgetFetchError("could not reach any news feed");
  }

  merged.sort((a, b) => {
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  const limit = Math.min(Math.max(Math.trunc(maxItems ?? 5), 1), 40);
  return {
    feedUrl: "",
    title: "Your interests",
    source: "rss",
    articles: merged.slice(0, limit).map(({ title, link, publishedAt, imageUrl }) => ({
      title,
      link,
      publishedAt,
      imageUrl,
    })),
  };
}

async function fetchAndParseFeed(feedUrl: string, maxItems?: number): Promise<ArticleListResult> {
  // Borné (1-20) : une liste d'articles au-delà d'une vingtaine ne s'affiche pas,
  // et les gros flux méritent d'autres moyens (pagination) que ce widget léger.
  const limit = Math.min(Math.max(Math.trunc(maxItems ?? 5), 1), 20);

  let response: Response;
  try {
    // safeFetch (pas fetch direct) : feed_url est fourni par l'utilisateur —
    // sans ce garde, il pourrait faire cibler le serveur vers une adresse
    // interne (SSRF), cf. le commentaire de ssrf-guard.ts.
    response = await safeFetch(feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
        "User-Agent": "Hubly/1.0 widget (dashboard)",
      },
    });
  } catch (error) {
    if (error instanceof WidgetValidationError) throw error;
    throw new WidgetFetchError("could not reach the feed");
  }

  if (response.status >= 400 && response.status < 500) {
    throw new WidgetValidationError(`feed not found: ${feedUrl}`);
  }
  if (!response.ok) {
    throw new WidgetFetchError(`feed responded with status ${response.status}`);
  }

  const text = await response.text();
  const isAtom = /<feed\b/i.test(text);
  const result = isAtom ? parseAtom(text, limit) : parseRss(text, limit);

  if (result.articles.length === 0) {
    throw new WidgetFetchError("no article found in feed");
  }

  return { ...result, feedUrl };
}