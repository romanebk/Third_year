import type { JSX } from "react";

import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/components/widgets/previews/format";

export interface DevisesRateData {
  base: string;
  target: string;
  rate: number;
  date: string;
}

export interface DevisesHistoryPoint {
  date: string;
  rate: number;
}

export interface DevisesHistoryData {
  base: string;
  target: string;
  points: DevisesHistoryPoint[];
  currentRate: number;
  changePercent: number | null;
}

// devise_rate : ligne façon app Bourse — pilule paire en tête, cours héros,
// contre-valeur (taux inverse, l'info qui manque quand on voyage) et date de
// référence BCE en français en bas. Aligné à gauche, pas centré.
export function DevisesRatePreview({ data }: { data: DevisesRateData }): JSX.Element {
  const formatted = data.rate.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const inverse = 1 / data.rate;
  const refDate = new Intl.DateTimeFormat("fr", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(data.date));

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tracking-wide">
        {data.base}
        <span aria-hidden="true" className="text-muted-foreground">→</span>
        {data.target}
      </span>
      <p className="text-4xl font-semibold leading-none tracking-tight tabular-nums">
        {formatted}
        <span className="ml-1.5 text-xl font-medium text-muted-foreground">{data.target}</span>
      </p>
      <div className="flex flex-col gap-0.5 text-[13px] text-muted-foreground">
        <p className="tabular-nums">
          1 {data.base} = {formatted} {data.target}
        </p>
        <p className="tabular-nums">
          1 {data.target} = {inverse.toLocaleString("en-US", { maximumFractionDigits: 4 })} {data.base}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Référence BCE · {refDate}</p>
    </div>
  );
}

// devise_history : même ligne Bourse + pastille de variation arrondie et
// courbe avec remplissage (le seul geste visuel fort des deux widgets).
// La couleur de la courbe encode la tendance sur la période.
export function DevisesHistoryPreview({ data }: { data: DevisesHistoryData }): JSX.Element {
  const points = data.points ?? [];
  const change = data.changePercent;
  const up = (change ?? 0) >= 0;
  const rates = points.map((point) => point.rate);
  const min = Math.min(...rates, data.currentRate);
  const max = Math.max(...rates, data.currentRate);
  const span = max - min || 1;
  const spark = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 30 - ((point.rate - min) / span) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = points.length > 1 ? `0,32 ${spark} 100,32` : "";
  const stroke = up ? "#10B981" : "#EF4444";
  const gradientId = `devises-${data.base}-${data.target}`.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tracking-wide">
          {data.base}
          <span aria-hidden="true" className="text-muted-foreground">→</span>
          {data.target}
        </span>
        {change !== null ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs tabular-nums",
              up ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500",
            )}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums">
        {data.currentRate.toLocaleString("en-US", { maximumFractionDigits: 4 })}
        <span className="ml-1.5 text-base font-medium text-muted-foreground">{data.target}</span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">Sur {points.length} jours</p>
      {points.length > 1 ? (
        <svg viewBox="0 0 100 32" className="h-20 w-full" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline points={spark} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : null}
    </div>
  );
}
