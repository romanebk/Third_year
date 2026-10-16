import type { JSX } from "react";

import { formatHours } from "@/components/widgets/previews/format";

export interface MapLocationData {
  address: string;
  displayName: string;
  latitude: number;
  longitude: number;
  zoom: number;
}

export interface MapDistanceData {
  origin: string;
  originDisplayName: string;
  destination: string;
  destinationDisplayName: string;
  distanceKm: number;
  durationMinutes: number;
}

// Le paramètre "zoom" (0=monde, 19=bâtiment) se traduit en une largeur de
// cadrage (delta en degrés) autour du point : approximation suffisante pour
// une carte de widget dashboard, pas besoin de la précision d'un vrai calcul
// de tuiles slippy-map.
function zoomToBboxDelta(zoom: number): number {
  return 180 / 2 ** zoom;
}

// map_location : petite carte OpenStreetMap centrée sur l'adresse (iframe
// d'embed officiel d'OSM, aucune clé requise — cf. openstreetmap.org/export),
// adresse résolue en dessous.
export function MapLocationPreview({ data }: { data: MapLocationData }): JSX.Element {
  const delta = zoomToBboxDelta(data.zoom);
  const bbox = [
    data.longitude - delta,
    data.latitude - delta,
    data.longitude + delta,
    data.latitude + delta,
  ].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${data.latitude}%2C${data.longitude}`;

  return (
    <div className="flex h-full flex-col gap-2">
      <iframe
        src={src}
        title={`Map centered on ${data.address}`}
        className="h-full min-h-[160px] w-full flex-1 rounded-[12px] border border-border"
        loading="lazy"
      />
      <p className="truncate text-xs text-muted-foreground">{data.displayName}</p>
    </div>
  );
}

// map_distance : distance + durée du trajet routier entre deux adresses
// (résolues en dessous, au cas où l'adresse saisie était ambiguë).
export function MapDistancePreview({ data }: { data: MapDistanceData }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
          {data.distanceKm.toFixed(1)}
          <span className="ml-1 text-lg font-medium text-muted-foreground">km</span>
        </p>
        <p className="text-lg font-medium text-muted-foreground">
          {formatHours(Math.round(data.durationMinutes))}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <p className="truncate">
          <span className="font-medium text-foreground">From</span> {data.originDisplayName}
        </p>
        <p className="truncate">
          <span className="font-medium text-foreground">To</span> {data.destinationDisplayName}
        </p>
      </div>
    </div>
  );
}
