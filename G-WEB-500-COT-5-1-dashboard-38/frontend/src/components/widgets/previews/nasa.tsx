import type { JSX } from "react";

// Forme renvoyée par backend/src/server/services/nasa/fetch.ts (fetchApod et
// fetchApodRandom partagent le même résultat).
export interface NasaApodData {
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  date?: string;
}

// nasa_apod / nasa_apod_random : l'image (ou la vidéo) en grand plutôt qu'un
// simple lien — c'est tout l'intérêt du widget. Les vidéos APOD sont des
// lecteurs embarquables (YouTube/Vimeo), affichés en iframe 16:9.
export function NasaApodPreview({ data }: { data: NasaApodData }): JSX.Element {
  const fullUrl = data.hdurl ?? data.url;
  return (
    <div className="flex flex-col gap-3">
      {data.media_type === "video" ? (
        <iframe
          src={data.url}
          title={data.title}
          allowFullScreen
          loading="lazy"
          className="aspect-video w-full rounded-xl border border-white/10 bg-black"
        />
      ) : (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- image hébergée par la NASA, domaine non whitelisté dans next.config.js pour next/image */}
          <img
            src={data.url}
            alt={data.title}
            loading="lazy"
            className="aspect-video w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
          />
        </a>
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-semibold leading-tight">{data.title}</p>
        {data.date ? <p className="mt-0.5 text-xs text-muted-foreground">{data.date}</p> : null}
        <p className="mt-1 line-clamp-4 text-[13px] leading-snug text-foreground/90">
          {data.explanation}
        </p>
      </div>
    </div>
  );
}
