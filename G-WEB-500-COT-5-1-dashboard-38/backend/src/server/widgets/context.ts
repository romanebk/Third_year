import { prisma } from "@/lib/db";
import { decryptToken } from "@/server/auth/token-encryption";
import { resolveApiKeys } from "@/server/services/api-keys";
import { isGithubTokenExpired, refreshGithubAccessToken } from "@/server/services/github/token";
import type { WidgetFetchContext } from "@/server/widgets/data";

// Construit le contexte passé à chaque fetcher : les tokens tiers de l'utilisateur
// concerné, déchiffrés à la volée (jamais stockés en clair, cf. J2). Prend un
// userId plutôt que de lire la session : la route HTTP passe celui de la session,
// et le timer central (cf. src/server/timer/) celui de l'instance en base — il
// rafraîchit en dehors de toute requête, donc sans session à lire.
export async function buildWidgetFetchContextForUser(userId: string): Promise<WidgetFetchContext> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { provider: true, access_token: true, refresh_token: true, expires_at: true },
  });

  const accessTokens: Partial<Record<string, string>> = {};
  const refreshTokens: Partial<Record<string, string>> = {};
  for (const account of accounts) {
    // Un token illisible (clé de chiffrement changée, donnée corrompue) ne doit
    // jamais faire planter toute la requête — le widget concerné tombera juste
    // sur son erreur "compte non lié" comme si le token était absent.
    if (account.access_token) {
      try {
        accessTokens[account.provider] = decryptToken(account.access_token);
      } catch (error) {
        console.error(`[widgets] failed to decrypt ${account.provider} token:`, error);
      }
    }
    if (account.refresh_token) {
      try {
        refreshTokens[account.provider] = decryptToken(account.refresh_token);
      } catch (error) {
        console.error(`[widgets] failed to decrypt ${account.provider} refresh token:`, error);
      }
    }
  }

  await refreshExpiredGithubToken(userId, accounts, accessTokens, refreshTokens);

  return { accessTokens, apiKeys: await resolveApiKeys(userId) };
}

// Rafraîchit le token GitHub expiré avant l'appel (cf. services/github/
// token.ts) plutôt qu'après un 401 : githubGet retombe en anonyme sur un 401,
// ce qui masquerait l'expiration au lieu de la corriger. Un échec est loggé
// et laisse l'ancien token en place — même comportement qu'avant ce refresh.
async function refreshExpiredGithubToken(
  userId: string,
  accounts: { provider: string; expires_at: number | null }[],
  accessTokens: Partial<Record<string, string>>,
  refreshTokens: Partial<Record<string, string>>,
): Promise<void> {
  const github = accounts.find((account) => account.provider === "github");
  const refreshToken = refreshTokens.github;
  if (!github || !refreshToken || !isGithubTokenExpired(github.expires_at)) return;

  try {
    const fresh = await refreshGithubAccessToken(userId, refreshToken);
    if (fresh) accessTokens.github = fresh;
  } catch (error) {
    console.error(`[widgets] GitHub token refresh failed for user ${userId}:`, error);
  }
}
