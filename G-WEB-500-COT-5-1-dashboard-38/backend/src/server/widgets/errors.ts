// Erreurs communes à tous les services de widgets (weather, github, steam, rss...).
// Le message est destiné à être affiché tel quel sur le widget en erreur — jamais
// une stack trace ou un détail interne de l'API externe (leçon du bootstrap,
// Task 4C : jamais de crash brut remonté à l'utilisateur).
//
// Deux sous-types pour que la route générique (src/app/api/widgets/[service]/
// [widget]/route.ts) choisisse le bon code HTTP sans connaître les détails de
// chaque service : une erreur de validation (params manquants/invalides, config
// qui ne correspond à rien) est une faute du client -> 400 ; une panne de l'API
// externe (réseau, réponse inattendue) n'en est pas une -> 502.
export class WidgetFetchError extends Error {}
export class WidgetValidationError extends WidgetFetchError {}
// Cas distinct du 502 générique : l'API externe répond, mais refuse la requête
// car son quota est épuisé (ex: GitHub à 403 + header x-ratelimit-remaining: 0).
// Message dédié plutôt qu'un "panne réseau" trompeur — utile pour l'utilisateur
// (widget en erreur temporaire, pas cassé) et pour du retry côté Timer plus tard.
export class WidgetRateLimitError extends WidgetFetchError {}

// Traduction unique erreur -> (code HTTP, message affichable), partagée par la
// route GET /api/widgets/[service]/[widget] et le timer central (événement SSE
// "error") — sans ça, les deux chemins divergeaient : la route masquait tout
// derrière un code HTTP, que le front traduisait en "configuration invalide"
// même pour "compte GitHub non lié" ou "clé Steam requise", puis le SSE
// écrasait ce message par "could not fetch widget data". Seul le message d'une
// WidgetFetchError (rédigé à la main dans chaque fetch.ts) est exposé ; toute
// autre erreur (bug, exception inattendue) reste générique.
export interface PublicWidgetError {
  status: 400 | 429 | 502;
  message: string;
}

export function toPublicWidgetError(error: unknown): PublicWidgetError {
  const status =
    error instanceof WidgetRateLimitError ? 429 : error instanceof WidgetValidationError ? 400 : 502;
  const message = error instanceof WidgetFetchError ? error.message : "could not fetch widget data";
  return { status, message };
}
