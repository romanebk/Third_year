// Présentation des paramètres de widget dans les formulaires (ajout depuis
// /services ou le dashboard, reconfiguration) : libellé lisible, exemple,
// aide, valeur par défaut et, quand les valeurs possibles sont connues, une
// liste de choix — au lieu d'un champ texte brut nommé "max_items". Le
// backend reste la seule validation (tous les paramètres y sont obligatoires,
// d'où les valeurs par défaut pré-remplies ici).

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  label: string;
  placeholder?: string;
  help?: string;
  defaultValue?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
}

const COUNT_FIELD: FieldSpec = { label: "Number of items", defaultValue: "5", min: 1, max: 10 };

// Devises supportées par le service (Frankfurter/BCE + francs CFA arrimés à
// l'euro) — même présentation "Nom (CODE)" que le sélecteur de devise crypto.
const CURRENCY_OPTIONS: FieldOption[] = [
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "US dollar (USD)" },
  { value: "XOF", label: "CFA franc West (XOF)" },
  { value: "XAF", label: "CFA franc Central (XAF)" },
  { value: "GBP", label: "Pound sterling (GBP)" },
  { value: "JPY", label: "Japanese yen (JPY)" },
  { value: "CHF", label: "Swiss franc (CHF)" },
  { value: "CAD", label: "Canadian dollar (CAD)" },
  { value: "AUD", label: "Australian dollar (AUD)" },
  { value: "CNY", label: "Chinese yuan (CNY)" },
  { value: "SEK", label: "Swedish krona (SEK)" },
  { value: "NZD", label: "New Zealand dollar (NZD)" },
  { value: "MXN", label: "Mexican peso (MXN)" },
  { value: "SGD", label: "Singapore dollar (SGD)" },
  { value: "HKD", label: "Hong Kong dollar (HKD)" },
  { value: "NOK", label: "Norwegian krone (NOK)" },
  { value: "KRW", label: "South Korean won (KRW)" },
  { value: "TRY", label: "Turkish lira (TRY)" },
  { value: "INR", label: "Indian rupee (INR)" },
  { value: "BRL", label: "Brazilian real (BRL)" },
  { value: "ZAR", label: "South African rand (ZAR)" },
  { value: "DKK", label: "Danish krone (DKK)" },
  { value: "PLN", label: "Polish zloty (PLN)" },
  { value: "IDR", label: "Indonesian rupiah (IDR)" },
  { value: "HUF", label: "Hungarian forint (HUF)" },
  { value: "CZK", label: "Czech koruna (CZK)" },
  { value: "ILS", label: "Israeli shekel (ILS)" },
  { value: "PHP", label: "Philippine peso (PHP)" },
  { value: "MYR", label: "Malaysian ringgit (MYR)" },
  { value: "THB", label: "Thai baht (THB)" },
  { value: "RON", label: "Romanian leu (RON)" },
  { value: "ISK", label: "Icelandic krona (ISK)" },
];

const FIELDS: Record<string, FieldSpec> = {
  city: { label: "City", placeholder: "Paris", help: "Any city name, in any language." },
  unit: {
    label: "Unit",
    defaultValue: "celsius",
    options: [
      { value: "celsius", label: "Celsius (°C)" },
      { value: "fahrenheit", label: "Fahrenheit (°F)" },
    ],
  },
  days: { label: "Number of days", defaultValue: "7", min: 1, max: 16 },
  repository: { label: "Repository", placeholder: "vercel/next.js", help: "Format: owner/repository." },
  max_commits: { label: "Number of commits", defaultValue: "5", min: 1, max: 30 },
  username: { label: "GitHub username", placeholder: "torvalds" },
  steam_id: {
    label: "Steam ID",
    placeholder: "76561197960287930",
    help: "Your 17-digit SteamID64 (find it on steamid.io). Your game details must be public.",
  },
  period_days: { label: "Period (days)", defaultValue: "14", min: 1, max: 30 },
  app_id: {
    label: "Game ID",
    placeholder: "570",
    help: "The number in the game's Steam store URL (570 = Dota 2).",
  },
  max_items: COUNT_FIELD,
  limit: { label: "Number of coins", defaultValue: "5", min: 1, max: 20 },
  feed_url: {
    label: "Feed URL",
    placeholder: "https://hnrss.org/frontpage",
    help: "Link to an RSS or Atom feed.",
  },
  interests: {
    label: "Topics",
    placeholder: "technology, world, science",
    defaultValue: "technology,world,science",
    help: "Comma-separated: technology, world, science, business, sports, gaming.",
  },
  coin: {
    label: "Coin",
    placeholder: "bitcoin",
    defaultValue: "bitcoin",
    help: "CoinGecko id: bitcoin, ethereum, solana, dogecoin…",
  },
  currency: {
    label: "Currency",
    defaultValue: "usd",
    options: [
      { value: "usd", label: "US dollar (USD)" },
      { value: "eur", label: "Euro (EUR)" },
      { value: "gbp", label: "Pound sterling (GBP)" },
      { value: "jpy", label: "Yen (JPY)" },
      { value: "xof", label: "CFA franc (XOF)" },
    ],
  },
  address: { label: "Address", placeholder: "Eiffel Tower, Paris" },
  zoom: { label: "Zoom", defaultValue: "13", min: 1, max: 18, help: "1 = world, 18 = street." },
  origin: { label: "From", placeholder: "Paris" },
  destination: { label: "To", placeholder: "Lyon" },
  channel: {
    label: "Channel",
    placeholder: "@MrBeast",
    help: "A @handle, the channel URL or its ID.",
  },
  base: {
    label: "Base currency",
    defaultValue: "EUR",
    options: CURRENCY_OPTIONS,
    help: "Convert from this currency.",
  },
  target: {
    label: "Target currency",
    defaultValue: "USD",
    options: CURRENCY_OPTIONS,
    help: "Convert to this currency.",
  },
  lang: {
    label: "Language",
    defaultValue: "fr",
    options: [
      { value: "fr", label: "Français (FR)" },
      { value: "en", label: "English (EN)" },
      { value: "es", label: "Español (ES)" },
      { value: "de", label: "Deutsch (DE)" },
    ],
  },
  name: {
    label: "University name",
    placeholder: "Sorbonne",
    help: "Part of a university's name (case-insensitive).",
  },
  ip: {
    label: "IP address",
    placeholder: "8.8.8.8",
    help: "A public IPv4 address (private/reserved ranges cannot be geolocated).",
  },
  date: {
    label: "Date",
    placeholder: "2024-07-04",
    help: "Format YYYY-MM-DD, any past date. Leave empty for today's picture.",
  },
  hd: {
    label: "Image quality",
    defaultValue: "0",
    options: [
      { value: "0", label: "Standard" },
      { value: "1", label: "HD" },
    ],
  },
  year: { label: "Year", defaultValue: String(new Date().getFullYear()), min: 2000, max: new Date().getFullYear() + 5 },
};

