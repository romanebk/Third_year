import { WidgetFetchError, WidgetValidationError } from "@/server/widgets/errors";

// Même raisonnement que weather/steam/github/crypto : sans timeout explicite,
// un fetch() qui ne reçoit jamais de réponse bloque la requête entrante avec lui.
const FETCH_TIMEOUT_MS = 8000;
const NOMINATIM_API = "https://nominatim.openstreetmap.org";
const OSRM_API = "https://router.project-osrm.org";

// La politique d'usage de Nominatim (service de géocodage gratuit
// d'OpenStreetMap, aucune clé requise) exige un User-Agent identifiant
// l'application — sans ça, les requêtes peuvent être bloquées.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_HEADERS = { "User-Agent": "HubblyDashboard/1.0 (Epitech project)" };

interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

async function geocodeAddress(address: string): Promise<GeocodeResult> {
  let response: Response;
  try {
    response = await fetch(
      `${NOMINATIM_API}/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the geocoding service");
  }

  if (!response.ok) {
    throw new WidgetFetchError(`geocoding service responded with status ${response.status}`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  const first = results[0];
  if (!first) {
    // Une adresse introuvable est déterministe (le paramètre configuré ne
    // correspond à rien), pas une panne transitoire — cf. le même choix pour
    // "unknown city" côté weather/fetch.ts.
    throw new WidgetValidationError(`address not found: ${address}`);
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    displayName: first.display_name,
  };
}

export interface MapLocationParams {
  address: string;
  zoom?: number;
}

export interface MapLocationResult {
  address: string;
  displayName: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

export async function fetchMapLocation({
  address,
  zoom,
}: MapLocationParams): Promise<MapLocationResult> {
  if (!address?.trim()) throw new WidgetValidationError("address is required");
  // OpenStreetMap va de 0 (monde entier) à 19 (bâtiment) — borné à une plage
  // qui reste lisible pour un petit widget dashboard (3 = région, 18 = rue).
  const boundedZoom = Math.min(Math.max(Math.trunc(zoom ?? 14), 3), 18);

  const { latitude, longitude, displayName } = await geocodeAddress(address);

  return { address, displayName, latitude, longitude, zoom: boundedZoom };
}

export interface MapDistanceParams {
  origin: string;
  destination: string;
}

export interface MapDistanceResult {
  origin: string;
  originDisplayName: string;
  destination: string;
  destinationDisplayName: string;
  distanceKm: number;
  durationMinutes: number;
}

export async function fetchMapDistance({
  origin,
  destination,
}: MapDistanceParams): Promise<MapDistanceResult> {
  if (!origin?.trim()) throw new WidgetValidationError("origin is required");
  if (!destination?.trim()) throw new WidgetValidationError("destination is required");

  const [from, to] = await Promise.all([geocodeAddress(origin), geocodeAddress(destination)]);

  let response: Response;
  try {
    // Serveur de démo public OSRM (aucune clé) — trajet routier, pas à vol
    // d'oiseau. Suffisant pour un widget dashboard, pas garanti pour un usage
    // en production à fort trafic (limite de débit non documentée).
    response = await fetch(
      `${OSRM_API}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
  } catch {
    throw new WidgetFetchError("could not reach the routing service");
  }

  if (!response.ok) {
    throw new WidgetFetchError(`routing service responded with status ${response.status}`);
  }

  const data = (await response.json()) as {
    code: string;
    routes?: Array<{ distance: number; duration: number }>;
  };
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) {
    throw new WidgetValidationError("no route found between these two addresses");
  }

  return {
    origin,
    originDisplayName: from.displayName,
    destination,
    destinationDisplayName: to.displayName,
    distanceKm: route.distance / 1000,
    durationMinutes: route.duration / 60,
  };
}
