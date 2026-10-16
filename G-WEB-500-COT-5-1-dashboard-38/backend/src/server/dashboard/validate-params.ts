import { getServiceByName } from "@/server/services";
import { decryptToken, encryptToken } from "@/server/auth/token-encryption";
import type { ConfigParam, ServiceInfo, WidgetInfo } from "@/types";
import { minRefreshRateSeconds } from "@/server/services/refresh-rates";

export class DashboardValidationError extends Error {}

export interface WidgetDefinition {
  service: ServiceInfo;
  widget: WidgetInfo;
}

// Un widget invalide (service/nom inconnu) ne doit jamais pouvoir devenir une
// instance en base — on valide contre le même registre qui alimente /about.json,
// pas de duplication de la liste des widgets connus. Renvoie aussi le service
// (pas juste le widget) : validateInstanceParams en a besoin pour le cas
// api_key ci-dessous.
export function getWidgetDefinition(service: string, widget: string): WidgetDefinition {
  const serviceInfo = getServiceByName(service);
  if (!serviceInfo) {
    throw new DashboardValidationError(`unknown service: ${service}`);
  }
  const widgetInfo = serviceInfo.widgets.find((w) => w.name === widget);
  if (!widgetInfo) {
    throw new DashboardValidationError(`unknown widget: ${widget}`);
  }
  return { service: serviceInfo, widget: widgetInfo };
}

// Clé optionnelle, jamais déclarée dans WidgetInfo.params (donc jamais dans
// /about.json — le sujet impose la forme exacte de ce endpoint, pas question
// d'y ajouter un champ pour ça) : sur un service "apikey" (aujourd'hui Steam),
// une instance peut fournir sa propre clé au lieu de dépendre de la clé
// serveur (STEAM_API_KEY). Trouvé cassé lors d'un audit : sans ce cas
// spécial, "unknown params: api_key" rejetait toute tentative — seul le
// panneau de démo (qui ne passe pas par validateInstanceParams) fonctionnait.
const OPTIONAL_API_KEY_PARAM = "api_key";

// Vérifie que rawParams correspond aux params déclarés du widget (bon nom, bon
// type, rien en trop — plus l'exception api_key ci-dessus) et renvoie une
// version typée (string -> string, integer -> number) prête à être stockée.
// Des params en trop ou d'un mauvais type indiquent presque toujours une
// erreur de configuration côté client — les rejeter tôt évite une instance
// invalide qui échouerait silencieusement au fetch.
export function validateInstanceParams(
  definition: WidgetDefinition,
  rawParams: unknown,
): Record<string, string | number> {
  if (typeof rawParams !== "object" || rawParams === null || Array.isArray(rawParams)) {
    throw new DashboardValidationError("params must be an object");
  }
  const input = rawParams as Record<string, unknown>;
  const { widget, service } = definition;
  const allowApiKey = service.auth === "apikey";
  const declaredNames = new Set(widget.params.map((p) => p.name));
  if (allowApiKey) declaredNames.add(OPTIONAL_API_KEY_PARAM);

  const unknownKeys = Object.keys(input).filter((key) => !declaredNames.has(key));
  if (unknownKeys.length > 0) {
    throw new DashboardValidationError(`unknown params: ${unknownKeys.join(", ")}`);
  }

  const result: Record<string, string | number> = {};
  for (const param of widget.params) {
    result[param.name] = coerceParam(param, input[param.name]);
  }

  if (allowApiKey && typeof input[OPTIONAL_API_KEY_PARAM] === "string" && input[OPTIONAL_API_KEY_PARAM]) {
    // Chiffré avant stockage (même AES-GCM que les tokens OAuth, cf.
    // encrypted-adapter.ts) — trouvé en clair dans WidgetInstance.params lors
    // d'un audit de sécurité. Déchiffré à la lecture par
    // decryptApiKeyParam() ci-dessous, seul endroit qui en a besoin.
    result[OPTIONAL_API_KEY_PARAM] = encryptToken(input[OPTIONAL_API_KEY_PARAM] as string);
  }

  return result;
}

// Déchiffre un api_key lu depuis WidgetInstance.params (cf. validateInstanceParams
// ci-dessus, seul endroit qui l'écrit). Le fallback sur la valeur brute couvre les
// instances créées avant ce chiffrement (déjà en clair en base) — sans lui, elles
// échoueraient à chaque fetch au lieu de continuer à fonctionner avec l'ancienne
// valeur en clair.
export function decryptApiKeyParam(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    return decryptToken(value);
  } catch {
    return value;
  }
}

function coerceParam(param: ConfigParam, value: unknown): string | number {
  if (param.type === "string") {
    if (value === undefined || value === "") {
      if (param.optional) return "";
      throw new DashboardValidationError(`param "${param.name}" must be a non-empty string`);
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new DashboardValidationError(`param "${param.name}" must be a non-empty string`);
    }
    return value;
  }

  // type === "integer"
  const num = typeof value === "number" ? value : Number(value);
  if (typeof value === "undefined" || value === "" || !Number.isInteger(num)) {
    throw new DashboardValidationError(`param "${param.name}" must be an integer`);
  }
  return num;
}

// refreshRateSeconds d'une instance : entier >= au minimum de son service
// (cf. server/services/refresh-rates.ts). Partagé par POST /api/dashboard et
// PATCH /api/dashboard/[id].
export function validateRefreshRate(service: string, value: unknown): number {
  const refreshRateSeconds = Number(value);
  const min = minRefreshRateSeconds(service);
  if (!Number.isInteger(refreshRateSeconds) || refreshRateSeconds < min) {
    throw new DashboardValidationError(`refreshRateSeconds must be an integer >= ${min} for ${service}`);
  }
  return refreshRateSeconds;
}
