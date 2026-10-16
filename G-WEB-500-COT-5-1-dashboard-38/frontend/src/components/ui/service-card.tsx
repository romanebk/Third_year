"use client";

import Link from "next/link";
import { useState } from "react";

import AddWidgetForm from "@/components/add-widget-form";
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  CloudIcon,
  CoinsIcon,
  CurrencyIcon,
  GamepadIcon,
  GithubIcon,
  GraduationIcon,
  LocationArrowIcon,
  MapPinIcon,
  PlusIcon,
  RocketIcon,
  RssIcon,
  SpinnerIcon,
  WikiIcon,
  YoutubeIcon,
} from "@/components/icons";
import { OAuthLinkStatus } from "@/components/ui/service-oauth";
import { accentTint, serviceTheme, widgetDescription, widgetLabel } from "@/lib/service-theme";
import { cn } from "@/lib/utils";
import type { ServiceInfo } from "@/types";

export const SERVICE_ICONS: Record<string, (props: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  github: GithubIcon,
  "google-calendar": CalendarIcon,
  nasa: RocketIcon,
  holidays: CalendarIcon,
  ipgeo: LocationArrowIcon,
  universities: GraduationIcon,
  weather: CloudIcon,
  steam: GamepadIcon,
  rss: RssIcon,
  crypto: CoinsIcon,
  maps: MapPinIcon,
  youtube: YoutubeIcon,
  devises: CurrencyIcon,
  wikipedia: WikiIcon,
};

type Status = "ready" | "connected" | "disconnected";

function statusOf(service: ServiceInfo): Status {
  if (service.auth === "none") return "ready";
  return service.subscribed ? "connected" : "disconnected";
}

// Où obtenir la clé d'un service "apikey", quand le serveur n'en fournit pas.
const API_KEY_HELP: Record<string, { label: string; href: string; hint: string }> = {
  steam: {
    label: "Steam Web API key",
    href: "https://steamcommunity.com/dev/apikey",
    hint: "Free, created in one click from your Steam account.",
  },
  youtube: {
    label: "YouTube Data API key",
    href: "https://console.cloud.google.com/apis/credentials",
    hint: "Free: create an API key in Google Cloud and enable “YouTube Data API v3”.",
  },
};

const STATUS_LABELS: Record<Status, string> = {
  ready: "Ready",
  connected: "Connected",
  disconnected: "Not connected",
};

