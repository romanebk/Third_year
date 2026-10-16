import {
  WidgetFetchError,
  WidgetRateLimitError,
  WidgetValidationError,
} from "@/server/widgets/errors";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const FETCH_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ITEMS = 10;
const MAX_MAX_ITEMS = 50;
const DEFAULT_DAYS_AHEAD = 7;
const MAX_DAYS_AHEAD = 90;

async function calendarGet(
  path: string,
  params: Record<string, string>,
  accessToken: string | undefined,
): Promise<unknown> {
  const token = accessToken?.trim();
  if (!token) {
    throw new WidgetValidationError(
      "A linked Google account is required: connect Google on the Services page",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${GOOGLE_CALENDAR_API}${path}?${new URLSearchParams(params)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach Google Calendar");
  }

  const body = (await response.json().catch(() => null)) as {
    error?: { code: number; message?: string; errors?: { reason?: string }[] };
  } | null;

  if (response.ok && body) return body;

  const reason = body?.error?.errors?.[0]?.reason;
  if (reason === "rateLimitExceeded" || response.status === 429) {
    throw new WidgetRateLimitError("Google Calendar rate limit exceeded, try again shortly");
  }
  if (response.status === 401 || response.status === 403) {
    if (reason === "invalidCredentials" || reason === "authError") {
      throw new WidgetValidationError("Google Calendar access token expired or invalid — re-link your account");
    }
    throw new WidgetValidationError("Google Calendar access denied — check account permissions");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`Google Calendar responded with status ${response.status}`);
  }
  return body;
}

function toRfc3339(date: Date): string {
  return date.toISOString();
}

function boundLimit(value: number | undefined, def: number, max: number): number {
  const raw = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(raw) ? raw : def;
  return Math.min(Math.max(Math.trunc(safe), 1), max);
}

function boundDays(value: number | undefined, def: number, max: number): number {
  const raw = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(raw) ? raw : def;
  return Math.min(Math.max(Math.trunc(safe), 1), max);
}

export interface GcalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  htmlLink: string;
}

export interface GcalUpcomingParams {
  maxItems?: number;
  daysAhead?: number;
}

export interface GcalUpcomingResult {
  events: GcalEvent[];
  timeZone: string;
}

export async function fetchUpcomingEvents(
  params: GcalUpcomingParams,
  accessToken: string | undefined,
): Promise<GcalUpcomingResult> {
  const maxItems = boundLimit(params.maxItems, DEFAULT_MAX_ITEMS, MAX_MAX_ITEMS);
  const daysAhead = boundDays(params.daysAhead, DEFAULT_DAYS_AHEAD, MAX_DAYS_AHEAD);

  const now = new Date();
  const timeMin = toRfc3339(now);
  const timeMax = toRfc3339(new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000));

  const data = await calendarGet(
    "/calendars/primary/events",
    {
      timeMin,
      timeMax,
      maxResults: String(maxItems),
      singleEvents: "true",
      orderBy: "startTime",
      timeZone: "UTC",
    },
    accessToken,
  ) as { items?: GcalEvent[]; timeZone?: string };

  return {
    events: data.items ?? [],
    timeZone: data.timeZone ?? "UTC",
  };
}

export interface GcalTodayParams {
  maxItems?: number;
}

export interface GcalTodayResult {
  events: GcalEvent[];
  date: string; // YYYY-MM-DD in user's timezone
  timeZone: string;
}

export async function fetchTodayEvents(
  params: GcalTodayParams,
  accessToken: string | undefined,
): Promise<GcalTodayResult> {
  const maxItems = boundLimit(params.maxItems, DEFAULT_MAX_ITEMS, MAX_MAX_ITEMS);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const data = await calendarGet(
    "/calendars/primary/events",
    {
      timeMin: toRfc3339(startOfDay),
      timeMax: toRfc3339(endOfDay),
      maxResults: String(maxItems),
      singleEvents: "true",
      orderBy: "startTime",
      timeZone: "UTC",
    },
    accessToken,
  ) as { items?: GcalEvent[]; timeZone?: string };

  return {
    events: data.items ?? [],
    date: startOfDay.toISOString().split("T")[0],
    timeZone: data.timeZone ?? "UTC",
  };
}
