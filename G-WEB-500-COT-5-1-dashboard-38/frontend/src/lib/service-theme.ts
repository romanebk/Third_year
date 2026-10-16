// Identité visuelle du dashboard : une couleur d'accent par service (icône,
// liseré de carte, halo) et un libellé lisible par widget — au lieu du nom
// technique ("weather_city_current") affiché tel quel dans le titre des cartes.
// Les accents sont choisis pour rester lisibles (>= 4.5:1) en texte sur le fond
// sombre des cartes ; les fonds teintés utilisent la même couleur à faible
// opacité (cf. accentTint).

export interface ServiceTheme {
  label: string;
  accent: string;
  // Phrase courte affichée sur /services (l'UI est en anglais ; les
  // descriptions du registre backend, reprises par /about.json, restent telles quelles).
  tagline: string;
}

const SERVICE_THEMES: Record<string, ServiceTheme> = {
  weather: { label: "Weather", accent: "#38BDF8", tagline: "Current conditions and multi-day forecasts for any city." },
  rss: { label: "News", accent: "#FB923C", tagline: "Headlines from your favourite topics or any RSS feed." },
  github: { label: "GitHub", accent: "#A78BFA", tagline: "Profiles, recent commits and security alerts." },
  "google-calendar": { label: "Google Calendar", accent: "#4285F4", tagline: "Upcoming events and today's agenda." },
  youtube: { label: "YouTube", accent: "#FF4E45", tagline: "Channel stats, latest uploads and what's trending." },
  crypto: { label: "Crypto", accent: "#FBBF24", tagline: "Live prices and the top coins by market cap." },
  maps: { label: "Maps", accent: "#34D399", tagline: "A map of any address and driving routes." },
  steam: { label: "Steam", accent: "#60A5FA", tagline: "Most played games and the latest game news." },
  devises: { label: "Currency", accent: "#4ADE80", tagline: "Exchange rates and history (ECB reference rates)." },
  wikipedia: { label: "Wikipedia", accent: "#E2E8F0", tagline: "On this day and the most read articles." },
  nasa: { label: "NASA", accent: "#0B3D91", tagline: "Astronomy Picture of the Day and random space images." },
  holidays: { label: "Holidays", accent: "#EAB308", tagline: "Official public holidays by country and region." },
  ipgeo: { label: "IP Location", accent: "#06B6D4", tagline: "Your location or any IP — city, country, timezone, ISP." },
  universities: { label: "Universities", accent: "#7C3AED", tagline: "Worldwide university search by country or name." },
};

const FALLBACK_THEME: ServiceTheme = { label: "Widget", accent: "#A1A1AA", tagline: "" };

export function serviceTheme(service: string): ServiceTheme {
  return SERVICE_THEMES[service] ?? FALLBACK_THEME;
}

const WIDGET_LABELS: Record<string, string> = {
  weather_city_current: "Current weather",
  weather_city_forecast: "Forecast",
  rss_article_list: "News feed",
  rss_interest_feed: "Your news",
  github_recent_commits: "Recent commits",
  github_user_profile: "GitHub profile",
  github_security_alerts: "Security alerts",
  gcal_upcoming: "Upcoming events",
  gcal_today: "Today's agenda",
  youtube_channel_stats: "Channel stats",
  youtube_latest_videos: "Latest videos",
  youtube_trending: "Trending",
  crypto_price: "Price",
  crypto_top_coins: "Top coins",
  map_location: "Map",
  map_distance: "Route",
  steam_most_played: "Most played",
  steam_game_news: "Game news",
  devise_rate: "Exchange rate",
  devise_history: "Rate history",
  wiki_onthisday: "On this day",
  wiki_top_read: "Most read",
  nasa_apod: "Astronomy Picture of the Day",
  nasa_apod_random: "Random NASA Image",
  holidays_upcoming: "Upcoming Holidays",
  holidays_year: "Year Holidays",
  ipgeo_current: "My Location",
  ipgeo_lookup: "IP Lookup",
  unis_by_country: "Universities by Country",
  unis_search: "University Search",
};