// Carte d'un service sur /services : statut, liaison de compte (OAuth), liste
// des widgets avec ajout direct au dashboard, et l'action de connexion.
export function ServiceCard({
  service,
  pending,
  openWidget,
  onOpenWidget,
  onToggle,
  onConnectWithKey,
  onUnlinked,
  onLinkError,
}: {
  service: ServiceInfo;
  pending: boolean;
  // Un seul formulaire d'ajout ouvert à la fois sur la page ("service/widget").
  openWidget: string | undefined;
  onOpenWidget: (key: string | undefined) => void;
  onToggle: () => void;
  // Connexion d'un service à clé d'API : renvoie le message d'erreur à
  // afficher sous le champ, ou undefined si la clé a été acceptée.
  onConnectWithKey: (apiKey: string) => Promise<string | undefined>;
  onUnlinked: (serviceName: string) => void;
  onLinkError: (message: string) => void;
}) {
  const theme = serviceTheme(service.name);
  const Icon = SERVICE_ICONS[service.name] ?? CloudIcon;
  const status = statusOf(service);
  const canAdd = status !== "disconnected";
  const [added, setAdded] = useState<string | undefined>(undefined);
  // Le serveur n'a pas de clé pour ce service : l'utilisateur fournit la sienne.
  const keyHelp = service.apiKey?.required ? API_KEY_HELP[service.name] : undefined;
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [keyError, setKeyError] = useState<string | undefined>(undefined);
  const [keySaving, setKeySaving] = useState(false);

  async function handleKeySubmit(event: React.FormEvent) {
    event.preventDefault();
    const apiKey = keyValue.trim();
    if (!apiKey) {
      setKeyError("Paste your API key.");
      return;
    }
    setKeySaving(true);
    setKeyError(undefined);
    const failure = await onConnectWithKey(apiKey);
    setKeySaving(false);
    if (failure) {
      setKeyError(failure);
      return;
    }
    setKeyOpen(false);
    setKeyValue("");
  }

  return (
    <article
      style={{ "--accent": theme.accent, "--accent-soft": accentTint(theme.accent, 0.14) } as React.CSSProperties}
      className="relative flex flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#0c0c10]/90 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-12px_rgba(0,0,0,0.8)]"
    >

      <header className="flex items-start gap-3 px-5 pt-5">
        <span
          className="flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-inset ring-white/[0.06]"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{theme.label}</h2>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                status === "disconnected"
                  ? "bg-white/[0.06] text-muted-foreground"
                  : "bg-emerald-400/10 text-emerald-300",
              )}
            >
              {status === "disconnected" ? null : <CheckIcon className="size-3" aria-hidden="true" />}
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{theme.tagline || service.description}</p>
        </div>
      </header>

      <OAuthLinkStatus service={service} onUnlinked={onUnlinked} onError={onLinkError} />

      <ul className="mt-4 flex flex-col border-t border-white/[0.06]" aria-label={`${theme.label} widgets`}>
        {service.widgets.map((widget) => {
          const key = `${service.name}/${widget.name}`;
          const isOpen = openWidget === key;
          return (
            <li key={widget.name} className="border-b border-white/[0.06] last:border-none">
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{widgetLabel(widget.name)}</p>
                  <p className="text-xs text-muted-foreground sm:truncate" title={widgetDescription(widget.name, widget.description)}>
                    {widgetDescription(widget.name, widget.description)}
                  </p>
                </div>
                {added === widget.name ? (
                  <Link
                    href="/dashboard"
                    className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]"
                  >
                    <CheckIcon className="size-3" aria-hidden="true" />
                    Added · View
                  </Link>
                ) : canAdd ? (
                  <button
                    type="button"
                    onClick={() => onOpenWidget(isOpen ? undefined : key)}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]",
                      isOpen
                        ? "border-white/30 bg-white/[0.08] text-foreground"
                        : "border-white/[0.1] text-foreground/90 hover:border-[var(--accent)] hover:text-[var(--accent)]",
                    )}
                  >
                    <PlusIcon className="size-3" aria-hidden="true" />
                    Add
                    <span className="sr-only"> {widgetLabel(widget.name)} to dashboard</span>
                  </button>
                ) : null}
              </div>
              {isOpen ? (
                <div className="px-5 pb-4">
                  <AddWidgetForm
                    service={service.name}
                    widget={widget}
                    minRefreshRateSeconds={service.minRefreshRateSeconds}
                    onCancel={() => onOpenWidget(undefined)}
                    onCreated={() => {
                      onOpenWidget(undefined);
                      setAdded(widget.name);
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {keyOpen && keyHelp && status === "disconnected" ? (
        <form onSubmit={handleKeySubmit} className="flex flex-col gap-2 border-t border-white/[0.06] px-5 py-4">
          <label htmlFor={`${service.name}-api-key`} className="text-xs font-medium text-foreground/90">
            {keyHelp.label}
          </label>
          <input
            id={`${service.name}-api-key`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={keyValue}
            onChange={(event) => {
              setKeyValue(event.target.value);
              setKeyError(undefined);
            }}
            placeholder="Paste your key"
            aria-invalid={keyError ? true : undefined}
            aria-describedby={`${service.name}-api-key-help`}
            className="w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 hover:border-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/10 min-h-[44px]"
          />
          {keyError ? (
            <p role="alert" className="flex items-start gap-1.5 text-xs text-foreground/90">
              <AlertIcon className="mt-0.5 size-3 shrink-0 text-red-400" aria-hidden="true" />
              {keyError}
            </p>
          ) : null}
          <p id={`${service.name}-api-key-help`} className="text-[11px] leading-snug text-muted-foreground">
            {keyHelp.hint}{" "}
            <a
              href={keyHelp.href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-2 hover:no-underline"
            >
              Get a key
            </a>
            . It is stored encrypted and only used for your widgets.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="submit"
              disabled={keySaving}
              className="flex cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]"
            >
              {keySaving ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
              {keySaving ? "Checking key…" : "Save and connect"}
            </button>
            <button
              type="button"
              onClick={() => {
                setKeyOpen(false);
                setKeyError(undefined);
              }}
              disabled={keySaving}
              className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground min-h-[40px]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3.5">
        {status === "ready" ? (
          <p className="text-xs text-muted-foreground">No account needed — add its widgets right away.</p>
        ) : status === "connected" ? (
          <>
            <p className="text-xs text-muted-foreground">
              {service.apiKey?.saved
                ? "Connected with your own API key."
                : "You can add its widgets to your dashboard."}
            </p>
            <button
              type="button"
              onClick={onToggle}
              disabled={pending}
              className="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]"
            >
              {pending ? <SpinnerIcon className="size-3.5 animate-spin" /> : "Disconnect"}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {keyHelp ? "Connect with your own API key." : "Connect to add its widgets."}
            </p>
            {keyHelp && keyOpen ? null : (
              <button
                type="button"
                onClick={keyHelp ? () => setKeyOpen(true) : onToggle}
                disabled={pending}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-black transition-[transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]"
              >
                {pending ? <SpinnerIcon className="size-3.5 animate-spin" /> : null}
                Connect {theme.label}
              </button>
            )}
          </>
        )}
      </footer>
    </article>
  );
}
