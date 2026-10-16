// Centres d'intérêt médias proposés à l'utilisateur (choisis dans /settings,
// agrégés par le widget rss_interest_feed). Chaque intérêt mappe un ou plusieurs
// flux RSS — curation manuelle pour garder des flux réellement alimentés et
// riches en vignettes (les cartes d'article du dashboard affichent imageUrl).
export interface RssInterest {
  key: string;
  label: string;
  feeds: string[];
  emoji: string;
}

export const RSS_INTERESTS: RssInterest[] = [
  {
    key: "technology",
    label: "Technology",
    feeds: ["https://www.theverge.com/rss/index.xml"],
    emoji: "💻",
  },
  {
    key: "world",
    label: "World",
    feeds: ["https://feeds.bbci.co.uk/news/world/rss.xml"],
    emoji: "🌍",
  },
  {
    key: "science",
    label: "Science",
    feeds: ["https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"],
    emoji: "🔬",
  },
  {
    key: "business",
    label: "Business",
    feeds: ["https://feeds.bbci.co.uk/news/business/rss.xml"],
    emoji: "📈",
  },
  {
    key: "sports",
    label: "Sports",
    feeds: ["https://feeds.bbci.co.uk/sport/rss.xml"],
    emoji: "⚽",
  },
  {
    key: "gaming",
    label: "Gaming",
    feeds: ["https://www.polygon.com/rss/index.xml"],
    emoji: "🎮",
  },
];

export function getInterest(key: string): RssInterest | undefined {
  return RSS_INTERESTS.find((interest) => interest.key === key);
}

export function isValidInterestKey(key: string): boolean {
  return RSS_INTERESTS.some((interest) => interest.key === key);
}

// Résout une liste de clés (string "a,b,c" ou tableau) en flux RSS à aller
// chercher, sans doublons. Une clé inconnue est ignorée plutôt que de casser
// l'agrégat ; si rien de valide n'est fourni, on retombe sur le premier
// intérêt du catalogue pour ne jamais afficher un widget RSS vide.
export function feedsForInterestKeys(interests: string | string[] | undefined): string[] {
  const keys = Array.isArray(interests)
    ? interests
    : (interests ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
  const valid = keys.filter(isValidInterestKey);
  const resolved = (valid.length > 0 ? valid : [RSS_INTERESTS[0].key]).flatMap(
    (key) => getInterest(key)?.feeds ?? [],
  );
  return Array.from(new Set(resolved));
}

export function interestNamesForKeys(interests: string | string[] | undefined): string {
  const keys = Array.isArray(interests)
    ? interests
    : (interests ?? "")
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
  const names = keys
    .map(getInterest)
    .filter((interest) => interest !== undefined)
    .map((interest) => interest!.label);
  return names.join(", ") || RSS_INTERESTS[0].label;
}