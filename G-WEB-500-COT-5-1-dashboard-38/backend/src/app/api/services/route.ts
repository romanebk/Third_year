import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authOptions, isOAuthProviderConfigured } from "@/server/auth/auth";
import { services, oauthProviderIdForService, isAccountLinkUsable } from "@/server/services";
import { serverApiKey, usesApiKey } from "@/server/services/api-keys";
import { minRefreshRateSeconds } from "@/server/services/refresh-rates";

// GET /api/services — liste des services supportés + l'état de souscription de
// l'utilisateur connecté pour chacun (source de vérité serveur, cf.
// ServiceSubscription — remplace l'ancienne préférence purement localStorage).
export async function GET() {
  const session = await getServerSession(authOptions);

  let subscribedNames = new Set<string>();
  let savedApiKeys = new Set<string>();
  let linkedProviders = new Set<string>();
  if (session?.user?.id) {
    const [subscriptions, accounts] = await Promise.all([
      prisma.serviceSubscription.findMany({
        where: { userId: session.user.id },
        select: { service: true, apiKey: true },
      }),
      prisma.account.findMany({
        where: { userId: session.user.id },
        select: { provider: true, access_token: true },
      }),
    ]);
    subscribedNames = new Set(subscriptions.map((r) => r.service));
    // Seule l'existence d'une clé est exposée, jamais sa valeur.
    savedApiKeys = new Set(subscriptions.filter((r) => r.apiKey).map((r) => r.service));
    // Lié = ligne Account présente ET token déchiffrable : une ligne périmée
    // (secrets régénérés) ne doit pas court-circuiter le consentement.
    linkedProviders = new Set(
      accounts.filter(isAccountLinkUsable).map((a) => a.provider),
    );
  }

  const withStatus = services.map((service) => ({
    ...service,
    // "none" n'exige pas de souscription explicite : toujours vrai, mais
    // seulement pour un utilisateur réellement connecté — sans session, il
    // n'y a personne à qui attribuer un "subscribed:true", et laisser passer
    // ça sans vérifier session?.user?.id rendait ce champ trompeur pour un
    // appel anonyme (cf. isSubscribed() côté serveur, qui fait la même
    // distinction).
    subscribed: Boolean(session?.user?.id) && (service.auth === "none" || subscribedNames.has(service.name)),
    // Plancher de refreshRateSeconds imposé par POST/PATCH /api/dashboard —
    // exposé pour que les formulaires l'affichent au lieu de le découvrir en 400.
    minRefreshRateSeconds: minRefreshRateSeconds(service.name),
    // Services "oauth" : le provider NextAuth peut différer du nom du service
    // (google-calendar partage le provider "google", cf.
    // oauthProviderIdForService) ; configured = credentials présents côté
    // serveur ; linked = l'utilisateur a autorisé ce compte tiers (ligne
    // Account du provider), quelle que soit la façon dont il a créé son
    // compte Hubly.
    ...(service.auth === "oauth"
      ? {
          oauth: {
            configured: isOAuthProviderConfigured(oauthProviderIdForService(service.name)),
            linked: linkedProviders.has(oauthProviderIdForService(service.name)),
            provider: oauthProviderIdForService(service.name),
          },
        }
      : {}),
    // Services à clé d'API : required = le serveur n'a pas de clé, l'utilisateur
    // doit fournir la sienne pour se connecter ; saved = il en a enregistré une.
    ...(usesApiKey(service.name)
      ? {
          apiKey: {
            required: !serverApiKey(service.name),
            saved: savedApiKeys.has(service.name),
          },
        }
      : {}),
  }));

  return NextResponse.json({ services: withStatus });
}