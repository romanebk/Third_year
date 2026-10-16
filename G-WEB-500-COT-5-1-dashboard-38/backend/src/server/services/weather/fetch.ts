import { WidgetFetchError, WidgetValidationError } from "@/server/widgets/errors";

// Sans timeout explicite, un fetch() qui ne reçoit jamais de réponse (réseau
// capricieux, service distant qui ne répond plus) reste en attente
// indéfiniment — la requête HTTP entrante (et donc l'utilisateur) reste
// bloquée avec elle. 8s : largement au-dessus d'un temps de réponse normal
// pour ces APIs, largement en dessous d'un blocage perçu comme un bug.
const FETCH_TIMEOUT_MS = 8000;

// Politique d'usage de Nominatim (géocodage gratuit d'OpenStreetMap) : un
// User-Agent identifiant l'application est requis, surtout pour le reverse
// (coordonnées -> ville) déclenché par l'auto-détection de la localisation.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_API = "https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS = { "User-Agent": "HubblyDashboard/1.0 (Epitech project)" };

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

async function geocodeCity(city: string): Promise<GeocodeResult> {
  let response: Response;
  try {
    response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the geocoding service");
  }

  if (!response.ok) {
    throw new WidgetFetchError(`geocoding service responded with status ${response.status}`);
  }

  const data = (await response.json()) as { results?: { latitude: number; longitude: number }[] };
  const first = data.results?.[0];
  if (!first) {
    // Une ville introuvable est déterministe (le paramètre configuré ne correspond
    // à rien), pas une panne transitoire de l'API — c'est un problème de config,
    // donc WidgetValidationError (400), pas WidgetFetchError générique (502).
    throw new WidgetValidationError(`unknown city: ${city}`);
  }

  return { latitude: first.latitude, longitude: first.longitude };
}

