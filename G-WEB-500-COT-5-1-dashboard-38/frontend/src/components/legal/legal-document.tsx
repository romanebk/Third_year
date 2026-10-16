import Link from "next/link";

import { AuthNav } from "@/components/ui/auth-nav";

export interface LegalSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

export interface LegalHighlight {
  icon: React.ReactNode;
  title: string;
  text: string;
}

// Mise en page commune de /privacy et /terms : en-tête, résumé en trois
// points, sommaire collant à gauche (grand écran) et texte à droite, en
// largeur de lecture confortable.
export function LegalDocument({
  title,
  intro,
  updated,
  highlights,
  sections,
  other,
}: {
  title: string;
  intro: string;
  updated: string;
  highlights: LegalHighlight[];
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <>
      <AuthNav ctaHref="/login" ctaLabel="Sign in" />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
        <header className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Legal</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{intro}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated {updated} ·{" "}
            <Link href={other.href} className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
              {other.label}
            </Link>
          </p>
        </header>

        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {highlights.map((item) => (
            <li key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-inset ring-white/10" aria-hidden="true">
                {item.icon}
              </span>
              <p className="mt-4 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">On this page</p>
              <ol className="mt-4 flex flex-col gap-1 border-l border-white/10">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="-ml-px flex gap-2 border-l border-transparent py-1.5 pl-4 text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus:outline-none focus-visible:text-foreground"
                    >
                      <span className="tabular-nums text-muted-foreground/60">{String(index + 1).padStart(2, "0")}</span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="flex max-w-3xl flex-col gap-12">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
                  <span className="text-sm tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </h2>
                <div className="legal-prose mt-4 flex flex-col gap-4 text-[15px] leading-7 text-muted-foreground">
                  {section.content}
                </div>
              </section>
            ))}
          </article>
        </div>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-muted-foreground">
          <p>Hubly — Epitech project</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
