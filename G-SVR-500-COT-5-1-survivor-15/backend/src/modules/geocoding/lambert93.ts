/**
 * Conversion WGS84 (EPSG:4326) → Lambert-93 (EPSG:2154).
 *
 * Exigence T. Vignal (02/09/2026) : toute coordonnée exposée en administration ou
 * dans un export doit l'être en Lambert-93, en plus du WGS84 conservé en base.
 * La conversion se fait côté serveur, à la lecture, rien n'est stocké en double.
 *
 * Projection conique conforme de Lambert sécante (LCC 2SP) sur l'ellipsoïde GRS80.
 */

// Paramètres officiels de l'EPSG:2154
const A = 6378137.0; // demi-grand axe GRS80
const F = 1 / 298.257222101; // aplatissement GRS80
const E = Math.sqrt(2 * F - F * F); // première excentricité

const LAT_0 = deg(46.5); // latitude d'origine
const LON_0 = deg(3.0); // méridien d'origine
const LAT_1 = deg(44.0); // 1er parallèle standard
const LAT_2 = deg(49.0); // 2e parallèle standard
const X_0 = 700000.0;
const Y_0 = 6600000.0;

function deg(d: number): number {
  return (d * Math.PI) / 180;
}

/** Rayon parallèle isométrique. */
function m(lat: number): number {
  const s = Math.sin(lat);
  return Math.cos(lat) / Math.sqrt(1 - E * E * s * s);
}

/** Fonction isométrique de la latitude. */
function t(lat: number): number {
  const s = Math.sin(lat);
  return (
    Math.tan(Math.PI / 4 - lat / 2) / Math.pow((1 - E * s) / (1 + E * s), E / 2)
  );
}

// Constantes de la projection, calculées une fois au chargement du module.
const N =
  (Math.log(m(LAT_1)) - Math.log(m(LAT_2))) /
  (Math.log(t(LAT_1)) - Math.log(t(LAT_2)));
const BIG_F = m(LAT_1) / (N * Math.pow(t(LAT_1), N));
const RHO_0 = A * BIG_F * Math.pow(t(LAT_0), N);

export interface Lambert93Coordinates {
  /** Easting, en mètres. */
  x: number;
  /** Northing, en mètres. */
  y: number;
}

/**
 * Projette un couple latitude/longitude WGS84 en Lambert-93.
 * Les coordonnées sont arrondies au centimètre : au-delà, les décimales n'ont
 * plus de sens au regard de la précision du géocodage de l'API Adresse.
 */
export function wgs84ToLambert93(
  latitude: number,
  longitude: number,
): Lambert93Coordinates {
  const lat = deg(latitude);
  const lon = deg(longitude);

  const rho = A * BIG_F * Math.pow(t(lat), N);
  const theta = N * (lon - LON_0);

  return {
    x: round2(X_0 + rho * Math.sin(theta)),
    y: round2(Y_0 + RHO_0 - rho * Math.cos(theta)),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Distance orthodromique en mètres entre deux points WGS84 (formule de haversine).
 * Sert au relevé d'écarts de la procédure de reprise : de combien une offre a bougé.
 */
export function distanceInMeters(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const R = 6371008.8; // rayon terrestre moyen
  const dLat = deg(latB - latA);
  const dLon = deg(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg(latA)) * Math.cos(deg(latB)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}
