import { WidgetFetchError, WidgetRateLimitError, WidgetValidationError } from "@/server/widgets/errors";

// Devises via Frankfurter (taux de référence BCE, sans clé) : https://frankfurter.dev
// - dernier taux : GET /v1/latest?base=EUR&symbols=USD
// - historique  : GET /v1/2026-09-01..2026-10-09?base=EUR&symbols=USD
// La BCE ne publie qu'une trentaine de devises : le franc CFA (XOF/XAF) n'en
// fait pas partie, mais il est arrimé à l'euro à un taux fixe par traité
// (1 EUR = 655,957 XOF/XAF) — on le résout donc via un pivot EUR, exact et
// sans appel supplémentaire, plutôt que de rejeter la paire.
// Sans timeout explicite, un fetch() sans réponse bloque la requête entrante
// indéfiniment (même raisonnement que weather/crypto).
const FETCH_TIMEOUT_MS = 8000;
const FRANKFURTER_API = "https://api.frankfurter.dev/v1";

// Unités de la devise pour 1 EUR (taux fixe par traité, pas une estimation).
const EUR_PEGGED_RATES: Record<string, number> = {
  XOF: 655.957,
  XAF: 655.957,
};

function normalizeCurrency(value: string | undefined, field: string): string {
  const code = (value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new WidgetValidationError(`${field} must be a 3-letter currency code (e.g. EUR)`);
  }
  return code;
}

async function frankfurterGet(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${FRANKFURTER_API}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch {
    throw new WidgetFetchError("could not reach the exchange rate service");
  }

  if (response.status === 429) {
    throw new WidgetRateLimitError("exchange rate service rate limit exceeded, try again shortly");
  }
  if (response.status === 404 || response.status === 400) {
    throw new WidgetValidationError("unknown currency pair for this service");
  }
  if (!response.ok) {
    throw new WidgetFetchError(`exchange rate service responded with status ${response.status}`);
  }
  return response.json();
}

// Taux "unités de code pour 1 EUR" : 1 pour EUR, fixe traité pour XOF/XAF,
// sinon lu dans la réponse Frankfurter (base=EUR). Lève WidgetValidationError
// si la devise est inconnue du service.
function eurRate(code: string, rates: Record<string, number>): number {
  if (code === "EUR") return 1;
  const pegged = EUR_PEGGED_RATES[code];
  if (pegged !== undefined) return pegged;
  const rate = rates[code];
  if (rate === undefined) {
    throw new WidgetValidationError(`unknown currency pair for this service`);
  }
  return rate;
}

// Devises à demander à Frankfurter : ni EUR (vaut 1), ni arrimées (constantes).
function fetchableSymbols(...codes: string[]): string[] {
  return [...new Set(codes)].filter((code) => code !== "EUR" && EUR_PEGGED_RATES[code] === undefined);
}

function pairError(from: string, to: string): WidgetValidationError {
  return new WidgetValidationError(`unknown currency pair: ${from}/${to}`);
}

export interface DevisesRateParams {
  base: string;
  target: string;
}

export interface DevisesRateResult {
  base: string;
  target: string;
  rate: number;
  date: string;
}

export async function fetchDevisesRate({ base, target }: DevisesRateParams): Promise<DevisesRateResult> {
  const from = normalizeCurrency(base, "base");
  const to = normalizeCurrency(target, "target");

  // Par définition 1 EUR = 1 EUR : pas d'appel réseau pour une paire identique.
  if (from === to) {
    return { base: from, target: to, rate: 1, date: new Date().toISOString().slice(0, 10) };
  }

  const symbols = fetchableSymbols(from, to);
  let rates: Record<string, number> = {};
  let date = new Date().toISOString().slice(0, 10);
  if (symbols.length > 0) {
    const data = (await frankfurterGet(
      `/latest?base=EUR&symbols=${symbols.map(encodeURIComponent).join(",")}`,
    )) as { date?: string; rates?: Record<string, number> };
    rates = data.rates ?? {};
    date = data.date ?? date;
  }

  let fromEur: number;
  let toEur: number;
  try {
    fromEur = eurRate(from, rates);
    toEur = eurRate(to, rates);
  } catch {
    throw pairError(from, to);
  }
  return { base: from, target: to, rate: toEur / fromEur, date };
}

export interface DevisesHistoryParams {
  base: string;
  target: string;
  days?: number;
}

export interface DevisesHistoryPoint {
  date: string;
  rate: number;
}

export interface DevisesHistoryResult {
  base: string;
  target: string;
  points: DevisesHistoryPoint[];
  currentRate: number;
  changePercent: number | null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchDevisesHistory({
  base,
  target,
  days,
}: DevisesHistoryParams): Promise<DevisesHistoryResult> {
  const from = normalizeCurrency(base, "base");
  const to = normalizeCurrency(target, "target");
  // GET direct (?days=abc) arrive ici en NaN via Number() dans data.ts :
  // retomber sur le défaut plutôt que de produire une date invalide
  // (toISOString sur Invalid Date lèverait un RangeError non contrôlé).
  const rawDays = typeof days === "number" ? days : Number(days);
  const safeDays = Number.isFinite(rawDays) ? rawDays : 30;
  // 2 points minimum pour tracer une courbe, 90 max pour garder la payload
  // affichable (même logique de borne que weather 1-16 / crypto 1-20).
  const count = Math.min(Math.max(Math.trunc(safeDays), 2), 90);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (count - 1));

  const symbols = fetchableSymbols(from, to);
  if (symbols.length === 0) {
    // Paire constante (EUR/XOF, XOF/XAF…) : droite plate, pas d'appel réseau.
    const rate = eurRate(to, {}) / eurRate(from, {});
    const points: DevisesHistoryPoint[] = [];
    for (let i = 0; i < count; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      points.push({ date: toIsoDate(day), rate });
    }
    return { base: from, target: to, points, currentRate: rate, changePercent: 0 };
  }

  const data = (await frankfurterGet(
    `/${toIsoDate(start)}..${toIsoDate(end)}?base=EUR&symbols=${symbols.map(encodeURIComponent).join(",")}`,
  )) as { rates?: Record<string, Record<string, number>> };
  const daily = data.rates ?? {};

  const points: DevisesHistoryPoint[] = [];
  for (const date of Object.keys(daily).sort()) {
    let fromEur: number;
    let toEur: number;
    try {
      fromEur = eurRate(from, daily[date]);
      toEur = eurRate(to, daily[date]);
    } catch {
      throw pairError(from, to);
    }
    points.push({ date, rate: toEur / fromEur });
  }

  if (points.length === 0) {
    throw pairError(from, to);
  }

  const first = points[0].rate;
  const last = points[points.length - 1].rate;
  return {
    base: from,
    target: to,
    points,
    currentRate: last,
    changePercent: first ? ((last - first) / first) * 100 : null,
  };
}
