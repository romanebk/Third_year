import {
  WidgetFetchError,
  WidgetRateLimitError,
  WidgetValidationError,
} from "@/server/widgets/errors";

// HTTP volontaire : l'API Hipolabs ne répond pas en HTTPS (le port 443 refuse
// la connexion — vérifié). Ce n'est donc pas une erreur de configuration, mais
// une contrainte de l'API amont ; la requête ne porte aucune donnée sensible.
const HIPOLABS_API = "http://universities.hipolabs.com";
const FETCH_TIMEOUT_MS = 10000;
const DEFAULT_MAX_ITEMS = 20;
const MAX_MAX_ITEMS = 100;

function boundLimit(value: number | undefined, def: number, max: number): number {
  const raw = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(raw) ? raw : def;
  return Math.min(Math.max(Math.trunc(safe), 1), max);
}

function normalizeCountry(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const country = value.trim();
  if (!/^[A-Za-z\s\-]{2,}$/.test(country)) {
    throw new WidgetValidationError("country must be a valid country name (e.g. France, United States)");
  }
  return country;
}

function normalizeName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const name = value.trim();
  if (name.length < 2) {
    throw new WidgetValidationError("name must be at least 2 characters");
  }
  return name;
}

async function hipolabsGet(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${HIPOLABS_API}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach universities.hipolabs.com");
  }

  if (response.status === 429) {
    throw new WidgetRateLimitError("Hipolabs rate limit exceeded");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`Hipolabs responded with status ${response.status}`);
  }
  return response.json();
}

export interface UniversityItem {
  name: string;
  country: string;
  alpha_two_code: string;
  "state-province": string | null;
  domains: string[];
  web_pages: string[];
}

export interface UnisByCountryParams {
  country: string;
  maxItems?: number;
}

export interface UnisByCountryResult {
  country: string;
  universities: UniversityItem[];
}

export async function fetchUnisByCountry(
  params: UnisByCountryParams,
  _accessToken: string | undefined,
): Promise<UnisByCountryResult> {
  const country = normalizeCountry(params.country)!;
  const maxItems = boundLimit(params.maxItems, DEFAULT_MAX_ITEMS, MAX_MAX_ITEMS);

  const data = await hipolabsGet(`/search?country=${encodeURIComponent(country)}`) as UniversityItem[];

  return { country, universities: data.slice(0, maxItems) };
}

export interface UnisSearchParams {
  name?: string;
  country?: string;
  maxItems?: number;
}

export interface UnisSearchResult {
  query: { name?: string; country?: string };
  universities: UniversityItem[];
}

export async function fetchUnisSearch(
  params: UnisSearchParams,
  _accessToken: string | undefined,
): Promise<UnisSearchResult> {
  const name = normalizeName(params.name);
  const country = normalizeCountry(params.country);
  const maxItems = boundLimit(params.maxItems, DEFAULT_MAX_ITEMS, MAX_MAX_ITEMS);

  const queryParams = new URLSearchParams();
  if (name) queryParams.set("name", name);
  if (country) queryParams.set("country", country);

  const data = await hipolabsGet(`/search?${queryParams.toString()}`) as UniversityItem[];

  return { query: { name, country }, universities: data.slice(0, maxItems) };
}
