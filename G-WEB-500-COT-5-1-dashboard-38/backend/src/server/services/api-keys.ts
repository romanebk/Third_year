import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/server/auth/token-encryption";

// Services "apikey" : l'utilisateur fournit sa propre clé en connectant le
// service (page Services), stockée chiffrée sur sa souscription — comme les
// tokens OAuth, jamais en clair. Une clé serveur (variable d'environnement) est
// un repli optionnel : quand elle existe, personne n'a besoin de saisir la
// sienne. Aucune clé n'est donc nécessaire dans le dépôt pour que ces services
// fonctionnent sur un clone neuf.
const SERVER_KEY_ENV: Record<string, string> = {
  steam: "STEAM_API_KEY",
  youtube: "YOUTUBE_API_KEY",
};

const VERIFY_TIMEOUT_MS = 8000;
// Largement au-dessus des clés réelles (Steam : 32 caractères, Google : 39).
const MAX_KEY_LENGTH = 200;

export class ApiKeyError extends Error {
  // 400 : clé refusée par le service (faute de l'utilisateur) ; 502 : le
  // service n'a pas pu être joint, la clé n'a pas été vérifiée.
  constructor(
    message: string,
    public readonly status: 400 | 502,
  ) {
    super(message);
  }
}

export function usesApiKey(service: string): boolean {
  return Object.hasOwn(SERVER_KEY_ENV, service);
}

export function serverApiKey(service: string): string | undefined {
  const envName = SERVER_KEY_ENV[service];
  return (envName && process.env[envName]?.trim()) || undefined;
}

export function encryptApiKey(key: string): string {
  return encryptToken(key);
}

// Clé à utiliser par service pour un utilisateur : la sienne si elle existe,
// sinon celle du serveur. Une clé illisible (clé de chiffrement changée) est
// ignorée — le widget retombe sur "clé manquante" au lieu de planter.
export async function resolveApiKeys(userId: string): Promise<Partial<Record<string, string>>> {
  const keys: Partial<Record<string, string>> = {};
  for (const service of Object.keys(SERVER_KEY_ENV)) {
    const fromServer = serverApiKey(service);
    if (fromServer) keys[service] = fromServer;
  }

  const subscriptions = await prisma.serviceSubscription.findMany({
    where: { userId, apiKey: { not: null } },
    select: { service: true, apiKey: true },
  });
  for (const subscription of subscriptions) {
    if (!subscription.apiKey) continue;
    try {
      keys[subscription.service] = decryptToken(subscription.apiKey);
    } catch (error) {
      console.error(`[api-keys] failed to decrypt the ${subscription.service} key of user ${userId}:`, error);
    }
  }
  return keys;
}

// Appel le moins coûteux de chaque API pour savoir si la clé est acceptée :
// Steam répond 403 à une clé inconnue, YouTube 400 (1 unité de quota).
const VERIFY_URL: Record<string, (key: string) => string> = {
  steam: (key) =>
    `https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v1/?key=${encodeURIComponent(key)}`,
  youtube: (key) =>
    `https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${encodeURIComponent(key)}`,
};

// Vérifie une clé auprès du service avant de l'enregistrer : l'utilisateur
// apprend tout de suite qu'elle est fausse, au lieu de découvrir des widgets en
// erreur plus tard. Lève ApiKeyError (message affichable tel quel).
export async function verifyApiKey(service: string, key: string): Promise<void> {
  if (!key || key.length > MAX_KEY_LENGTH || /\s/.test(key)) {
    throw new ApiKeyError("This API key is not valid", 400);
  }

  let response: Response;
  try {
    response = await fetch(VERIFY_URL[service](key), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch {
    throw new ApiKeyError("Could not reach the service to check your key. Please try again.", 502);
  }

  if (response.ok) return;
  if (response.status >= 500) {
    throw new ApiKeyError("The service could not check your key right now. Please try again.", 502);
  }
  if (response.status === 429) {
    throw new ApiKeyError("This key has reached its quota. Try again later or use another key.", 400);
  }
  throw new ApiKeyError("This API key was rejected by the service. Check that you copied it entirely and that the API is enabled for it.", 400);
}
