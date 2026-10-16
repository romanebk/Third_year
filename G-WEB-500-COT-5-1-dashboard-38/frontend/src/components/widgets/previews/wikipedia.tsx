import type { JSX } from "react";

import { formatCompactNumber } from "@/components/widgets/previews/format";

export interface WikiOnThisDayPage {
  title: string;
  url: string | null;
}

export interface WikiOnThisDayEvent {
  year: number | null;
  text: string;
  pages: WikiOnThisDayPage[];
}

export interface WikiOnThisDayData {
  lang: string;
  month: number;
  day: number;
  events: WikiOnThisDayEvent[];
}

export interface WikiTopReadArticle {
  title: string;
  views: number;
  rank: number | null;
  url: string | null;
  description: string | null;
  thumbnailUrl: string | null;
}

export interface WikiTopReadData {
  lang: string;
  date: string;
  articles: WikiTopReadArticle[];
}

// wiki_onthisday : entrée d'encyclopédie — la date du jour en héros, puis une
// timeline fine (la séquence temporelle, c'est le sens du widget) avec l'année
// en chiffres saillants et les liens d'approfondissement.
export function WikiOnThisDayPreview({ data }: { data: WikiOnThisDayData }): JSX.Element {
  const events = data.events ?? [];
  const heading = new Intl.DateTimeFormat("fr", { day: "numeric", month: "long" }).format(
    new Date(2026, data.month - 1, data.day),
  );
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Rien à signaler ce jour-là.</p>;
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-lg font-semibold capitalize tracking-tight">
        {heading}
        <span className="ml-2 text-sm font-normal text-muted-foreground">ce jour-là</span>
      </p>
      <ul className="flex flex-col gap-3 border-l border-border pl-4" aria-label="On this day">
        {events.map((event, index) => (
          <li key={`${event.year}-${index}`} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-foreground/40"
            />
            {event.year !== null ? (
              <p className="text-[13px] font-semibold tabular-nums">{event.year}</p>
            ) : null}
            <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-foreground/90">{event.text}</p>
            {event.pages.length > 0 ? (
              <p className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                {event.pages.map((page) =>
                  page.url ? (
                    <a
                      key={page.title}
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md text-xs text-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {page.title}
                    </a>
                  ) : null,
                )}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// wiki_top_read : palmarès — rang en grand chiffre fin (simple repère de
// lecture, pas de pastille), titre actionnable et vues compactes.
export function WikiTopReadPreview({ data }: { data: WikiTopReadData }): JSX.Element {
  const articles = data.articles ?? [];
  if (articles.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun article pour le moment.</p>;
  }
  return (
    <ul className="flex flex-col" aria-label="Most read articles">
      {articles.map((article) => (
        <li
          key={article.title}
          className="flex items-baseline gap-3 border-b border-border py-2.5 first:pt-0 last:border-none last:pb-0"
        >
          {article.rank !== null ? (
            <span className="w-7 flex-shrink-0 text-xl font-light tabular-nums text-muted-foreground">
              {article.rank}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {article.url ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {article.title}
              </a>
            ) : (
              <p className="truncate text-sm font-medium">{article.title}</p>
            )}
            {article.description ? (
              <p className="truncate text-xs text-muted-foreground">{article.description}</p>
            ) : null}
          </div>
          <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatCompactNumber(article.views)} vues
          </span>
        </li>
      ))}
    </ul>
  );
}
