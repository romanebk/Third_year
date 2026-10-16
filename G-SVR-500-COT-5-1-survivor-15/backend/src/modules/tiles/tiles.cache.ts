/**
 * Cache mémoire des tuiles WMTS Géoplateforme IGN.
 *
 * Exigence T. Vignal (01/09/2026) : cache des tuiles côté serveur, mesuré
 * (hit/miss). Reste devant le flux quel que soit le fournisseur, comme demandé
 * lors de la migration IGN, seule la source des tuiles a changé, pas le cache.
 *
 * Volontairement en mémoire (pas de Redis) : un seul processus, un besoin de
 * démonstration. À remplacer par un cache partagé si l'application est répliquée.
 */

interface CachedTile {
  body: Buffer;
  contentType: string;
  cachedAt: number;
}

const MAX_ENTRIES = Number(process.env.TILE_CACHE_MAX_ENTRIES ?? 2000);
const TTL_MS = Number(process.env.TILE_CACHE_TTL_MS ?? 24 * 60 * 60 * 1000);

const cache = new Map<string, CachedTile>();
const stats = { hits: 0, misses: 0 };

export function tileCacheKey(layer: string, z: string, y: string, x: string): string {
  return `${layer}/${z}/${y}/${x}`;
}

export function getCachedTile(key: string): CachedTile | undefined {
  const entry = cache.get(key);
  if (!entry) {
    stats.misses++;
    return undefined;
  }
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key);
    stats.misses++;
    return undefined;
  }
  // Réinsertion pour approximer un LRU avec une Map (ordre d'insertion).
  cache.delete(key);
  cache.set(key, entry);
  stats.hits++;
  return entry;
}

export function setCachedTile(key: string, body: Buffer, contentType: string): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { body, contentType, cachedAt: Date.now() });
}

export function getTileCacheStats() {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total > 0 ? Number((stats.hits / total).toFixed(3)) : null,
    entries: cache.size,
    maxEntries: MAX_ENTRIES,
  };
}
