import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { getCachedTile, getTileCacheStats, setCachedTile, tileCacheKey } from './tiles.cache';

/**
 * Module Tuiles, cache serveur devant la Géoplateforme IGN.
 * feature/job-seeker, exigence T. Vignal (01/09/2026).
 *
 * Le front peut consommer ces tuiles directement depuis l'IGN (par défaut,
 * simple pour une démo autonome) ou via ce proxy pour bénéficier du cache et
 * réduire la charge sortante vers la Géoplateforme.
 */
const router = Router();

const WMTS_URL = 'https://data.geopf.fr/wmts';
const ALLOWED_LAYERS = new Set([
  'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
  'ORTHOIMAGERY.ORTHOPHOTOS',
]);

/**
 * GET /api/tiles/:layer/:z/:y/:x
 * Sert une tuile depuis le cache, ou la récupère depuis la Géoplateforme et la
 * met en cache pour les requêtes suivantes.
 */
router.get(
  '/:layer/:z/:y/:x',
  asyncHandler(async (req, res) => {
    const { layer, z, y, x } = req.params;

    if (!ALLOWED_LAYERS.has(layer)) {
      res.status(400).json({ error: 'Couche non autorisée' });
      return;
    }

    const key = tileCacheKey(layer, z, y, x);
    const cached = getCachedTile(key);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('X-Tile-Cache', 'HIT');
      res.send(cached.body);
      return;
    }

    const format = layer === 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2' ? 'image/png' : 'image/jpeg';
    const url =
      `${WMTS_URL}?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile` +
      `&LAYER=${layer}&STYLE=normal&FORMAT=${encodeURIComponent(format)}` +
      `&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;

    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: 'Géoplateforme indisponible' });
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') ?? format;
    setCachedTile(key, body, contentType);

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Tile-Cache', 'MISS');
    res.send(body);
  }),
);

/**
 * GET /api/tiles/stats
 * Exigence Vignal : le cache doit être mesuré (hit/miss).
 */
router.get('/stats', (_req, res) => {
  res.json(getTileCacheStats());
});

export default router;
