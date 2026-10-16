import type { JSX } from "react";

export interface RssArticleItem {
  title: string;
  link: string | null;
  publishedAt: string | null;
  imageUrl?: string | null;
}

export interface RssArticlesData {
  feedUrl: string;
  title: string | null;
  source: "rss" | "atom";
  articles: RssArticleItem[];
}

// rss_article_list / rss_interest_feed : grille éditoriale de cartes média.
// L'image est la vedette de chaque carte (grande vignette en haut, "cover"),
// un dégradé depuis le bas assure le contraste et le titre (plus la date en
// petit, style sous-titre éditorial) se lit sous l'image — le motif qui fait
// "fil d'actualités magazine" plutôt qu'une liste dense de lignes. Aucun lien
// cliquable : le flux peut pointer vers n'importe quel domaine externe.
export default function RssArticlesPreview({ data }: { data: RssArticlesData }): JSX.Element {
  const articles = data.articles ?? [];
  return (
    <div className="flex flex-col gap-2">
      {data.title ? (
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {data.title}
        </p>
      ) : null}
      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No articles.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {articles.map((article, index) => (
            <li
              key={`${article.title}-${index}`}
              aria-label={article.title || undefined}
              className="group relative min-w-0 overflow-hidden rounded-[12px] border border-border bg-muted transition-[border-color,box-shadow] duration-300 ease-out hover:border-foreground/25 hover:shadow-lg focus-within:ring-2 focus-within:ring-ring"
            >
              {article.imageUrl ? (
                <div className="relative aspect-video w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element -- vignette hébergée par le flux, domaine non whitelisté dans next.config.js */}
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="truncate text-[10px] font-medium uppercase tracking-widest text-white/75">
                      {article.publishedAt
                        ? new Intl.DateTimeFormat("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(article.publishedAt))
                        : "Latest"}
                    </p>
                    <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">
                      {article.title}
                    </h3>
                  </div>
                </div>
              ) : (
                <div className="flex aspect-video w-full items-end bg-muted p-3">
                  <p className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    {article.publishedAt
                      ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
                          new Date(article.publishedAt),
                        )
                      : "Latest"}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {article.title}
                  </h3>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