const WIDGET_DESCRIPTIONS: Record<string, string> = {
  weather_city_current: "Temperature and conditions right now.",
  weather_city_forecast: "The next days at a glance.",
  rss_article_list: "Latest articles from one feed.",
  rss_interest_feed: "Top stories from the topics you pick.",
  github_recent_commits: "Latest commits on a repository.",
  github_user_profile: "Followers, repos and contribution heatmap.",
  github_security_alerts: "Open Dependabot alerts (linked account).",
  gcal_upcoming: "Next events from your Google Calendar.",
  gcal_today: "Events scheduled for today.",
  youtube_channel_stats: "Subscribers, views and videos of a channel.",
  youtube_latest_videos: "A channel's newest uploads.",
  youtube_trending: "Most popular videos in a country.",
  crypto_price: "Live price and 24h change of a coin.",
  crypto_top_coins: "Biggest coins by market cap.",
  map_location: "A map centred on an address.",
  map_distance: "Driving distance and time between two places.",
  steam_most_played: "Games you played the most.",
  steam_game_news: "News for a Steam game.",
  devise_rate: "Current rate of a currency pair.",
  devise_history: "Rate history over N days.",
  wiki_onthisday: "Historical events that happened today.",
  wiki_top_read: "Yesterday's most viewed articles.",
  nasa_apod: "NASA's Astronomy Picture of the Day with explanation.",
  nasa_apod_random: "A random image from NASA's APOD archive.",
  holidays_upcoming: "Next public holidays for a country (and region).",
  holidays_year: "All public holidays for a country in a given year.",
  ipgeo_current: "Your current location based on IP address.",
  ipgeo_lookup: "Geolocation details for a specific IP address.",
  unis_by_country: "List of universities in a country.",
  unis_search: "Search universities by name and/or country.",
};

export function widgetDescription(widget: string, fallback = ""): string {
  return WIDGET_DESCRIPTIONS[widget] ?? fallback;
}

export function widgetLabel(widget: string): string {
  return WIDGET_LABELS[widget] ?? widget.replace(/_/g, " ");
}

// Sous-titre d'une carte : ce qui distingue deux instances du même widget
// (la ville, la chaîne, le dépôt...) — les paramètres numériques de pure
// présentation (max_items, zoom, days) n'aident pas à les distinguer.
const SUBTITLE_PARAMS = [
  "city",
  "channel",
  "username",
  "repository",
  "coin",
  "address",
  "region",
  "interests",
  "feed_url",
  "steam_id",
  "app_id",
  "base",
  "target",
  "lang",
  "country",
  "name",
  "ip",
  "date",
];

export function widgetSubtitle(service: string, widget: string, params: Record<string, string | number>): string {
  if (widget === "map_distance" && params.origin && params.destination) {
    return `${params.origin} → ${params.destination}`;
  }
  if (widget === "crypto_top_coins") {
    return String(params.currency ?? "usd").toUpperCase();
  }
  if ((widget === "devise_rate" || widget === "devise_history") && params.base && params.target) {
    return `${params.base} → ${params.target}`;
  }
  if ((widget === "wiki_onthisday" || widget === "wiki_top_read") && params.lang) {
    return String(params.lang).toUpperCase();
  }
  const key = SUBTITLE_PARAMS.find((name) => params[name] !== undefined && params[name] !== "");
  if (!key) return serviceTheme(service).label;
  const value = String(params[key]);
  if (key === "interests") return value.split(",").map((item) => item.trim()).join(" · ");
  if (key === "feed_url") return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (key === "region") return value.toUpperCase();
  // Identifiants CoinGecko en minuscules ("bitcoin") : capitalisés pour l'affichage.
  if (key === "coin") return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

// "#38BDF8" + 0.12 -> "rgba(56, 189, 248, 0.12)" : fonds teintés des icônes et
// halos, sans multiplier les tokens Tailwind par service.
export function accentTint(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 45 -> "45s", 300 -> "5 min", 3600 -> "1 h" : l'intervalle de rafraîchissement
// affiché à côté de l'indicateur "Live" d'une carte.
export function formatRefreshRate(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}