// Reverse geocoding Nominatim : les coordonnées du navigateur (geolocation API)
// donnent la ville la plus proche — utilisée par la validation de settings-locate
// pour PATCHer weatherCity sans forcer l'utilisateur à taper une ville à la main.
export async function reverseGeocodeCity(latitude: number, longitude: number): Promise<string> {
  let response: Response;
  try {
    response = await fetch(
      `${NOMINATIM_API}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`,
      { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the geocoding service");
  }

  if (!response.ok) {
    throw new WidgetFetchError(`geocoding service responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    address?: Partial<Record<"city" | "town" | "village" | "municipality" | "county" | "state", string>>;
  };
  const address = data.address ?? {};
  // Une petite commune sans "city" tombe sur town/village ; un coin rural sur
  // municipality/county — on prend le premier niveau administratif disponible.
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    address.state;
  if (!city) {
    throw new WidgetValidationError("could not determine a city for these coordinates");
  }
  return city;
}

export interface CityCurrentParams {
  city: string;
  unit?: string;
}

export interface CityCurrentResult {
  city: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  weatherCode: number;
  isDay: boolean;
  // Détails affichés sous la température (ressenti, humidité, vent) et
  // max/min du jour, lus dans la même requête Open-Meteo.
  apparentTemperature: number;
  humidity: number;
  windKmh: number;
  todayMax: number | null;
  todayMin: number | null;
}

export async function fetchCityCurrent({ city, unit }: CityCurrentParams): Promise<CityCurrentResult> {
  if (!city?.trim()) throw new WidgetValidationError("city is required");
  // Ne jamais transmettre tel quel un paramètre utilisateur à l'API externe : une
  // valeur inattendue (ex: unit="xyz") ferait échouer l'appel upstream avec une
  // erreur peu lisible plutôt qu'un message clair côté widget.
  const temperatureUnit = unit === "fahrenheit" ? "fahrenheit" : "celsius";

  const { latitude, longitude } = await geocodeCity(city);

  let response: Response;
  try {
    response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&temperature_unit=${temperatureUnit}&timezone=auto`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the weather service");
  }

  if (!response.ok) {
    throw new WidgetFetchError(`weather service responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    current?: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
      is_day?: number;
    };
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
  };
  if (data.current === undefined) {
    throw new WidgetFetchError("unexpected response from weather service");
  }

  return {
    city,
    temperature: data.current.temperature_2m,
    unit: temperatureUnit,
    weatherCode: data.current.weather_code,
    isDay: data.current.is_day === 1,
    apparentTemperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windKmh: data.current.wind_speed_10m,
    todayMax: data.daily?.temperature_2m_max?.[0] ?? null,
    todayMin: data.daily?.temperature_2m_min?.[0] ?? null,
  };
}

export interface CityForecastParams {
  city: string;
  days?: number;
  unit?: string;
}

export interface CityForecastDay {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  // Condition dominante de la journée (cf. dominantDaytimeCodes), et non le
  // weather_code journalier d'Open-Meteo qui retient le phénomène le plus
  // fort : une heure de bruine suffisait à afficher "Light drizzle" pour une
  // journée ensoleillée.
  weatherCode: number;
  precipitationChance: number | null;
  humidityMax: number;
  windMaxKmh: number;
  apparentMax: number;
  pressureHpa: number;
}

export interface CityForecastResult {
  city: string;
  days: CityForecastDay[];
  aqi?: number | null;
  // Conditions actuelles (même source que weather_city_current) : "Today"
  // affiche le temps qu'il fait maintenant, cohérent avec Current weather.
  current?: { temperature: number; weatherCode: number; isDay: boolean } | null;
}

// Heures prises en compte pour la condition d'une journée (heure locale de la
// ville, grâce à timezone=auto) : la nuit ne doit pas décider du temps du jour.
const DAYTIME_FIRST_HOUR = 6;
const DAYTIME_LAST_HOUR = 21;

// Code météo le plus fréquent en journée, par date ("YYYY-MM-DD"). À égalité,
// le plus marqué l'emporte (les codes WMO croissent avec l'intensité).
function dominantDaytimeCodes(times: string[], codes: number[]): Map<string, number> {
  const counts = new Map<string, Map<number, number>>();
  times.forEach((time, i) => {
    const hour = Number(time.slice(11, 13));
    const code = codes[i];
    if (hour < DAYTIME_FIRST_HOUR || hour > DAYTIME_LAST_HOUR || typeof code !== "number") return;
    const date = time.slice(0, 10);
    const perDay = counts.get(date) ?? new Map<number, number>();
    perDay.set(code, (perDay.get(code) ?? 0) + 1);
    counts.set(date, perDay);
  });

  const dominant = new Map<string, number>();
  for (const [date, perDay] of counts) {
    let best: { code: number; count: number } | null = null;
    for (const [code, count] of perDay) {
      if (!best || count > best.count || (count === best.count && code > best.code)) best = { code, count };
    }
    if (best) dominant.set(date, best.code);
  }
  return dominant;
}

export async function fetchCityForecast({
  city,
  days,
  unit,
}: CityForecastParams): Promise<CityForecastResult> {
  if (!city?.trim()) throw new WidgetValidationError("city is required");
  // Open-Meteo accepte 1 à 16 jours — on borne plutôt que de laisser l'API externe
  // rejeter une valeur hors plage avec une erreur peu lisible.
  const forecastDays = Math.min(Math.max(Math.trunc(days ?? 7), 1), 16);
  const temperatureUnit = unit === "fahrenheit" ? "fahrenheit" : "celsius";

  const { latitude, longitude } = await geocodeCity(city);

  // Prévision et qualité de l'air ne dépendent toutes les deux que de
  // latitude/longitude : lancées en parallèle (au lieu de l'air en séquence
  // après la prévision) pour ne pas cumuler deux timeouts de 8s à la suite,
  // la cause la plus probable des échecs intermittents signalés sur ce widget.
  const [forecastResult, aqiResult] = await Promise.allSettled([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&hourly=weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max,apparent_temperature_max,surface_pressure_max&forecast_days=${forecastDays}&temperature_unit=${temperatureUnit}&timezone=auto`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    ),
  ]);

  if (forecastResult.status === "rejected") {
    throw new WidgetFetchError("could not reach the weather service");
  }
  const response = forecastResult.value;
  if (!response.ok) {
    throw new WidgetFetchError(`weather service responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    daily?: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weather_code: number[];
      precipitation_probability_max?: (number | null)[];
      relative_humidity_2m_max: number[];
      wind_speed_10m_max: number[];
      apparent_temperature_max: number[];
      surface_pressure_max: number[];
    };
    hourly?: { time: string[]; weather_code: number[] };
    current?: { temperature_2m: number; weather_code: number; is_day?: number };
  };
  if (data.daily === undefined) {
    throw new WidgetFetchError("unexpected response from weather service");
  }

  const daily = data.daily;
  const dominant = data.hourly
    ? dominantDaytimeCodes(data.hourly.time, data.hourly.weather_code)
    : new Map<string, number>();
  const forecast = daily.time.map((date, i) => ({
    date,
    temperatureMax: daily.temperature_2m_max[i],
    temperatureMin: daily.temperature_2m_min[i],
    weatherCode: dominant.get(date) ?? daily.weather_code[i],
    precipitationChance: daily.precipitation_probability_max?.[i] ?? null,
    humidityMax: daily.relative_humidity_2m_max[i],
    windMaxKmh: daily.wind_speed_10m_max[i],
    apparentMax: daily.apparent_temperature_max[i],
    pressureHpa: daily.surface_pressure_max[i],
  }));

  // Indice de qualité de l'air US *actuel* (pas une prévision par jour : le
  // front ne l'affiche que pour aujourd'hui) — best effort : un échec de ce
  // service ne doit pas faire échouer toute la prévision.
  let aqi: number | null = null;
  try {
    if (aqiResult.status === "fulfilled" && aqiResult.value.ok) {
      const aqiData = (await aqiResult.value.json()) as { current?: { us_aqi?: number | null } };
      aqi = aqiData.current?.us_aqi ?? null;
    }
  } catch {
    // best effort : pas d'indicateur si le service AQI est indisponible
  }

  const current = data.current
    ? {
        temperature: data.current.temperature_2m,
        weatherCode: data.current.weather_code,
        isDay: data.current.is_day === 1,
      }
    : null;

  return { city, days: forecast, aqi, current };
}
