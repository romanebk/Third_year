import type { JSX } from "react";

import { cn } from "@/lib/utils";
import { GitCommitIcon, ShieldIcon } from "@/components/icons";
import { formatRelativeTime, toLocalIso } from "@/components/widgets/previews/format";

export interface GithubContributionDay {
  date: string;
  level: number;
  count: number;
}

export interface GithubContributions {
  total: number;
  days: GithubContributionDay[];
}

export interface GithubProfileData {
  username: string;
  name: string | null;
  avatarUrl: string;
  publicRepos: number;
  // Dépôts privés possédés : seulement quand le compte GitHub lié est le
  // profil affiché (cf. fetchOwnPrivateRepoCount côté backend), null sinon.
  privateRepos?: number | null;
  followers: number;
  contributions: GithubContributions | null;
}

export interface GithubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface GithubSecurityAlert {
  summary: string;
  severity: string;
  state: string;
}

// github_user_profile : avatar réel + nom en titre / username en sous-titre,
// repos et followers en deux stats côte à côte, et — quand disponible — la
// heatmap de contributions de l'année (les petits carrés verts du profil GitHub),
// reconstruite en colonnes de semaines × 7 jours comme sur GitHub. La grille est
// "réactive en largeur" : chaque colonne vaut fr, chaque case est carrée, donc le
// calendrier se redimensionne pour remplir le panneau quelle que soit sa largeur.
const GITHUB_LEVEL_COLORS = [
  "rgba(255,255,255,0.05)",
  "#0e4429",
  "#006d32",
  "#26a641",
  "#39d353",
];

const GITHUB_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type HeatmapWeek = {
  month: string | null;
  days: Array<{ date: string; level: number; count: number; hasData: boolean }>;
};

function contributionLabel(count: number, date: string): string {
  return `${count} contribution${count === 1 ? "" : "s"} on ${date}`;
}

// Reconstruit le calendrier type GitHub à partir des jours fournis par le
// backend : 53 colonnes (semaines débutant un dimanche) × 7 jours, de la semaine
// en cours vers un an en arrière. Les jours absents de la payload (calendrier
// incomplet, weekends, futures cases) tombent en niveau 0 comme sur GitHub.
function buildHeatmapWeeks(days: GithubContributionDay[]): HeatmapWeek[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weeks: HeatmapWeek[] = [];
  let sunday = new Date(today);
  sunday.setDate(sunday.getDate() - sunday.getDay());

  let previousMonth: number | null = null;
  for (let column = 0; column < 53 * 7; column += 7) {
    const weekDays: HeatmapWeek["days"] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      const iso = toLocalIso(day);
      const known = byDate.get(iso);
      weekDays.push({
        date: iso,
        level: known?.level ?? 0,
        count: known?.count ?? 0,
        hasData: Boolean(known),
      });
    }
    const month = sunday.getMonth();
    weeks.push({ month: month !== previousMonth ? GITHUB_MONTHS[month] : null, days: weekDays });
    previousMonth = month;
    sunday.setDate(sunday.getDate() - 7);
  }
  return weeks.reverse();
}

function GithubContributionsHeatmap({ contributions }: { contributions: GithubContributions }): JSX.Element {
  const weeks = buildHeatmapWeeks(contributions.days ?? []);
  const total = new Intl.NumberFormat("en").format(contributions.total ?? 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {total} contributions in the last year
      </p>
      <div className="flex flex-col gap-1">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {weeks.map((week, index) => (
            <span
              key={index}
              className="h-3 overflow-visible whitespace-nowrap font-mono text-[8px] leading-3 text-muted-foreground"
            >
              {week.month ?? ""}
            </span>
          ))}
        </div>
        {/* gridAutoFlow column + 7 lignes : chaque semaine remplit une COLONNE
            (dimanche en haut, samedi en bas) comme sur GitHub. En flux par
            défaut (row), les 7 jours d'une semaine s'étalaient à l'horizontale
            sur la première ligne — la grille ne ressemblait plus au profil. */}
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
            gridTemplateRows: "repeat(7, auto)",
            gridAutoFlow: "column",
          }}
          role="img"
          aria-label={`${total} contributions in the last year`}
        >
          {weeks.flatMap((week) =>
            week.days.map((day) => (
              <div
                key={day.date}
                className="aspect-square rounded-[2px]"
                style={{ backgroundColor: GITHUB_LEVEL_COLORS[day.level] }}
                title={day.hasData ? contributionLabel(day.count, day.date) : undefined}
              />
            )),
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 font-mono text-[9px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="h-[9px] w-[9px] rounded-[1px]"
            style={{ backgroundColor: GITHUB_LEVEL_COLORS[level] }}
            aria-hidden="true"
          />
        ))}
        <span className="ml-2">More</span>
      </div>
    </div>
  );
}

export function GithubProfilePreview({ data }: { data: GithubProfileData }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar hébergé par GitHub, domaine non whitelisté dans next.config.js pour next/image */}
        <img
          src={data.avatarUrl}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-1 ring-border"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight">
            {data.name ?? data.username}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{data.username}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[12px] bg-muted px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums">
            {data.publicRepos + (data.privateRepos ?? 0)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {data.privateRepos ? `Repos · ${data.privateRepos} private` : "Repos"}
          </p>
        </div>
        <div className="rounded-[12px] bg-muted px-3 py-2.5 text-center">
          <p className="text-xl font-semibold tabular-nums">{data.followers}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Followers</p>
        </div>
      </div>
      {data.contributions && data.contributions.days.length > 0 ? (
        <GithubContributionsHeatmap contributions={data.contributions} />
      ) : null}
    </div>
  );
}

// github_recent_commits : liste des derniers commits (sha, message, auteur,
// date) — même lecture qu'une cave à commits : chaque ligne est compacte, la
// date est relative (comme la liste du widget de démo).
export function GithubCommitsPreview({ data }: { data: GithubCommit[] }): JSX.Element {
  const commits = data ?? [];
  const now = Date.now();
  if (commits.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent commits.</p>;
  }
  return (
    <ul className="flex flex-col" aria-label="Commit list">
      {commits.map((commit) => (
        <li
          key={commit.sha}
          className="flex items-start gap-3 border-b border-border py-3 first:pt-0 last:border-none last:pb-0"
        >
          <GitCommitIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{commit.message}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {commit.author} · {commit.sha}
            </p>
          </div>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatRelativeTime(commit.date, now)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// github_security_alerts : alertes de sécurité du dépôt (résumé + sévérité +
// état), avec une pastille colorée par sévérité.
export function GithubAlertsPreview({ data }: { data: GithubSecurityAlert[] }): JSX.Element {
  const alerts = data ?? [];
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">No security alerts.</p>;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Security alerts">
      {alerts.map((alert, index) => (
        <li
          key={`${alert.summary}-${index}`}
          className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5"
        >
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
              alert.severity === "critical"
                ? "bg-red-500/15 text-red-500"
                : alert.severity === "high"
                  ? "bg-orange-500/15 text-orange-500"
                  : alert.severity === "medium"
                    ? "bg-yellow-500/15 text-yellow-500"
                    : "bg-muted text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <ShieldIcon className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{alert.summary}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              {alert.severity} · {alert.state}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
