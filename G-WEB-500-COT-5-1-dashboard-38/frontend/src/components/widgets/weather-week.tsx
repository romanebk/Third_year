"use client";

import { useState } from "react";

// Une journée entière n'a pas de phase jour/nuit : on garde la table de jour
// (weatherMeta), la même que celle du widget courant, pour que les deux cartes
// d'une même ville se lisent pareil.
import { weatherMeta, weatherMetaNight, weatherTone } from "@/components/widgets/weather-widget";
import { cn } from "@/lib/utils";

interface WeekDay {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  weatherCode: number;
  // Absent d'une réponse en cache antérieure à son ajout.
  precipitationChance?: number | null;
  humidityMax: number;
  windMaxKmh: number;
  apparentMax: number;
  pressureHpa: number;
}

interface WeekPayload {
  city: string;
  days: WeekDay[];
  aqi?: number | null;
  current?: { temperature: number; weatherCode: number; isDay: boolean } | null;
}

// Condition affichée pour un jour : pour aujourd'hui, le temps qu'il fait
// maintenant (identique au widget Current weather) ; pour les autres jours, la
// condition dominante en journée calculée par le backend.
function dayCondition(day: WeekDay, index: number, current: WeekPayload["current"]) {
  if (index === 0 && current) {
    const meta = current.isDay ? weatherMeta(current.weatherCode) : weatherMetaNight(current.weatherCode);
    return { ...meta, tone: weatherTone(current.weatherCode, current.isDay) };
  }
  return { ...weatherMeta(day.weatherCode), tone: weatherTone(day.weatherCode) };
}

// Open-Meteo renvoie des dates "YYYY-MM-DD" (journée civile de la ville visée).
// new Date("2026-09-28") serait interprété en UTC puis affiché en heure locale,
// ce qui décale le libellé d'un jour à l'ouest de Greenwich. On ancre donc la
// date à midi en heure locale : aucun décalage possible.
function dayLabel(date: string, index: number, style: "long" | "short"): string {
  if (index === 0) return "Today";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("en", { weekday: style }).format(new Date(year, month - 1, day, 12));
}

function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for some";
  return "Unhealthy";
}

