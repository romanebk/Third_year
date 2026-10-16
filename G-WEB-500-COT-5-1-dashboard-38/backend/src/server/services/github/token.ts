import { prisma } from "@/lib/db";
import { encryptToken } from "@/server/auth/token-encryption";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const FETCH_TIMEOUT_MS = 8000;
// Marge avant l'expiration réelle : un token rafraîchi juste avant d'expirer
// ne doit pas expirer entre ce contrôle et l'appel à l'API GitHub.
const EXPIRY_MARGIN_SECONDS = 60;

// L'OAuth App GitHub a "Expire user authorization tokens" activé : l'access
// token expire au bout de 8h (Account.expires_at) et un refresh_token est
// fourni. Sans rafraîchissement, tous les widgets GitHub retombaient
// silencieusement en anonyme au bout de 8h (données publiques seulement,
// github_security_alerts en échec) jusqu'à une nouvelle autorisation manuelle.
export function isGithubTokenExpired(expiresAt: number | null): boolean {
  if (expiresAt === null) return false; // token sans expiration (option désactivée)
  return expiresAt - EXPIRY_MARGIN_SECONDS <= Math.floor(Date.now() / 1000);
}

// Un refresh_token GitHub est à usage unique : deux rafraîchissements
// simultanés pour le même utilisateur (plusieurs widgets GitHub dont les
// timers tombent en même temps) invalideraient le second. Une seule promesse
// en vol par utilisateur, partagée par tous les appelants.
const inFlight = new Map<string, Promise<string | null>>();

export function refreshGithubAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const refresh = requestAndPersist(userId, refreshToken).finally(() => inFlight.delete(userId));
  inFlight.set(userId, refresh);
  return refresh;
}

// Renvoie le nouvel access token ; null si le serveur n'a pas les credentials
// GitHub, exception si GitHub refuse (refresh_token révoqué/expiré). Dans les
// deux cas l'appelant (cf. widgets/context.ts) garde l'ancien token, et les
// widgets publics retombent sur l'accès anonyme.
async function requestAndPersist(userId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  // GitHub répond 200 même en cas d'échec, avec un champ "error"
  // (ex: bad_refresh_token) au lieu d'access_token.
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
    error?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(`GitHub token refresh failed: ${data.error ?? `status ${response.status}`}`);
  }

  const now = Math.floor(Date.now() / 1000);
  await prisma.account.updateMany({
    where: { userId, provider: "github" },
    data: {
      access_token: encryptToken(data.access_token),
      ...(data.refresh_token ? { refresh_token: encryptToken(data.refresh_token) } : {}),
      expires_at: data.expires_in ? now + data.expires_in : null,
      refresh_token_expires_in: data.refresh_token_expires_in ?? null,
    },
  });

  return data.access_token;
}