// "country" et "region" désignent des choses différentes selon le widget
// (ex: country = code ISO 2 lettres pour holidays, mais nom complet du pays
// pour universities ; region = code de subdivision "FR-IDF" pour holidays,
// mais code pays de tendance YouTube pour youtube_trending) — un même
// FieldSpec global par nom de paramètre produisait un libellé/aide trompeur,
// voire deux champs affichés "Country" sur le même formulaire (holidays_upcoming :
// country + region tous les deux étiquetés "Country"). Résolu par widget
// plutôt que par paramètre, consulté en priorité par fieldSpec ci-dessous.
const WIDGET_FIELD_OVERRIDES: Record<string, Record<string, FieldSpec>> = {
  holidays_upcoming: {
    country: {
      label: "Country",
      placeholder: "FR",
      help: "2-letter ISO country code (e.g. FR, US, DE, ES, IT).",
    },
    region: {
      label: "Region (optional)",
      placeholder: "FR-IDF",
      help: 'Subdivision code, format "XX-YY" (e.g. FR-IDF for Île-de-France). Leave empty for all regions.',
    },
  },
  holidays_year: {
    country: {
      label: "Country",
      placeholder: "FR",
      help: "2-letter ISO country code (e.g. FR, US, DE, ES, IT).",
    },
  },
  unis_by_country: {
    country: {
      label: "Country",
      placeholder: "France",
      help: "Full country name, in English (e.g. France, United States).",
    },
  },
  unis_search: {
    country: {
      label: "Country (optional)",
      placeholder: "France",
      help: "Full country name, in English (e.g. France, United States). Leave empty to search all countries.",
    },
  },
  youtube_trending: {
    region: {
      label: "Country",
      defaultValue: "FR",
      options: [
        { value: "FR", label: "France" },
        { value: "US", label: "United States" },
        { value: "GB", label: "United Kingdom" },
        { value: "BJ", label: "Benin" },
        { value: "CA", label: "Canada" },
        { value: "DE", label: "Germany" },
        { value: "JP", label: "Japan" },
        { value: "BR", label: "Brazil" },
      ],
      help: "Trending videos for this country.",
    },
  },
};

export function fieldSpec(name: string, type: "integer" | "string", widgetName?: string): FieldSpec {
  return (
    (widgetName ? WIDGET_FIELD_OVERRIDES[widgetName]?.[name] : undefined) ??
    FIELDS[name] ?? {
      label: name.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase()),
      placeholder: type === "integer" ? "5" : undefined,
    }
  );
}

// Valeurs initiales d'un formulaire d'ajout : les défauts connus, rien sinon.
export function defaultParamValues(
  params: { name: string; type: "integer" | "string" }[],
  widgetName?: string,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const param of params) {
    const fallback = fieldSpec(param.name, param.type, widgetName).defaultValue;
    if (fallback !== undefined) values[param.name] = fallback;
  }
  return values;
}

// Fréquences proposées au lieu d'un nombre de secondes à saisir ; filtrées
// selon le minimum du service (cf. GET /api/services minRefreshRateSeconds).
const REFRESH_PRESETS = [10, 30, 60, 120, 300, 600, 900, 1800, 3600];

export function refreshOptions(minSeconds: number, current?: number): FieldOption[] {
  const values = REFRESH_PRESETS.filter((seconds) => seconds >= minSeconds);
  // Une instance existante peut avoir une valeur hors liste (saisie avant
  // ce sélecteur) : on la garde sélectionnable plutôt que de la perdre.
  if (current !== undefined && current >= minSeconds && !values.includes(current)) {
    values.push(current);
    values.sort((a, b) => a - b);
  }
  return values.map((seconds) => ({ value: String(seconds), label: `Every ${formatSeconds(seconds)}` }));
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return minutes === 1 ? "minute" : `${minutes} minutes`;
  }
  const hours = Math.round(seconds / 3600);
  return hours === 1 ? "hour" : `${hours} hours`;
}

// Fréquence par défaut d'un nouveau widget : 5 min, ou le minimum du service
// s'il est plus élevé.
export function defaultRefreshSeconds(minSeconds: number): number {
  return Math.max(300, minSeconds);
}
