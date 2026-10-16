import {
  WidgetFetchError,
  WidgetRateLimitError,
  WidgetValidationError,
} from "@/server/widgets/errors";

const NASA_API = "https://api.nasa.gov/planetary/apod";
const FETCH_TIMEOUT_MS = 8000;
const DEMO_KEY = "DEMO_KEY"; // 30 req/jour — suffisant pour démo/dev

function normalizeDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new WidgetValidationError('date must be YYYY-MM-DD');
  }
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d > new Date()) {
    throw new WidgetValidationError('date must be a valid past date (YYYY-MM-DD)');
  }
  return date;
}

async function nasaGet(params: Record<string, string>): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${NASA_API}?${new URLSearchParams(params)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach NASA APOD");
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { code: number; message?: string };
  } | null;

  if (response.status === 429 || body?.error?.message?.includes("rate limit")) {
    throw new WidgetRateLimitError("NASA API rate limit exceeded, try again shortly");
  }
  if (response.status === 400 || response.status === 404) {
    throw new WidgetValidationError(body?.error?.message ?? "invalid request to NASA APOD");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`NASA APOD responded with status ${response.status}`);
  }
  return body;
}

export interface NasaApodParams {
  date?: string;
  hd?: 0 | 1;
}

export interface NasaApodResult {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  copyright?: string;
  service_version: string;
}

export async function fetchApod(
  params: NasaApodParams,
  _accessToken: string | undefined,
): Promise<NasaApodResult> {
  const date = normalizeDate(params.date);
  const hd = params.hd === 1 ? "true" : "false";

  const data = await nasaGet({
    api_key: DEMO_KEY,
    ...(date && { date }),
    hd,
    thumbs: "true",
  }) as NasaApodResult;

  return data;
}

export interface NasaApodRandomResult extends NasaApodResult {}

export async function fetchApodRandom(
  _params: Record<string, never>,
  _accessToken: string | undefined,
): Promise<NasaApodRandomResult> {
  // NASA APOD commence le 1995-06-16
  const start = new Date("1995-06-16").getTime();
  const end = Date.now();
  const randomTime = start + Math.random() * (end - start);
  const randomDate = new Date(randomTime).toISOString().split("T")[0];

  const data = await nasaGet({
    api_key: DEMO_KEY,
    date: randomDate,
    hd: "false",
    thumbs: "true",
  }) as NasaApodRandomResult;

  return data;
}
