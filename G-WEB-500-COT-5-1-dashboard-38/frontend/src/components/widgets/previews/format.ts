// Helpers de formatage partagés par les différents rendus de widgets
// (previews/<service>.tsx). Extraits de instance-widget.tsx pour éviter que
// chaque service ne les duplique.

export function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 519000000 -> "519M", 1234 -> "1.2K" : les compteurs YouTube sont trop
// grands pour être lisibles en entier dans un widget.
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatRelativeTime(iso: string, now: number): string {
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(seconds, "second");
}

export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
