// Limiteur par clé (adresse IP), en mémoire : suffisant pour une seule instance
// backend, sans stockage supplémentaire. Sert à freiner les envois en boucle sur
// les routes publiques qui déclenchent un email (contact, mot de passe oublié).
export interface RateLimiter {
  // true = la limite est atteinte, la requête doit être refusée (429).
  isLimited(key: string): boolean;
}

export function createRateLimiter(max: number, windowMs: number): RateLimiter {
  const recentByKey = new Map<string, number[]>();
  return {
    isLimited(key) {
      const now = Date.now();
      const recent = (recentByKey.get(key) ?? []).filter((time) => now - time < windowMs);
      if (recent.length >= max) {
        recentByKey.set(key, recent);
        return true;
      }
      recent.push(now);
      recentByKey.set(key, recent);
      return false;
    },
  };
}

// Adresse du client telle que transmise par le proxy frontend (cf.
// frontend/src/app/api/[...path]/route.ts).
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
