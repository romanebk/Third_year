import type { JSX } from "react";

import { GamepadIcon } from "@/components/icons";
import { formatHours, formatRelativeTime } from "@/components/widgets/previews/format";

export interface SteamMostPlayedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
}

export interface SteamMostPlayedData {
  steamId: string;
  source: "two_weeks" | "all_time";
  games: SteamMostPlayedGame[];
}

export interface SteamGameNewsItem {
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: string | null;
}

export interface SteamGameNewsData {
  appId: number;
  items: SteamGameNewsItem[];
}

// steam_most_played : jeux les plus joués, classés, avec une barre de temps de
// jeu proportionnelle au plus joué (rappel la liste du widget Steam de démo).
export function SteamMostPlayedPreview({ data }: { data: SteamMostPlayedData }): JSX.Element {
  const games = data.games ?? [];
  const maxMinutes = Math.max(...games.map((game) => game.playtimeMinutes), 0);
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {data.source === "two_weeks" ? "last 14 days" : "all time"}
      </p>
      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">No games played on this period.</p>
      ) : (
        <ul className="flex flex-col gap-2.5" aria-label="Most played games">
          {games.map((game, index) => (
            <li key={game.appId}>
              <div className="flex items-baseline gap-2.5">
                <span className="w-4 flex-shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{game.name}</span>
                <span className="flex-shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatHours(game.playtimeMinutes)}
                </span>
              </div>
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={game.playtimeMinutes}
                aria-valuemax={maxMinutes}
                aria-label={`${game.name} playtime: ${formatHours(game.playtimeMinutes)}`}
              >
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: maxMinutes ? `${(game.playtimeMinutes / maxMinutes) * 100}%` : "0%" }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// steam_game_news : dernières news d'un jeu (titre + auteur + date relative).
export function SteamGameNewsPreview({ data }: { data: SteamGameNewsData }): JSX.Element {
  const items = data.items ?? [];
  const now = Date.now();
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No news.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Game news">
      {items.map((item, index) => (
        <li
          key={`${item.title}-${index}`}
          className="flex items-baseline gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
        >
          <GamepadIcon className="h-4 w-4 flex-shrink-0 self-center text-foreground/70" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
          {item.publishedAt ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatRelativeTime(item.publishedAt, now)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
