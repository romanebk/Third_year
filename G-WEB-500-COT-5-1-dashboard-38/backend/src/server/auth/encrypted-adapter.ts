import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { Account } from "next-auth";
import type { Adapter, AdapterAccount } from "next-auth/adapters";

import { prisma } from "@/lib/db";
import { encryptToken } from "@/server/auth/token-encryption";

// Enveloppe le PrismaAdapter standard pour chiffrer access_token/refresh_token avant
// écriture. linkAccount() est le seul point où NextAuth persiste un compte OAuth
// nouvellement lié — c'est le seul endroit à intercepter pour ce besoin.
//
// Seule autre écriture dans Account : refreshStoredAccountTokens() plus bas,
// qui chiffre de la même façon.
//
// Vérifié (audit de sécurité) contre @next-auth/prisma-adapter@1.0.7 :
// son PrismaAdapter n'expose que linkAccount/unlinkAccount comme écritures sur la
// table Account, pas de méthode "updateAccount" (ex: pour un refresh de token) dans
// cette version de NextAuth v4 — donc pas de trou actif aujourd'hui. Si une future
// version de next-auth/@next-auth/prisma-adapter ajoute un tel chemin d'écriture
// (ou si un code applicatif futur écrit directement dans Account, en bypassant cet
// adapter), il faudra l'intercepter ici aussi de la même façon, sous peine de
// tokens stockés en clair sans que ce fichier ne le signale.
export function createEncryptedPrismaAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    async linkAccount(account: AdapterAccount) {
      const encrypted: AdapterAccount = {
        ...account,
        access_token: account.access_token ? encryptToken(account.access_token) : account.access_token,
        refresh_token: account.refresh_token
          ? encryptToken(account.refresh_token)
          : account.refresh_token,
      };
      return base.linkAccount?.(encrypted);
    },
  };
}

// NextAuth n'écrit les tokens OAuth qu'à la toute première liaison
// (linkAccount) : une nouvelle autorisation d'un compte déjà lié (bouton
// "Reconnect" de /services, ou simple reconnexion via GitHub) jetait le token
// frais et gardait l'ancien en base — y compris son ancien scope, donc un
// compte lié avant l'ajout de security_events restait bloqué en 403 malgré
// la ré-autorisation. Appelé depuis events.signIn (cf. auth.ts) à chaque
// autorisation OAuth réussie ; sans effet si le compte n'existe pas encore.
export async function refreshStoredAccountTokens(account: Account): Promise<void> {
  if (account.type !== "oauth" || !account.access_token) return;

  await prisma.account.updateMany({
    where: { provider: account.provider, providerAccountId: account.providerAccountId },
    data: {
      access_token: encryptToken(account.access_token),
      // Un provider qui ne renvoie pas de refresh_token à la ré-autorisation
      // ne doit pas effacer celui déjà stocké.
      ...(account.refresh_token ? { refresh_token: encryptToken(account.refresh_token) } : {}),
      expires_at: account.expires_at ?? null,
      scope: account.scope ?? null,
      token_type: account.token_type ?? null,
    },
  });
}
