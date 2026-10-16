import {
  WidgetFetchError,
  WidgetRateLimitError,
  WidgetValidationError,
} from "@/server/widgets/errors";

const IPAPI_URL = "https://ipapi.co";
const FETCH_TIMEOUT_MS = 8000;

const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

async function ipapiGet(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${IPAPI_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new WidgetFetchError("could not reach ipapi.co");
  }

  const body = (await response.json().catch(() => null)) as {
    error?: boolean;
    reason?: string;
  } | null;

  if (response.status === 429 || body?.reason === "RateLimited") {
    throw new WidgetRateLimitError("ipapi.co rate limit exceeded, try again shortly");
  }
  if (body?.error && body.reason === "ReservedIPAddress") {
    throw new WidgetValidationError("this IP is reserved/private, cannot be geolocated");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`ipapi.co responded with status ${response.status}`);
  }
  return body;
}

export interface IpgeoCurrentParams {}

export interface IpgeoResult {
  ip: string;
  city: string | null;
  region: string | null;
  region_code: string | null;
  country_name: string | null;
  country_code: string | null;
  country_code_iso3: string | null;
  country_capital: string | null;
  country_tld: string | null;
  continent_code: string | null;
  in_eu: boolean;
  postal: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  utc_offset: string | null;
  country_calling_code: string | null;
  currency: string | null;
  currency_name: string | null;
  languages: string | null;
  country_area: number | null;
  country_population: number | null;
  asn: string | null;
  org: string | null;
}

export async function fetchCurrentIpgeo(
  _params: IpgeoCurrentParams,
  _accessToken: string | undefined,
): Promise<IpgeoResult> {
  const data = await ipapiGet("/json/") as IpgeoResult;
  return data;
}

export interface IpgeoLookupParams {
  ip: string;
}

export async function fetchIpgeoLookup(
  params: IpgeoLookupParams,
  _accessToken: string | undefined,
): Promise<IpgeoResult> {
  const ip = params.ip?.trim();
  if (!ip || !IP_REGEX.test(ip)) {
    throw new WidgetValidationError("ip must be a valid IPv4 address (e.g. 8.8.8.8)");
  }
  const data = await ipapiGet(`/${ip}/json/`) as IpgeoResult;
  return data;
}
