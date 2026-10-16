import type { JSX } from "react";

import { YoutubeIcon } from "@/components/icons";
import { formatCompactNumber, formatRelativeTime } from "@/components/widgets/previews/format";

// Shapes renvoyées par backend/src/server/services/youtube/fetch.ts.
export interface YoutubeChannelStatsData {
  channelId: string;
  title: string;
  handle: string | null;
  avatarUrl: string | null;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
}

export interface YoutubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  url: string;
}

export interface YoutubeVideoListData {
  videos: YoutubeVideo[];
}

// youtube_channel_stats : avatar + nom/handle en tête (même gabarit que
// github_user_profile), puis les trois compteurs de la chaîne en format compact
// (519M plutôt que 519000000). Abonnés masqués par la chaîne -> "Hidden".
export function YoutubeChannelStatsPreview({ data }: { data: YoutubeChannelStatsData }): JSX.Element {
  const stats: Array<{ label: string; value: number | null }> = [
    { label: "Subscribers", value: data.subscribers },
    { label: "Views", value: data.views },
    { label: "Videos", value: data.videos },
  ];
  return (
    <div className="flex flex-col gap-4">
      <a
        href={`https://www.youtube.com/channel/${data.channelId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-md hover:bg-muted/60"
      >
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar hébergé par YouTube, domaine non whitelisté dans next.config.js pour next/image
          <img
            src={data.avatarUrl}
            alt=""
            // yt3.ggpht.com refuse (403) les requêtes portant un Referer d'un
            // autre site : sans ça l'avatar restait une image cassée.
            referrerPolicy="no-referrer"
            className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-muted">
            <YoutubeIcon className="h-5 w-5 text-foreground/40" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight">{data.title}</p>
          {data.handle ? <p className="truncate text-xs text-muted-foreground">{data.handle}</p> : null}
        </div>
      </a>
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[12px] bg-muted px-2 py-2.5 text-center">
            <p className="text-lg font-semibold tabular-nums">
              {stat.value === null ? "Hidden" : formatCompactNumber(stat.value)}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// youtube_latest_videos / youtube_trending : même liste — miniature 16:9 à
// gauche, titre sur deux lignes, puis vues et date relative. Pour les
// tendances, le nom de la chaîne est ajouté (les vidéos viennent de chaînes
// différentes) ; chaque ligne ouvre la vidéo sur YouTube.
export function YoutubeVideoListPreview({
  data,
  showChannel,
}: {
  data: YoutubeVideoListData;
  showChannel: boolean;
}): JSX.Element {
  const videos = data.videos ?? [];
  const now = Date.now();
  if (videos.length === 0) {
    return <p className="text-sm text-muted-foreground">No videos.</p>;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="YouTube videos">
      {videos.map((video) => {
        const meta = [
          showChannel ? video.channelTitle : null,
          video.views !== null ? `${formatCompactNumber(video.views)} views` : null,
          video.publishedAt ? formatRelativeTime(video.publishedAt, now) : null,
        ].filter(Boolean);
        return (
          <li key={video.id}>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-md p-1 hover:bg-muted/60"
            >
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniature hébergée par YouTube, domaine non whitelisté dans next.config.js pour next/image
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="aspect-video w-24 flex-shrink-0 rounded-[6px] object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex aspect-video w-24 flex-shrink-0 items-center justify-center rounded-[6px] bg-muted">
                  <YoutubeIcon className="h-4 w-4 text-foreground/40" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-medium leading-snug">{video.title}</p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{meta.join(" · ")}</p>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
