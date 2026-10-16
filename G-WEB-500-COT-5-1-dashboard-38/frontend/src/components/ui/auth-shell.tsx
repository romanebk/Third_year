import Image from "next/image";
import Link from "next/link";

import { AlertIcon, CloudRainIcon, CoinsIcon, GithubIcon, YoutubeIcon } from "@/components/icons";

// Aperçu décoratif du dashboard (panneau de gauche) : noir et blanc, seules les
// icônes gardent la couleur de leur service.
const PREVIEW = [
  {
    icon: <CloudRainIcon className="size-4 text-sky-400" />,
    label: "Current weather",
    value: "22°C",
    detail: "Light rain · Paris",
  },
  {
    icon: <GithubIcon className="size-4 text-violet-400" />,
    label: "GitHub profile",
    value: "3,817",
    detail: "contributions this year",
  },
  {
    icon: <YoutubeIcon className="size-4 text-red-500" />,
    label: "Channel stats",
    value: "519M",
    detail: "subscribers",
  },
  {
    icon: <CoinsIcon className="size-4 text-amber-400" />,
    label: "Price",
    value: "74,737 €",
    detail: "Bitcoin · +0.63%",
  },
];

function LegalLinks({ className }: { className?: string }) {
  return (
    <p className={className}>
      <Link href="/terms" className="hover:text-foreground">
        Terms of Service
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/privacy" className="hover:text-foreground">
        Privacy Policy
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/contact" className="hover:text-foreground">
        Contact
      </Link>
    </p>
  );
}

// Mise en page des pages de connexion / inscription / confirmation : panneau
// de présentation à gauche sur grand écran (occupe la largeur et la hauteur),
// formulaire centré à droite. Sur mobile, seul le formulaire reste.
export function AuthShell({
  headline,
  description,
  topAction,
  children,
}: {
  headline: string;
  description: string;
  topAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[#050505] p-10 lg:flex xl:p-14">
        {/* Photo d'ambiance en fond + voile sombre pour garder le texte lisible. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- fond décoratif statique */}
        <img
          src="/hero-living-room.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/75" />

        <Link
          href="/"
          className="relative flex w-fit items-center gap-2.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
          aria-label="Hubly home"
        >
          <Image
            src="/logos/logo-navbar-white.png"
            alt=""
            width={128}
            height={32}
            unoptimized
            className="size-7 object-cover [object-position:55%_50%]"
          />
          <span className="text-base font-semibold tracking-tight">Hubly</span>
        </Link>

        <div className="relative max-w-xl">
          <p className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            {headline}
          </p>
          <p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">{description}</p>

          <ul className="mt-10 grid grid-cols-2 gap-3" aria-hidden="true">
            {PREVIEW.map((item) => (
              <li
                key={item.label}
                className="rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/10">
                    {item.icon}
                  </span>
                  {item.label}
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>Hubly — Epitech project</p>
          <LegalLinks />
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] lg:invisible"
            aria-label="Hubly home"
          >
            <Image
              src="/logos/logo-navbar-white.png"
              alt=""
              width={128}
              height={32}
              unoptimized
              className="size-7 object-cover [object-position:55%_50%]"
            />
            <span className="text-sm font-semibold tracking-tight">Hubly</span>
          </Link>
          {topAction}
        </div>

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-10">
          {children}
        </div>

        <LegalLinks className="text-center text-xs text-muted-foreground lg:hidden" />
      </main>
    </div>
  );
}

// Message global (erreur serveur, OAuth...) : texte blanc, seule l'icône est
// rouge — le site reste en noir et blanc.
export function AuthAlert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-3 text-sm text-foreground"
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-red-400" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// Erreur sous un champ, même principe.
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-center gap-1.5 text-xs text-foreground/90">
      <AlertIcon className="size-3 shrink-0 text-red-400" aria-hidden="true" />
      {children}
    </p>
  );
}

// Bouton secondaire du coin supérieur droit ("Sign up" / "Sign in").
export function AuthTopLink({
  href,
  prompt,
  label,
}: {
  href: string;
  prompt: string;
  label: string;
}) {
  return (
    <p className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="hidden sm:inline">{prompt}</span>
      <Link
        href={href}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
      </Link>
    </p>
  );
}
