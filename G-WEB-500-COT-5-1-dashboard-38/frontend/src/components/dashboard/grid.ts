import type { Layout } from "react-grid-layout";

// v4 : taille par défaut adaptée à chaque widget (cf. WIDGET_SIZES) au lieu
// d'un bloc uniforme 4×6 qui laissait de grands vides dans les petits widgets
// — bump pour que les layouts "v3" déjà sauvegardés profitent des nouvelles
// tailles.
export const LAYOUT_STORAGE_KEY = "hubly.dashboard.layout.v4";

// Grille drag & drop (react-grid-layout v2) : chaque panneau est une vraie
// instance de widget du compte (service/widget/params/id, cf. /api/dashboard) —
// plus aucun panneau "overview" en localStorage. La géométrie (x/y/w/h) reste en
// localStorage (préférence d'affichage du navigateur), la source de vérité des
// widgets est le serveur.
export type GridBp = "lg" | "md" | "sm" | "xs";
export type GridLayouts = { lg: Layout; md: Layout; sm: Layout; xs: Layout };

export const GRID_ROW_HEIGHT = 60;
export const GRID_MARGIN: readonly [number, number] = [16, 16];
export const GRID_BREAKPOINTS: Record<GridBp, number> = { lg: 1024, md: 768, sm: 640, xs: 0 };
export const GRID_COLS: Record<string, number> = { lg: 12, md: 8, sm: 4, xs: 1 };

// Cherche la première place libre (en balayant de haut en bas, gauche à droite)
// pour un item w×h dans une grille de `cols` colonnes — deux panneaux assez
// étroits pour tenir sur la même ligne se placent côte à côte plutôt que de
// s'empiler verticalement.
export function findFreeSlot(items: Layout, w: number, h: number, cols: number): { x: number; y: number } {
  const maxY = items.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const overlaps = items.some(
        (item) => x < item.x + item.w && x + w > item.x && y < item.y + item.h && y + h > item.y,
      );
      if (!overlaps) return { x, y };
    }
  }
  return { x: 0, y: maxY };
}

export function defaultLayouts(): GridLayouts {
  return { lg: [], md: [], sm: [], xs: [] };
}

export function loadLayouts(): GridLayouts {
  if (typeof window === "undefined") return defaultLayouts();
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return defaultLayouts();
    const parsed = JSON.parse(raw) as Partial<GridLayouts>;
    return {
      lg: (parsed.lg as Layout | undefined) ?? [],
      md: (parsed.md as Layout | undefined) ?? [],
      sm: (parsed.sm as Layout | undefined) ?? [],
      xs: (parsed.xs as Layout | undefined) ?? [],
    };
  } catch {
    return defaultLayouts();
  }
}

export function persistLayouts(next: GridLayouts): void {
  try {
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ lg: next.lg, md: next.md, sm: next.sm, xs: next.xs }),
    );
  } catch {
    // stockage indisponible : au pire le layout retombe sur les défauts
  }
}

// Taille par défaut (grille "lg", 12 colonnes, rangées de 60 px) selon le
// contenu réel du widget : un prix ou une météo courante tient en 4 rangées,
// une liste de vidéos ou un fil d'actualités en demande davantage. Les grilles
// plus étroites dérivent de celle-ci (cf. sizeFor).
const WIDGET_SIZES: Record<string, { w: number; h: number }> = {
  weather_city_current: { w: 4, h: 4 },
  weather_city_forecast: { w: 8, h: 4 },
  rss_interest_feed: { w: 4, h: 9 },
  rss_article_list: { w: 4, h: 7 },
  crypto_price: { w: 4, h: 4 },
  crypto_top_coins: { w: 4, h: 5 },
  youtube_channel_stats: { w: 4, h: 4 },
  youtube_latest_videos: { w: 4, h: 6 },
  youtube_trending: { w: 4, h: 6 },
  github_user_profile: { w: 4, h: 5 },
  github_recent_commits: { w: 4, h: 6 },
  github_security_alerts: { w: 4, h: 5 },
  map_location: { w: 4, h: 6 },
  map_distance: { w: 4, h: 4 },
  steam_most_played: { w: 4, h: 6 },
  steam_game_news: { w: 4, h: 6 },
};
const DEFAULT_WIDGET_SIZE = { w: 4, h: 6 };

export function sizeFor(widget: string, bp: GridBp): { w: number; h: number } {
  const { w, h } = WIDGET_SIZES[widget] ?? DEFAULT_WIDGET_SIZE;
  const wide = w >= 8;
  if (bp === "lg") return { w, h };
  if (bp === "md") return { w: wide ? 8 : 4, h };
  if (bp === "sm") return { w: wide ? 4 : 2, h };
  return { w: 1, h };
}
