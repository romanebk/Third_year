"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { CheckIcon } from "@/components/icons";
import { serviceTheme } from "@/lib/service-theme";
import type { ServiceInfo } from "@/types";

// Liaison d'un compte tiers (GitHub) à l'utilisateur déjà connecté,
// quelle que soit la façon dont il a créé son compte Hubly (email, Google...).
// Le backend fait le vrai travail : un signIn OAuth lancé avec une session
// ouverte rattache le compte tiers à CET utilisateur (cf. callback signIn de
// backend/src/server/auth/auth.ts) au lieu d'ouvrir une nouvelle session.

// Paramètres d'URL du retour de consentement : connect=<service> (succès, posé
// par le callbackUrl ci-dessous) ou link_error=<code NextAuth ou applicatif>.
export const CONNECT_PARAM = "connect";
export const LINK_ERROR_PARAM = "link_error";

const LINK_ERRORS: Record<string, string> = {
  AccountLinkedElsewhere:
    "This account is already linked to another Hubly user. Sign in with it, or unlink it there first.",
  OAuthAccountNotLinked: "This account is already linked to another Hubly user.",
  AccessDenied: "Authorization was denied — the account was not linked.",
  OAuthCallback: "Authorization was cancelled or the provider returned an invalid response.",
  OAuthSignin: "Could not start the authorization. Please try again.",
  Configuration: "This provider is not configured on the server.",
};
const DEFAULT_LINK_ERROR = "Could not link this account. Please try again.";

export function linkErrorMessage(code: string): string {
  return LINK_ERRORS[code] ?? DEFAULT_LINK_ERROR;
}

// Un service OAuth dont le provider est configuré mais pas encore lié passe
// par le consentement avant la souscription ; non configuré (credentials
// absents côté serveur), il reste souscriptible sans liaison — les widgets
// publics (profil/commits GitHub) fonctionnent sans compte lié.
export function needsOAuthLink(service: ServiceInfo): boolean {
  return service.auth === "oauth" && Boolean(service.oauth?.configured) && !service.oauth?.linked;
}

// Redirige vers le consentement du provider. Au retour, /services?connect=<name>
// souscrit le service (cf. ServicesManager) — la souscription n'est jamais
// posée avant que l'autorisation ait réellement abouti. Le provider peut
// différer du nom du service (google-calendar partage le provider "google",
// cf. oauth.provider renvoyé par GET /api/services).
export function startOAuthLink(serviceName: string, providerId?: string): Promise<unknown> {
  return signIn(providerId ?? serviceName, { callbackUrl: `/services?${CONNECT_PARAM}=${serviceName}` });
}

// DELETE /api/services/[name]/link : renvoie null si délié, sinon le message
// d'erreur à afficher (ex: 409 "only sign-in method").
async function unlinkAccount(serviceName: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/services/${serviceName}/link`, { method: "DELETE", credentials: "include" });
    if (response.ok) return null;
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    return body?.error ?? "Could not unlink this account. Please try again.";
  } catch {
    return "Could not unlink this account. Please try again.";
  }
}

const LINK_ACTION_CLASS =
  "cursor-pointer text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50";

export function OAuthLinkStatus({
  service,
  onUnlinked,
  onError,
}: {
  service: ServiceInfo;
  onUnlinked: (serviceName: string) => void;
  onError: (message: string) => void;
}) {
  const [unlinking, setUnlinking] = useState(false);
  if (service.auth !== "oauth" || !service.oauth) return null;
  const { configured, linked, provider } = service.oauth;
  const label = serviceTheme(service.name).label;

  async function handleUnlink() {
    const confirmed = window.confirm(
      `Unlink your ${label} account? Widgets that need it will stop showing your private data.`,
    );
    if (!confirmed) return;
    setUnlinking(true);
    const error = await unlinkAccount(service.name);
    setUnlinking(false);
    if (error) onError(error);
    else onUnlinked(service.name);
  }

  if (!configured) {
    return (
      <p className="px-5 pt-3 text-xs text-muted-foreground">
        {label} account linking is not configured on this server.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-5 pt-3 text-xs">
      {linked ? (
        <span className="flex items-center gap-1 text-foreground">
          <CheckIcon className="size-3" />
          {label} account linked
        </span>
      ) : (
        <span className="text-muted-foreground">No {label} account linked</span>
      )}
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void startOAuthLink(service.name, provider)}
          className={LINK_ACTION_CLASS}
        >
          {linked ? "Re-authorize" : "Link account"}
        </button>
        {linked ? (
          <button
            type="button"
            onClick={() => void handleUnlink()}
            disabled={unlinking}
            className={LINK_ACTION_CLASS}
          >
            {unlinking ? "Unlinking…" : "Unlink"}
          </button>
        ) : null}
      </span>
    </div>
  );
}
