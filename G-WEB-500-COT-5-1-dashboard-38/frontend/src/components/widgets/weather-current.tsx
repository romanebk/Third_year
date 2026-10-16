import { weatherMeta, weatherMetaNight, weatherTone } from "@/components/widgets/weather-widget";

export interface WeatherCurrentData {
  city: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  weatherCode: number;
  isDay: boolean;
  // Absents d'une réponse en cache antérieure à leur ajout : affichés
  // seulement s'ils sont là.
  apparentTemperature?: number;
  humidity?: number;
  windKmh?: number;
  todayMax?: number | null;
  todayMin?: number | null;
}

// weather_city_current : température actuelle sur un panneau teinté selon la
// condition (soleil, pluie, nuit...), puis ressenti / humidité / vent.
export default function WeatherCurrent({ data }: { data: WeatherCurrentData }) {
  const { label, Icon } = data.isDay ? weatherMeta(data.weatherCode) : weatherMetaNight(data.weatherCode);
  const tone = weatherTone(data.weatherCode, data.isDay);
  const unitSuffix = data.unit === "fahrenheit" ? "°F" : "°C";
  const hasRange = typeof data.todayMax === "number" && typeof data.todayMin === "number";

  const details = [
    typeof data.apparentTemperature === "number"
      ? { label: "Feels like", value: `${Math.round(data.apparentTemperature)}°` }
      : null,
    typeof data.humidity === "number" ? { label: "Humidity", value: `${Math.round(data.humidity)}%` } : null,
    typeof data.windKmh === "number" ? { label: "Wind", value: `${Math.round(data.windKmh)} km/h` } : null,
  ].filter((detail): detail is { label: string; value: string } => detail !== null);

  return (
    <div
      className="flex min-h-full flex-1 flex-col justify-between gap-4 rounded-2xl p-4 ring-1 ring-inset ring-white/[0.08]"
      style={{ background: tone.background }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-5xl font-semibold leading-none tracking-tight tabular-nums">
            {Math.round(data.temperature)}
            <span className="align-top text-2xl font-medium text-foreground/70">{unitSuffix}</span>
          </p>
          <p className="mt-2 truncate text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-foreground/70">
            {data.city}
            {hasRange ? ` · H ${Math.round(data.todayMax as number)}° L ${Math.round(data.todayMin as number)}°` : ""}
          </p>
        </div>
        <Icon className={`size-14 flex-shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] ${tone.iconClass}`} aria-hidden="true" />
      </div>

      {details.length > 0 ? (
        <dl className="grid grid-cols-3 gap-2">
          {details.map((detail) => (
            <div key={detail.label} className="min-w-0 rounded-xl bg-black/25 px-2.5 py-2">
              <dt className="truncate text-[10px] uppercase tracking-wider text-foreground/60">{detail.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
