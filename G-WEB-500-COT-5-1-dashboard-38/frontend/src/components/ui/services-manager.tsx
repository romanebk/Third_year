"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { SpinnerIcon } from "@/components/icons";
import { ServiceCard } from "@/components/ui/service-card";
import {
  CONNECT_PARAM,
  LINK_ERROR_PARAM,
  linkErrorMessage,
  needsOAuthLink,
  startOAuthLink,
} from "@/components/ui/service-oauth";
import { serviceTheme } from "@/lib/service-theme";
import { cn } from "@/lib/utils";
import type { ServiceInfo } from "@/types";

type Filter = "all" | "subscribed";

type LinkFeedback = { type: "success" | "error"; message: string } | undefined;

export default function ServicesManager() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  // Formulaire d'ajout ouvert ("service/widget") : un seul à la fois.
  const [openWidget, setOpenWidget] = useState<string | undefined>(undefined);
  // Pending : évite de spammer le bouton pendant l'aller-retour serveur, pas une
  // question d'UX seulement — la souscription est maintenant la vraie source de
  // vérité (ServiceSubscription en base), plus une préférence locale qu'on pouvait
  // togglee sans risque de désynchronisation.
  const [pending, setPending] = useState<string | undefined>(undefined);
  // Résultat d'un retour de consentement OAuth : bandeau au-dessus de la liste,
  // pas l'état error (qui remplace toute la liste par le message).
  const [linkFeedback, setLinkFeedback] = useState<LinkFeedback>(undefined);
  const handledOAuthReturn = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/services", { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ services: ServiceInfo[] }>;
      })
      .then((data) => {
        if (!cancelled) setServices(data.services ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the service catalog.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return services;
    return services.filter((service) => service.subscribed);
  }, [filter, services]);

  const subscribedCount = services.filter((service) => service.subscribed).length;
  const availableWidgets = services
    .filter((service) => service.subscribed)
    .reduce((sum, service) => sum + service.widgets.length, 0);

  // Retour du consentement OAuth (cf. startOAuthLink) : traité une seule fois,
  // une fois le catalogue chargé, puis retiré de l'URL pour qu'un rechargement
  // de la page ne rejoue ni la souscription ni le message.
  useEffect(() => {
    if (loading || handledOAuthReturn.current) return;
    handledOAuthReturn.current = true;

    const url = new URL(window.location.href);
    const connect = url.searchParams.get(CONNECT_PARAM);
    const linkError = url.searchParams.get(LINK_ERROR_PARAM);
    if (!connect && !linkError) return;
    url.searchParams.delete(CONNECT_PARAM);
    url.searchParams.delete(LINK_ERROR_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);

    const service = services.find((candidate) => candidate.name === connect);
    if (linkError || !service?.oauth?.linked) {
      setLinkFeedback({ type: "error", message: linkErrorMessage(linkError ?? "") });
      return;
    }
    setLinkFeedback({ type: "success", message: `Your ${serviceTheme(service.name).label} account is now linked.` });
    // Souscription directe (pas handleToggle : le consentement vient d'être
    // accompli, il ne faut pas le relancer — cf. applySubscription).
    if (!service.subscribed) void applySubscription(service.name, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, services]);

  function handleUnlinked(name: string) {
    setServices((current) =>
      current.map((service) =>
        service.name === name && service.oauth
          ? { ...service, oauth: { ...service.oauth, linked: false } }
          : service,
      ),
    );
    setLinkFeedback({ type: "success", message: `Your ${serviceTheme(name).label} account has been unlinked.` });
  }

  async function handleToggle(name: string, currentlySubscribed: boolean) {
    setPending(name);
    setError(undefined);
    const service = services.find((candidate) => candidate.name === name);
    // Consentement seulement si la liaison manque ou est périmée (linked
    // reflète un token déchiffrable côté serveur) : déjà lié avec un token
    // valide → souscription directe, sans redemander d'autorisation.
    if (!currentlySubscribed && service && needsOAuthLink(service)) {
      // Quitte la page vers le consentement du provider : pending reste posé
      // (bouton en spinner) jusqu'à la redirection.
      await startOAuthLink(name, service.oauth?.provider);
      return;
    }
    try {
      await applySubscription(name, currentlySubscribed);
    } finally {
      setPending(undefined);
    }
  }

  // Souscription / désouscription directe (POST / DELETE /subscribe), SANS
  // repasser par le consentement : utilisée au retour d'un consentement déjà
  // accompli (?connect=...). Sans ça, la souscription post-consentement
  // relancerait le consentement via handleToggle — boucle OAuth infinie.
  async function applySubscription(name: string, currentlySubscribed: boolean) {
    try {
      const response = await fetch(`/api/services/${name}/subscribe`, {
        method: currentlySubscribed ? "DELETE" : "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setServices((current) =>
        current.map((service) =>
          service.name === name
            ? {
                ...service,
                subscribed: !currentlySubscribed,
                // Se déconnecter supprime aussi la clé enregistrée côté serveur.
                ...(service.apiKey && currentlySubscribed
                  ? { apiKey: { ...service.apiKey, saved: false } }
                  : {}),
              }
            : service,
        ),
      );
    } catch {
      setError(
        currentlySubscribed
          ? "Could not disconnect this service. Please try again."
          : "Could not connect this service. Please try again.",
      );
    }
  }

  // Connexion d'un service à clé d'API (Steam, YouTube) avec la clé de
  // l'utilisateur. Le serveur la vérifie auprès du service avant de
  // l'enregistrer : son message d'erreur est renvoyé à la carte, qui l'affiche
  // sous le champ.
  async function handleConnectWithKey(name: string, apiKey: string): Promise<string | undefined> {
    setError(undefined);
    try {
      const response = await fetch(`/api/services/${name}/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        return body?.error ?? "Could not connect this service. Please try again.";
      }
      setServices((current) =>
        current.map((service) =>
          service.name === name
            ? {
                ...service,
                subscribed: true,
                ...(service.apiKey ? { apiKey: { ...service.apiKey, saved: true } } : {}),
              }
            : service,
        ),
      );
      return undefined;
    } catch {
      return "Unable to reach the server. Please try again.";
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the services you use, then add their widgets to your dashboard in one click.
          </p>
          {!loading && services.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{subscribedCount}</span> of {services.length} services ready ·{" "}
              <span className="font-medium text-foreground">{availableWidgets}</span> widgets available
            </p>
          ) : null}
        </div>

        <div
          className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1"
          role="tablist"
          aria-label="Services filter"
        >
          {(["all", "subscribed"] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]",
                filter === value ? "bg-white text-black" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "all" ? "All" : "Ready to use"}
              <span className="ml-1.5 tabular-nums opacity-60">
                {value === "all" ? services.length : subscribedCount}
              </span>
            </button>
          ))}
        </div>
      </header>

      {linkFeedback ? (
        <div
          role={linkFeedback.type === "error" ? "alert" : "status"}
          className={cn(
            "rounded-xl border px-4 py-2.5 text-sm",
            linkFeedback.type === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
          )}
        >
          {linkFeedback.message}
        </div>
      ) : null}
      {error && !loading && services.length > 0 ? (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <SpinnerIcon className="size-4 animate-spin" />
          Loading services…
        </div>
      ) : services.length === 0 ? (
        <div role="alert" className="rounded-xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-muted-foreground">
          {error ?? "No services available yet."}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-white/15 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">You haven&apos;t connected any service yet.</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-3 cursor-pointer rounded-full bg-white px-4 py-2 text-xs font-semibold text-black min-h-[40px]"
          >
            Browse services
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((service) => (
            <ServiceCard
              key={service.name}
              service={service}
              pending={pending === service.name}
              openWidget={openWidget}
              onOpenWidget={setOpenWidget}
              onToggle={() => void handleToggle(service.name, Boolean(service.subscribed))}
              onConnectWithKey={(apiKey) => handleConnectWithKey(service.name, apiKey)}
              onUnlinked={handleUnlinked}
              onLinkError={(message) => setLinkFeedback({ type: "error", message })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
