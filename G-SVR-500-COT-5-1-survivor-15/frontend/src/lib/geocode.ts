/**
 * Géocodage côté client via l'API Adresse (Base Adresse Nationale).
 *
 * Seule source de géocodage autorisée depuis la convention IGN (mail T. Vignal
 * du 02/09/2026). Remplace les appels à Nominatim, qui n'est plus admis.
 *
 * Service public, ouvert, sans clé. Le backend fait le même appel côté serveur
 * pour les offres ; celui-ci sert uniquement au confort de saisie dans les
 * formulaires (pré-positionner un marqueur pendant que l'utilisateur tape).
 */

export interface AdresseResult {
  latitude: number;
  longitude: number;
  /** Adresse normalisée renvoyée par la BAN. */
  label: string;
  /** Score de confiance, entre 0 et 1. */
  score: number;
  /** Code INSEE de la commune, quand la BAN le renvoie. */
  cityCode: string | null;
  city: string | null;
}

const URL_BASE = 'https://api-adresse.data.gouv.fr/search/';

/** En deçà, l'adresse est considérée comme non résolue. */
export const SCORE_MINIMUM = 0.4;

/**
 * Cherche une adresse en France. Renvoie `null` quand rien n'est trouvé, que le
 * score est trop faible, ou que l'API est indisponible : au formulaire de
 * décider quoi afficher, jamais de position inventée.
 */
export async function chercherAdresse(
  requete: string,
  signal?: AbortSignal,
): Promise<AdresseResult | null> {
  const q = requete.trim();
  if (q.length < 3) return null;

  const url = new URL(URL_BASE);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '1');
  url.searchParams.set('autocomplete', '0');

  try {
    const reponse = await fetch(url, { signal });
    if (!reponse.ok) return null;

    const corps = (await reponse.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { label?: string; score?: number; citycode?: string; city?: string };
      }>;
    };

    const trouve = corps.features?.[0];
    const coordonnees = trouve?.geometry?.coordinates;
    if (!trouve || !coordonnees) return null;

    const [longitude, latitude] = coordonnees;
    const score = trouve.properties?.score ?? 0;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (score < SCORE_MINIMUM) return null;

    return {
      latitude,
      longitude,
      label: trouve.properties?.label ?? q,
      score,
      cityCode: trouve.properties?.citycode ?? null,
      city: trouve.properties?.city ?? null,
    };
  } catch {
    return null;
  }
}
