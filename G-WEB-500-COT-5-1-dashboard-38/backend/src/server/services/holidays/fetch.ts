import {
  WidgetFetchError,
  WidgetRateLimitError,
  WidgetValidationError,
} from "@/server/widgets/errors";

const NAGER_API = "https://date.nager.at/api/v3";
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ITEMS = 10;
const MAX_MAX_ITEMS = 50;

const COUNTRY_CODE_REGEX = /^[A-Z]{2}$/;

function normalizeCountry(value: string | undefined, field: string): string {
  const code = (value ?? "").trim().toUpperCase();
  if (!COUNTRY_CODE_REGEX.test(code)) {
    throw new WidgetValidationError(`${field} must be a 2-letter country code (e.g. FR, US, DE)`);
  }
  return code;
}

function normalizeRegion(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const region = value.trim();
  if (!/^[A-Z]{2}-[A-Z0-9]{1,3}$/i.test(region)) {
    throw new WidgetValidationError('region must look like "FR-IDF" or "US-CA"');
  }
  return region.toUpperCase();
}

function boundYear(value: number | undefined): number {
  const now = new Date().getFullYear();
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw) || raw < 2000 || raw > now + 5) {
    return now;
  }
  return raw;
}

function boundLimit(value: number | undefined, def: number, max: number): number {
  const raw = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(raw) ? raw : def;
  return Math.min(Math.max(Math.trunc(safe), 1), max);
}

async function nagerGet(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${NAGER_API}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach Nager.Date");
  }

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;

  if (response.status === 429) {
    throw new WidgetRateLimitError("Nager.Date rate limit exceeded");
  }
  if (response.status === 404) {
    throw new WidgetValidationError(body?.error ?? "country not found or year not available");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`Nager.Date responded with status ${response.status}`);
  }
  return body;
}

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties?: string[];
  launchYear?: number;
  types: string[];
}

export interface HolidaysUpcomingParams {
  country: string;
  region?: string;
  maxItems?: number;
}

export interface HolidaysUpcomingResult {
  country: string;
  region?: string;
  holidays: HolidayItem[];
}

export async function fetchUpcomingHolidays(
  params: HolidaysUpcomingParams,
  _accessToken: string | undefined,
): Promise<HolidaysUpcomingResult> {
  const country = normalizeCountry(params.country, "country");
  const region = normalizeRegion(params.region);
  const maxItems = boundLimit(params.maxItems, DEFAULT_MAX_ITEMS, MAX_MAX_ITEMS);

  const year = new Date().getFullYear();
  const path = region
    ? `/PublicHolidays/${year}/${country}?subdivisions=true`
    : `/PublicHolidays/${year}/${country}`;

  const data = await nagerGet(path) as HolidayItem[];

  const now = new Date();
  const upcoming = data
    .filter((h) => new Date(h.date) >= now)
    .slice(0, maxItems);

  return { country, region, holidays: upcoming };
}

export interface HolidaysYearParams {
  country: string;
  year?: number;
}

export interface HolidaysYearResult {
  country: string;
  year: number;
  holidays: HolidayItem[];
}

export async function fetchYearHolidays(
  params: HolidaysYearParams,
  _accessToken: string | undefined,
): Promise<HolidaysYearResult> {
  const country = normalizeCountry(params.country, "country");
  const year = boundYear(params.year);

  const data = await nagerGet(`/PublicHolidays/${year}/${country}`) as HolidayItem[];

  return { country, year, holidays: data };
}
