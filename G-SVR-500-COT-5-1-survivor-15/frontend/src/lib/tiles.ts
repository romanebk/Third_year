/**
 * Fonds de carte : Géoplateforme IGN uniquement.
 *
 * Le recours à OpenStreetMap et aux fonds de carte tiers n'est plus autorisé
 * (convention IGN, mail T. Vignal du 02/09/2026). Leaflet reste le client de
 * rendu : seule la source des tuiles change. CARTO a par ailleurs mis son CDN
 * gratuit derrière une clé API entre-temps, ce qui aurait de toute façon cassé
 * un repli vers ce fournisseur.
 *
 * Les tuiles passent par le proxy-cache du backend (/api/tiles/:layer/:z/:y/:x,
 * backend/src/modules/tiles/) plutôt que par un appel direct du navigateur vers
 * data.geopf.fr : exigence explicite (T. Vignal), le navigateur ne doit jamais
 * appeler un fournisseur externe directement. Sert aussi de mesure de charge
 * évitée (GET /api/tiles/stats, hit/miss).
 */

/** Options tuiles : moins d'annulations pendant zoom/pan (NS_BINDING_ABORTED dans Firefox). */
export const TILE_OPTS = {
  maxZoom: 19,
  updateWhenZooming: false,
  updateWhenIdle: true,
} as const;

function couche(layer: string): string {
  return `/api/tiles/${layer}/{z}/{y}/{x}`;
}

/** Plan IGN v2 : le fond de carte général du service. */
export const PLAN_IGN_URL = couche('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2');

/** Photographies aériennes : fond sombre pour les vignettes décoratives. */
export const ORTHO_IGN_URL = couche('ORTHOIMAGERY.ORTHOPHOTOS');

export const IGN_ATTRIBUTION =
  '&copy; <a href="https://www.ign.fr/">IGN</a>, Géoplateforme';

/**
 * Anciens noms conservés le temps que les composants soient renommés, pour ne pas
 * imposer un changement à tous les fichiers de carte en même temps.
 * @deprecated utiliser PLAN_IGN_URL, ORTHO_IGN_URL et IGN_ATTRIBUTION.
 */
export const VOYAGER_URL = PLAN_IGN_URL;
export const DARK_URL = ORTHO_IGN_URL;
export const OSM_ATTRIBUTION = IGN_ATTRIBUTION;
