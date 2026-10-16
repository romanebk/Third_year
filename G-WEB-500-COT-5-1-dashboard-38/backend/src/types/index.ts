// Dupliqué à l'identique côté frontend/src/types/index.ts : depuis le split
// backend/frontend (deux apps Next.js indépendantes, cf. ADR 0009), il n'y a
// plus de code partageable entre elles sans package npm dédié — jugé
// disproportionné pour ces ~30 lignes, purement des types (effacés à la
// compilation, donc aucun risque runtime même en cas de divergence).
export type ConfigParamType = "integer" | "string";

export interface ConfigParam {
  name: string;
  type: ConfigParamType;
  // Absent/false : valeur obligatoire (comportement historique). true : peut
  // être omis ou vide (ex: holidays_upcoming.region, filtre facultatif) —
  // cf. validateInstanceParams qui n'exige plus une string non-vide pour ceux-ci.
  optional?: boolean;
}

export interface WidgetInfo {
  name: string;
  description: string;
  params: ConfigParam[];
}

export type ServiceAuth = "none" | "oauth" | "apikey" | "credentials";

export interface ServiceInfo {
  name: string;
  description: string;
  auth: ServiceAuth;
  widgets: WidgetInfo[];
  // Présent uniquement sur la réponse de GET /api/services (pas sur /about.json,
  // qui réutilise le même registre sans ce champ) — état de souscription de
  // l'utilisateur connecté, calculé côté serveur.
  subscribed?: boolean;
  // Même origine (GET /api/services uniquement), services "oauth" seulement :
  // provider configuré sur le serveur, et compte tiers lié par l'utilisateur.
  oauth?: ServiceOAuthStatus;
  // Même origine (GET /api/services uniquement), services à clé d'API (Steam,
  // YouTube) : la clé est-elle à fournir par l'utilisateur, en a-t-il une.
  apiKey?: ServiceApiKeyStatus;
  // Même origine (GET /api/services) : intervalle de rafraîchissement minimum
  // accepté pour les widgets de ce service.
  minRefreshRateSeconds?: number;
}

export interface ServiceOAuthStatus {
  configured: boolean;
  linked: boolean;
  // Id du provider NextAuth à utiliser pour la liaison (signIn) : le nom du
  // service la plupart du temps, "google" pour "google-calendar" qui partage
  // le compte Google (cf. oauthProviderIdForService côté backend).
  provider: string;
}

export interface ServiceApiKeyStatus {
  required: boolean;
  saved: boolean;
}

export interface AboutJsonResponse {
  client: { host: string };
  server: {
    current_time: number;
    services: ServiceInfo[];
  };
}