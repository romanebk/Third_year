"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import DeleteAccountSection from "@/components/delete-account-section";
import { CheckIcon, GithubIcon, GoogleIcon, MailIcon, SpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { isValidUsername, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/validation";

// Ancien emplacement du nom d'affichage (navigateur uniquement, avant
// PATCH /api/profile) : relu une fois pour pré-remplir le champ d'un compte
// qui n'a pas encore de nom enregistré côté serveur.
const LEGACY_NAME_STORAGE_KEY = "hubly.profile.name";

interface ProfileData {
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  hasPassword: boolean;
  linkedProviders: string[];
}

function readLegacyName(): string {
  try {
    const raw = window.localStorage.getItem(LEGACY_NAME_STORAGE_KEY)?.trim();
    return raw && raw !== "Guest" ? raw : "";
  } catch {
    return "";
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] border border-white/[0.07] bg-[#0c0c10]/90">
      <header className="px-5 pb-1 pt-5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </header>
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

function SignInMethod({
  icon,
  label,
  active,
  activeText,
  inactiveText,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeText: string;
  inactiveText: string;
  action?: React.ReactNode;
}) {
  return (
    // Tuile : empilées sur mobile, trois côte à côte dès que la place le permet.
    <li className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-col sm:items-start">
      <div className="flex w-full items-center gap-3">
        <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-foreground ring-1 ring-inset ring-white/[0.06]" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className={cn("flex items-center gap-1 text-xs", active ? "text-emerald-300" : "text-muted-foreground")}>
            {active ? <CheckIcon className="size-3" aria-hidden="true" /> : null}
            {active ? activeText : inactiveText}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0 sm:mt-auto sm:self-stretch">{action}</div> : null}
    </li>
  );
}

export default function ProfileView() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // Résumé du dashboard (colonne de gauche) ; null tant qu'il n'est pas chargé
  // ou s'il est indisponible — la page reste utilisable sans.
  const [usage, setUsage] = useState<{ widgets: number; services: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { credentials: "include" })
      .then((response) => (response.ok ? (response.json() as Promise<{ instances?: { service: string }[] }>) : null))
      .then((body) => {
        if (cancelled || !body?.instances) return;
        setUsage({
          widgets: body.instances.length,
          services: new Set(body.instances.map((instance) => instance.service)).size,
        });
      })
      .catch(() => {
        // Résumé masqué si le dashboard ne répond pas.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile", { credentials: "include" })
      .then((response) => (response.ok ? (response.json() as Promise<ProfileData>) : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setSavedName(data.name ?? "");
        setName(data.name ?? readLegacyName());
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!isValidUsername(trimmed)) {
      setFeedback({
        type: "error",
        message: `Use ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters: letters, numbers, spaces, _ . or -`,
      });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as { name?: string; error?: string } | null;
      if (!response.ok || !body?.name) throw new Error(body?.error ?? "Could not save your username.");
      setSavedName(body.name);
      setName(body.name);
      setFeedback({ type: "success", message: "Saved" });
      try {
        window.localStorage.removeItem(LEGACY_NAME_STORAGE_KEY);
      } catch {
        // stockage indisponible : rien à nettoyer
      }
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Could not save your username." });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="py-16 text-center text-sm text-muted-foreground">
        Could not load your profile. Please refresh the page.
      </p>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status">
        <SpinnerIcon className="size-5 animate-spin" />
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  const displayName = savedName || profile.email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en", { month: "long", year: "numeric" });
  const dirty = name.trim() !== savedName;
  const linked = (provider: string) => profile.linkedProviders.includes(provider);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and how you sign in.</p>
      </header>

      {/* Grand écran : identité + résumé à gauche (collant), réglages à droite. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(280px,360px)_1fr] lg:gap-6">
        <aside className="min-w-0 rounded-[20px] border border-white/[0.07] bg-[#0c0c10]/90 p-6 lg:sticky lg:top-0">
          <div className="flex items-center gap-4 lg:flex-col lg:items-start">
            {profile.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar du provider OAuth (GitHub/Google), domaines non whitelistés pour next/image
              <img
                src={profile.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-16 rounded-full object-cover ring-1 ring-white/[0.08] lg:size-20"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-16 items-center justify-center rounded-full bg-white/[0.08] text-xl font-semibold text-foreground ring-1 ring-white/[0.08] lg:size-20 lg:text-2xl"
              >
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold tracking-tight">{displayName}</p>
              <p className="truncate text-sm text-muted-foreground" title={profile.email}>
                {profile.email}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Widgets</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{usage ? usage.widgets : "—"}</dd>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Services used</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{usage ? usage.services : "—"}</dd>
            </div>
          </dl>

          <dl className="mt-4 flex flex-col text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2.5">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{profile.role === "ADMIN" ? "Admin" : "Member"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{memberSince}</dd>
            </div>
          </dl>

          <Link
            href="/dashboard"
            className="mt-4 flex items-center justify-center rounded-full border border-white/[0.1] px-4 py-2 text-sm font-medium transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
          >
            Open dashboard
          </Link>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Username" description="Shown at the top of your dashboard.">
            <form onSubmit={handleSave} className="flex max-w-xl flex-col gap-2 sm:flex-row">
              <label htmlFor="profile-username" className="sr-only">
                Username
              </label>
              <input
                id="profile-username"
                type="text"
                value={name}
                maxLength={USERNAME_MAX_LENGTH}
                autoComplete="username"
                onChange={(event) => {
                  setName(event.target.value);
                  setFeedback(null);
                }}
                placeholder="Your username"
                className="w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 hover:border-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/10 min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!dirty || saving}
                className="flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:cursor-default disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
              >
                {saving ? <SpinnerIcon className="size-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Save"}
              </button>
            </form>
            {feedback ? (
              <p
                role={feedback.type === "error" ? "alert" : "status"}
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-xs",
                  feedback.type === "error" ? "text-destructive" : "text-emerald-300",
                )}
              >
                {feedback.type === "success" ? <CheckIcon className="size-3" aria-hidden="true" /> : null}
                {feedback.message}
              </p>
            ) : null}
          </Section>

          <Section title="Sign-in methods" description="The ways you can access your Hubly account.">
            <ul className="grid gap-3 sm:grid-cols-3">
              <SignInMethod
                icon={<MailIcon className="size-4" />}
                label="Email & password"
                active={profile.hasPassword}
                activeText="Enabled"
                inactiveText="Not set — you sign in with a linked account"
              />
              <SignInMethod
                icon={<GoogleIcon className="size-4" />}
                label="Google"
                active={linked("google")}
                activeText="Linked"
                inactiveText="Not linked — sign in with Google once to link it"
              />
              <SignInMethod
                icon={<GithubIcon className="size-4" />}
                label="GitHub"
                active={linked("github")}
                activeText="Linked"
                inactiveText="Not linked — needed for private repos and security alerts"
                action={
                  <Link
                    href="/services"
                    className="flex items-center justify-center rounded-full border border-white/[0.1] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]"
                  >
                    {linked("github") ? "Manage" : "Link"}
                  </Link>
                }
              />
            </ul>
          </Section>

          <DeleteAccountSection hasPassword={profile.hasPassword} />
        </div>
      </div>
    </div>
  );
}