// weather_city_forecast : le jour sélectionné en détail (panneau teinté selon
// sa condition) + une tuile par jour, toutes identiques et cliquables. Les
// valeurs sont celles de la journée entière : maximum / minimum et condition
// dominante — d'où les libellés "High" / "Low" pour ne pas les confondre avec
// la température actuelle du widget Current weather.
export default function WeatherWeek({
  data,
  unit = "celsius",
}: {
  data: WeekPayload;
  unit?: "celsius" | "fahrenheit";
}) {
  const days = data.days ?? [];
  const [selected, setSelected] = useState(0);
  const unitSuffix = unit === "fahrenheit" ? "°F" : "°C";

  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">No forecast available.</p>;
  }

  const index = Math.min(selected, days.length - 1);
  const day = days[index];
  const { label, Icon, tone } = dayCondition(day, index, data.current);
  const isNow = index === 0 && Boolean(data.current);
  // Échelle commune à toutes les tuiles pour la barre d'amplitude min–max.
  const weekMin = Math.min(...days.map((d) => d.temperatureMin));
  const weekMax = Math.max(...days.map((d) => d.temperatureMax));
  const span = Math.max(weekMax - weekMin, 1);

  const details = [
    { label: "Feels like", value: `${Math.round(day.apparentMax)}°` },
    typeof day.precipitationChance === "number"
      ? { label: "Rain", value: `${Math.round(day.precipitationChance)}%` }
      : { label: "Humidity", value: `${Math.round(day.humidityMax)}%` },
    { label: "Wind", value: `${Math.round(day.windMaxKmh)} km/h` },
    // L'AQI renvoyé est la mesure actuelle : il n'a de sens que pour aujourd'hui.
    index === 0 && data.aqi != null
      ? { label: "Air", value: `${Math.round(data.aqi)} · ${aqiLabel(data.aqi)}` }
      : { label: "Pressure", value: `${Math.round(day.pressureHpa)} hPa` },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col [container-type:inline-size]">
      <div className="flex min-h-0 flex-1 flex-col gap-2 [@container(min-width:600px)]:flex-row [@container(min-width:600px)]:gap-3">
        <section
          aria-live="polite"
          aria-label={`${dayLabel(day.date, index, "long")} in ${data.city}`}
          className="flex shrink-0 flex-col justify-between gap-3 rounded-2xl p-3 ring-1 ring-inset ring-white/[0.08] [@container(min-width:600px)]:w-[250px] [@container(min-width:600px)]:p-4"
          style={{ background: tone.background }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-foreground/70">
                {dayLabel(day.date, index, "long")} · High / Low
              </p>
              <p className="mt-1 flex items-baseline gap-2 tabular-nums">
                <span className="text-3xl font-semibold leading-none tracking-tight [@container(min-width:600px)]:text-4xl">
                  {Math.round(day.temperatureMax)}
                  <span className="align-top text-lg font-medium text-foreground/70">{unitSuffix}</span>
                </span>
                <span className="text-sm text-foreground/70">/ {Math.round(day.temperatureMin)}°</span>
              </p>
              <p className="mt-1 truncate text-sm font-medium">
                {label}
                {isNow ? <span className="font-normal text-foreground/70"> · now</span> : null}
              </p>
            </div>
            <Icon className={cn("size-9 flex-shrink-0 [@container(min-width:600px)]:size-11", tone.iconClass)} aria-hidden="true" />
          </div>
          <dl className="hidden grid-cols-2 gap-x-3 gap-y-1.5 text-xs [@container(min-width:600px)]:grid">
            {details.map((detail) => (
              <div key={detail.label} className="flex min-w-0 items-baseline justify-between gap-2">
                <dt className="text-foreground/60">{detail.label}</dt>
                <dd className="truncate font-semibold tabular-nums">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <ul
          className="grid min-h-0 flex-1 auto-cols-[minmax(68px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
          aria-label={`${days.length}-day forecast for ${data.city}`}
        >
          {days.map((d, i) => {
            const meta = dayCondition(d, i, data.current);
            const dayTone = meta.tone;
            const active = i === index;
            const left = ((d.temperatureMin - weekMin) / span) * 100;
            const width = Math.max(((d.temperatureMax - d.temperatureMin) / span) * 100, 6);
            return (
              <li key={d.date} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={active}
                  aria-label={`${dayLabel(d.date, i, "long")}: ${meta.label}, high ${Math.round(d.temperatureMax)}°, low ${Math.round(d.temperatureMin)}°`}
                  className={cn(
                    "flex h-full min-h-[88px] w-full cursor-pointer flex-col items-center justify-between gap-1 rounded-xl px-2 py-2 [@container(min-width:600px)]:min-h-[112px] [@container(min-width:600px)]:py-2.5 ring-1 ring-inset transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-white/[0.09] ring-white/25"
                      : "bg-white/[0.03] ring-white/[0.06] hover:bg-white/[0.06]",
                  )}
                >
                  <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                    {dayLabel(d.date, i, "short")}
                  </span>
                  <meta.Icon className={cn("size-6", dayTone.iconClass)} aria-hidden="true" />
                  <span className="flex items-baseline gap-1.5 leading-tight tabular-nums [@container(min-width:600px)]:flex-col [@container(min-width:600px)]:items-center [@container(min-width:600px)]:gap-0">
                    <span className="text-sm font-semibold">{Math.round(d.temperatureMax)}°</span>
                    <span className="text-xs text-muted-foreground">{Math.round(d.temperatureMin)}°</span>
                  </span>
                  <span className="relative h-1 w-full rounded-full bg-white/10" aria-hidden="true">
                    <span
                      className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400 to-amber-400"
                      style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
