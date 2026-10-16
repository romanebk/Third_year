/**
 * Client de l'API Adresse (api-adresse.data.gouv.fr).
 *
 * Seule source de géocodage autorisée depuis la convention IGN (mail T. Vignal,
 * 02/09/2026). Service ouvert, sans clé, mais pas illimité : le débit est bridé
 * ici et les réponses 429 / 5xx sont réessayées avec un délai croissant.
 */

const BASE_URL =
  process.env.GEOCODING_API_URL ?? 'https://api-adresse.data.gouv.fr/search/';

/** Débit sortant. L'API tolère davantage, on reste volontairement en dessous. */
const REQUEST_INTERVAL_MS = Number(process.env.GEOCODING_INTERVAL_MS ?? 120);

/** Nombre de tentatives par adresse avant de la déclarer en échec. */
const MAX_ATTEMPTS = Number(process.env.GEOCODING_MAX_ATTEMPTS ?? 4);

/** En dessous de ce score, l'API a répondu mais sans conviction : à vérifier. */
export const MIN_CONFIDENCE_SCORE = Number(
  process.env.GEOCODING_MIN_SCORE ?? 0.4,
);

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  /** Score de confiance renvoyé par l'API, entre 0 et 1. */
  score: number;
  /** Libellé d'adresse normalisé renvoyé par l'API. */
  label: string;
  /** Code INSEE de la commune, quand l'API le renvoie. */
  cityCode?: string;
  city?: string;
}

export class GeocodingError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'GeocodingError';
  }
}

let nextSlot = 0;

/** Espace les appels sortants pour ne pas se faire couper par l'API. */
async function waitForSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + REQUEST_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Géocode une adresse. Renvoie `null` quand l'API répond correctement mais ne
 * trouve aucun résultat, ce n'est pas une erreur, c'est une adresse à vérifier
 * à la main. Lève une GeocodingError quand l'API elle-même est indisponible.
 */
export async function geocodeAddress(
  query: string,
  options: { postcode?: string; cityCode?: string } = {},
): Promise<GeocodingResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    // L'API rejette les requêtes trop courtes : inutile de la solliciter.
    return null;
  }

  const url = new URL(BASE_URL);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', '1');
  url.searchParams.set('autocomplete', '0');
  if (options.postcode) url.searchParams.set('postcode', options.postcode);
  if (options.cityCode) url.searchParams.set('citycode', options.cityCode);

  let lastError: GeocodingError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await waitForSlot();

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 429 || response.status >= 500) {
        throw new GeocodingError(
          `API Adresse indisponible (HTTP ${response.status})`,
          true,
        );
      }
      if (!response.ok) {
        throw new GeocodingError(
          `Requête refusée par l'API Adresse (HTTP ${response.status})`,
          false,
        );
      }

      const body = (await response.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
          properties?: {
            score?: number;
            label?: string;
            citycode?: string;
            city?: string;
          };
        }>;
      };

      const feature = body.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!feature || !coordinates) return null;

      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

      return {
        latitude,
        longitude,
        score: feature.properties?.score ?? 0,
        label: feature.properties?.label ?? trimmed,
        cityCode: feature.properties?.citycode,
        city: feature.properties?.city,
      };
    } catch (error) {
      const geocodingError =
        error instanceof GeocodingError
          ? error
          : new GeocodingError(
              `Appel à l'API Adresse impossible : ${(error as Error).message}`,
              true,
            );

      if (!geocodingError.retryable || attempt === MAX_ATTEMPTS) {
        throw geocodingError;
      }

      lastError = geocodingError;
      // Attente croissante : 1s, 2s, 4s… le temps que l'API respire.
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }

  throw lastError ?? new GeocodingError('Géocodage impossible', true);
}

/**
 * Forme historique du résultat, conservée pour le module offres qui la consomme
 * déjà (`GeocodeResult`). Cet alias permet de remplacer l'adaptateur intérimaire
 * `modules/offers/geocoding.ts` sans toucher aux appelants.
 */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
  score: number;
  citycode: string | null;
  city: string | null;
  source: 'api-adresse';
  geocodedAt: string;
}

const COMMUNES_API_URL =
  process.env.COMMUNES_API_URL ?? 'https://geo.api.gouv.fr/communes';

/**
 * Centroïde officiel d'une commune (API Découpage administratif, geo.api.gouv.fr).
 * Renvoie `null` si le code INSEE est inconnu de l'API.
 */
async function communeCentroid(
  citycode: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const url = `${COMMUNES_API_URL}/${citycode}?fields=centre`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const body = (await response.json()) as {
    centre?: { coordinates?: [number, number] };
  };
  const coordinates = body.centre?.coordinates;
  if (!coordinates) return null;

  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Géocode une adresse et renvoie la forme attendue par le module offres.
 *
 * Précision retenue : la commune, jamais l'adresse (point 3.2 du cahier des
 * charges, confirmé par Florine Pontaillac le 8 septembre 2026, retour à la
 * v1.0). L'adresse saisie sert uniquement à identifier la commune concernée
 * (via son code INSEE) ; les coordonnées enregistrées sont celles du
 * centroïde officiel de cette commune, jamais celles de l'adresse exacte.
 *
 * Renvoie `null` si l'adresse n'est pas résolue, si le score est sous le
 * seuil, ou si le centroïde de la commune est introuvable, afin que
 * l'appelant refuse la publication plutôt que de stocker une position dont
 * il ne peut rien dire.
 */
export async function geocodeForOffer(query: string): Promise<GeocodeResult | null> {
  const result = await geocodeAddress(query);
  if (!result || result.score < MIN_CONFIDENCE_SCORE || !result.cityCode) return null;

  const centroid = await communeCentroid(result.cityCode);
  if (!centroid) return null;

  return {
    latitude: centroid.latitude,
    longitude: centroid.longitude,
    label: result.city ?? result.label,
    score: result.score,
    citycode: result.cityCode,
    city: result.city ?? null,
    source: 'api-adresse',
    geocodedAt: new Date().toISOString(),
  };
}
