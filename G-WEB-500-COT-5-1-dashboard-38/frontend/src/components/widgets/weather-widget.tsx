import type { ComponentType, SVGProps } from "react";

import {
  CloudIcon,
  CloudLightningIcon,
  CloudMoonIcon,
  CloudRainIcon,
  CloudSnowIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";

// Ce fichier ne contenait à l'origine qu'un widget météo de démo autonome
// (localStorage, panneau de config) — jamais rendu nulle part (trouvé mort
// lors d'un audit de code). Il regroupe désormais ce que partagent les deux
// widgets météo (weather-current.tsx et weather-week.tsx) : la table code
// météo -> icône/libellé et la teinte par condition (weatherTone).
type WeatherIconProps = SVGProps<SVGSVGElement>;

export const WEATHER_META: Record<number, { label: string; Icon: ComponentType<WeatherIconProps> }> = {
  0: { label: "Clear sky", Icon: SunIcon },
  1: { label: "Mainly clear", Icon: SunIcon },
  2: { label: "Partly cloudy", Icon: CloudIcon },
  3: { label: "Overcast", Icon: CloudIcon },
  45: { label: "Fog", Icon: CloudIcon },
  48: { label: "Depositing rime fog", Icon: CloudIcon },
  51: { label: "Light drizzle", Icon: CloudRainIcon },
  53: { label: "Drizzle", Icon: CloudRainIcon },
  55: { label: "Dense drizzle", Icon: CloudRainIcon },
  56: { label: "Freezing drizzle", Icon: CloudRainIcon },
  57: { label: "Freezing drizzle", Icon: CloudRainIcon },
  61: { label: "Light rain", Icon: CloudRainIcon },
  63: { label: "Rain", Icon: CloudRainIcon },
  65: { label: "Heavy rain", Icon: CloudRainIcon },
  66: { label: "Freezing rain", Icon: CloudRainIcon },
  67: { label: "Freezing rain", Icon: CloudRainIcon },
  71: { label: "Light snow", Icon: CloudSnowIcon },
  73: { label: "Snow", Icon: CloudSnowIcon },
  75: { label: "Heavy snow", Icon: CloudSnowIcon },
  77: { label: "Snow grains", Icon: CloudSnowIcon },
  80: { label: "Light rain showers", Icon: CloudRainIcon },
  81: { label: "Rain showers", Icon: CloudRainIcon },
  82: { label: "Violent rain showers", Icon: CloudRainIcon },
  85: { label: "Snow showers", Icon: CloudSnowIcon },
  86: { label: "Snow showers", Icon: CloudSnowIcon },
  95: { label: "Thunderstorm", Icon: CloudLightningIcon },
  96: { label: "Thunderstorm with hail", Icon: CloudLightningIcon },
  99: { label: "Thunderstorm with hail", Icon: CloudLightningIcon },
};

export function weatherMeta(code: number): { label: string; Icon: ComponentType<WeatherIconProps> } {
  return WEATHER_META[code] ?? { label: "Unknown", Icon: CloudIcon };
}

// Le ciel de nuit : la lune remplace le soleil par ciel clair, et un nuage lunaire
// (nuage passant devant la lune) aux nuages partiels. Le backend fournit isDay
// (Open-Meteo is_day) dans la lecture courante, mais si la donnée manque (ancien
// cache, données partielles), on retombe sur la table de jour — jamais d'erreur.
export const WEATHER_META_NIGHT: Record<number, { label: string; Icon: ComponentType<WeatherIconProps> }> = {
  0: { label: "Clear sky", Icon: MoonIcon },
  1: { label: "Mainly clear", Icon: MoonIcon },
  2: { label: "Partly cloudy", Icon: CloudMoonIcon },
  3: { label: "Overcast", Icon: CloudMoonIcon },
};

export function weatherMetaNight(code: number): { label: string; Icon: ComponentType<WeatherIconProps> } {
  return WEATHER_META_NIGHT[code] ?? weatherMeta(code);
}

// Ambiance colorée d'une condition météo : dégradé de fond du panneau et
// couleur de l'icône. Partagée par Current weather et Forecast pour qu'une
// même condition ait la même teinte dans les deux widgets.
export interface WeatherTone {
  background: string;
  iconClass: string;
}

type ToneKey = "clear" | "night" | "cloudy" | "fog" | "rain" | "snow" | "storm";

const TONES: Record<ToneKey, WeatherTone> = {
  clear: {
    background: "linear-gradient(135deg, rgba(251,191,36,0.34), rgba(249,115,22,0.10) 60%, rgba(249,115,22,0.02))",
    iconClass: "text-amber-300",
  },
  night: {
    background: "linear-gradient(135deg, rgba(99,102,241,0.34), rgba(49,46,129,0.14) 60%, rgba(49,46,129,0.04))",
    iconClass: "text-indigo-200",
  },
  cloudy: {
    background: "linear-gradient(135deg, rgba(56,189,248,0.24), rgba(100,116,139,0.12) 60%, rgba(100,116,139,0.03))",
    iconClass: "text-sky-200",
  },
  fog: {
    background: "linear-gradient(135deg, rgba(148,163,184,0.26), rgba(71,85,105,0.10) 60%, rgba(71,85,105,0.03))",
    iconClass: "text-slate-200",
  },
  rain: {
    background: "linear-gradient(135deg, rgba(59,130,246,0.36), rgba(30,58,138,0.16) 60%, rgba(30,58,138,0.04))",
    iconClass: "text-blue-300",
  },
  snow: {
    background: "linear-gradient(135deg, rgba(165,243,252,0.26), rgba(186,230,253,0.08) 60%, rgba(186,230,253,0.02))",
    iconClass: "text-cyan-100",
  },
  storm: {
    background: "linear-gradient(135deg, rgba(139,92,246,0.38), rgba(49,46,129,0.16) 60%, rgba(49,46,129,0.04))",
    iconClass: "text-violet-300",
  },
};

export function weatherTone(code: number, isDay = true): WeatherTone {
  if (code >= 95) return TONES.storm;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return TONES.snow;
  if (code >= 51) return TONES.rain;
  if (code === 45 || code === 48) return TONES.fog;
  if (!isDay) return TONES.night;
  if (code <= 1) return TONES.clear;
  return TONES.cloudy;
}
