"use client";

import { useCallback, useEffect, useState } from "react";

import { CheckIcon, CloudIcon, GithubIcon, LocateIcon, RssIcon, SpinnerIcon } from "@/components/icons";
import { accentTint, serviceTheme } from "@/lib/service-theme";
import { cn } from "@/lib/utils";

interface SettingsData {
  weatherCity: string;
  weatherUnit: "celsius" | "fahrenheit";
  githubRepository: string;
  rssFeedUrl: string;
  rssInterests: string[];
}

interface RssInterestOption {
  key: string;
  label: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  weatherCity: "Paris",
  weatherUnit: "celsius",
  githubRepository: "vercel/next.js",
  rssFeedUrl: "https://hnrss.org/frontpage",
  rssInterests: ["technology", "world", "science"],
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 hover:border-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/10 min-h-[44px]";

function Section({
  service,
  icon,
  title,
  description,
  columns = 2,
  children,
}: {
  service: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  // Champs côte à côte sur très grand écran ; 1 pour une section à champ unique.
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  const accent = serviceTheme(service).accent;
  return (
    // Sur grand écran : titre et description à gauche, champs à droite (mise
    // en page type "réglages"), pour occuper la largeur sans empiler les cartes.
    <section
      style={{ "--accent": accent, "--accent-soft": accentTint(accent, 0.14) } as React.CSSProperties}
      className="grid gap-4 border-t border-white/[0.06] pt-8 first:border-none first:pt-0 lg:grid-cols-[minmax(220px,300px)_1fr] lg:gap-10"
    >
      <header className="flex items-start gap-3">
        <span
          className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-inset ring-white/[0.06]"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className={cn("grid gap-5 rounded-[20px] border border-white/[0.07] bg-[#0c0c10]/90 p-5 sm:p-6 xl:gap-6", columns === 2 && "xl:grid-cols-2")}>
        {children}
      </div>
    </section>
  );
}

// id sert deux usages : htmlFor->id vers un <input> unique (le cas courant),
// ou aria-labelledby vers un groupe de contrôles (ex. le choix d'unité plus
// bas) — dans les deux cas le label devient une vraie annonce lecteur d'écran
// au lieu d'un texte visuel seul, jamais associé programmatiquement (trouvé
// lors d'un audit d'accessibilité).
function Field({
  label,
  id,
  help,
  children,
}: {
  label: string;
  id: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label id={`${id}-label`} htmlFor={id} className="text-xs font-medium text-foreground/90">
        {label}
      </label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-[11px] leading-snug text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function sameSettings(a: SettingsData, b: SettingsData): boolean {
  return (
    a.weatherCity.trim() === b.weatherCity.trim() &&
    a.weatherUnit === b.weatherUnit &&
    a.githubRepository.trim() === b.githubRepository.trim() &&
    a.rssFeedUrl.trim() === b.rssFeedUrl.trim() &&
    [...a.rssInterests].sort().join(",") === [...b.rssInterests].sort().join(",")
  );
}

export default function SettingsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [form, setForm] = useState<SettingsData>(DEFAULT_SETTINGS);
  // Dernière version enregistrée : sert à savoir s'il y a des modifications
  // (barre d'enregistrement) et à les annuler (Discard).
  const [saved, setSaved] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interests, setInterests] = useState<RssInterestOption[]>([]);
  const [interestsError, setInterestsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const dirty = !sameSettings(form, saved);

  const update = useCallback((patch: Partial<SettingsData>) => {
    setForm((current) => ({ ...current, ...patch }));
    setJustSaved(false);
    setError(null);
  }, []);

  const toggleInterest = (key: string) => {
    update({
      rssInterests: form.rssInterests.includes(key)
        ? form.rssInterests.filter((k) => k !== key)
        : [...form.rssInterests, key],
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rss/interests")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load interests");
        const json = (await response.json()) as { interests?: RssInterestOption[] };
        if (!cancelled) setInterests(json.interests ?? []);
      })
      .catch(() => {
        if (!cancelled) setInterestsError("Could not load topics.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings");
        const json = (await response.json()) as { settings?: Partial<SettingsData> };
        if (cancelled) return;
        const loaded = { ...DEFAULT_SETTINGS, ...(json.settings ?? {}) };
        setForm(loaded);
        setSaved(loaded);
        setState({ status: "ready" });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: loadError instanceof Error ? loadError.message : "Something went wrong.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Géolocalisation du navigateur -> POST /api/settings/locate, qui résout la
  // ville et l'enregistre directement (même chemin que l'auto-détection d'un
  // compte neuf) : la ville enregistrée est donc mise à jour des deux côtés.
  function handleLocate() {
    if (!("geolocation" in navigator)) {
      setLocateError("Your browser can't share its location.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetch("/api/settings/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        })
          .then(async (response) => {
            const body = (await response.json().catch(() => null)) as
              | { settings?: Partial<SettingsData>; error?: string }
              | null;
            if (!response.ok || !body?.settings?.weatherCity) {
              throw new Error(body?.error ?? "Could not find your city.");
            }
            const city = body.settings.weatherCity;
            setForm((current) => ({ ...current, weatherCity: city }));
            setSaved((current) => ({ ...current, weatherCity: city }));
          })
          .catch((locateFailure: unknown) => {
            setLocateError(locateFailure instanceof Error ? locateFailure.message : "Could not find your city.");
          })
          .finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        setLocateError("Location access was denied. Type your city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function handleSave() {
    setSaving(true);
    setError(null);
    const payload: SettingsData = {
      weatherCity: form.weatherCity.trim() || DEFAULT_SETTINGS.weatherCity,
      weatherUnit: form.weatherUnit,
      githubRepository: form.githubRepository.trim() || DEFAULT_SETTINGS.githubRepository,
      rssFeedUrl: form.rssFeedUrl.trim() || DEFAULT_SETTINGS.rssFeedUrl,
      rssInterests: form.rssInterests,
    };
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not save settings");
        }
        setForm(payload);
        setSaved(payload);
        setJustSaved(true);
        window.setTimeout(() => setJustSaved(false), 2500);
      })
      .catch((saveError: unknown) => {
        setError(saveError instanceof Error ? saveError.message : "Something went wrong.");
      })
      .finally(() => setSaving(false));
  }

  if (state.status === "loading") {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-live="polite">
        <SpinnerIcon className="h-5 w-5 animate-spin" />
        <span className="sr-only">Loading settings…</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-24">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preferences for your default widgets, saved to your account.
        </p>
      </header>

      <div className="flex flex-col gap-8">
        <Section
          service="weather"
          icon={<CloudIcon className="size-4" />}
          title="Weather"
          description="Used by your Current weather and Forecast widgets."
        >
          <Field label="City" id="settings-weather-city" help={locateError ?? undefined}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="settings-weather-city"
                type="text"
                value={form.weatherCity}
                onChange={(event) => update({ weatherCity: event.target.value })}
                placeholder="e.g. Paris"
                autoComplete="address-level2"
                aria-describedby={locateError ? "settings-weather-city-help" : undefined}
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-3.5 text-sm font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
              >
                {locating ? <SpinnerIcon className="size-4 animate-spin" /> : <LocateIcon className="size-4" />}
                {locating ? "Locating…" : "Use my location"}
              </button>
            </div>
          </Field>
          <Field label="Temperature unit" id="settings-weather-unit">
            <div
              role="group"
              aria-labelledby="settings-weather-unit-label"
              className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1"
            >
              {(
                [
                  { value: "celsius", label: "Celsius (°C)" },
                  { value: "fahrenheit", label: "Fahrenheit (°F)" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update({ weatherUnit: option.value })}
                  aria-pressed={form.weatherUnit === option.value}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]",
                    form.weatherUnit === option.value
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        <Section
          service="github"
          icon={<GithubIcon className="size-4" />}
          title="GitHub"
          description="Used by your default Recent commits widget."
          columns={1}
        >
          <Field label="Repository" id="settings-github-repository" help="Format: owner/repository, e.g. vercel/next.js.">
            <input
              id="settings-github-repository"
              type="text"
              value={form.githubRepository}
              onChange={(event) => update({ githubRepository: event.target.value })}
              placeholder="owner/repository"
              aria-describedby="settings-github-repository-help"
              autoComplete="off"
              className={cn(inputClass, "xl:max-w-xl")}
            />
          </Field>
        </Section>

        <Section
          service="rss"
          icon={<RssIcon className="size-4" />}
          title="News"
          description="Topics for Your news, and a feed for the News feed widget."
        >
          <Field label="Topics" id="settings-rss-interests">
            {interestsError ? <p className="text-xs text-destructive">{interestsError}</p> : null}
            <div role="group" aria-labelledby="settings-rss-interests-label" className="flex flex-wrap gap-2">
              {interests.map((interest) => {
                const active = form.rssInterests.includes(interest.key);
                return (
                  <button
                    key={interest.key}
                    type="button"
                    onClick={() => toggleInterest(interest.key)}
                    aria-pressed={active}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]",
                      active
                        ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "border-white/[0.1] text-muted-foreground hover:border-white/[0.2] hover:text-foreground",
                    )}
                  >
                    {active ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
                    {interest.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Feed URL" id="settings-rss-feed-url" help="Any RSS or Atom feed link.">
            <input
              id="settings-rss-feed-url"
              type="url"
              value={form.rssFeedUrl}
              onChange={(event) => update({ rssFeedUrl: event.target.value })}
              placeholder="https://example.com/feed.xml"
              aria-describedby="settings-rss-feed-url-help"
              className={inputClass}
            />
          </Field>
        </Section>

      </div>

      {/* Barre d'enregistrement : visible seulement s'il y a des modifications
          (ou juste après un enregistrement / une erreur), collée en bas de la
          zone de contenu pour rester atteignable sans remonter la page. */}
      {dirty || justSaved || error ? (
        <div className="sticky bottom-4 z-10">
          <div
            role={error ? "alert" : "status"}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.1] bg-[#111116]/95 px-4 py-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] backdrop-blur"
          >
            <p className={cn("flex items-center gap-1.5 text-sm", error ? "text-destructive" : justSaved && !dirty ? "text-emerald-300" : "text-foreground")}>
              {justSaved && !dirty && !error ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
              {error ?? (dirty ? "You have unsaved changes" : "All changes saved")}
            </p>
            {dirty ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm(saved);
                    setError(null);
                  }}
                  disabled={saving}
                  className="cursor-pointer rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]"
                >
                  {saving ? <SpinnerIcon className="size-4 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
