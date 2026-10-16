// Mappage HTTP status (+ message serveur) -> message utilisateur pour la route
// générique de données widget (backend/src/app/api/widgets/[service]/[widget]/
// route.ts, atteinte via le proxy frontend/src/app/api/[...path]/route.ts) et
// pour les événements "error" du flux SSE. Le backend ne renvoie jamais de
// détail interne, seulement un message contrôlé (cf. toPublicWidgetError).
//
// 400/401/403 : le message serveur est affiché tel quel — c'est lui qui dit
// quoi corriger ("compte GitHub non lié", "clé Steam requise", "ville
// inconnue"...), un texte générique ne le pourrait pas. 429/502 : pannes
// transitoires, un message générique suffit et reste lisible.
export function widgetErrorMessage(status: number, detail?: string): string {
  if ((status === 400 || status === 401 || status === 403) && detail) {
    return detail;
  }
  if (status === 400) {
    return "La configuration ne correspond à rien — vérifiez les valeurs saisies.";
  }
  if (status === 429) {
    return "Le service externe a atteint sa limite de requêtes — réessayez plus tard.";
  }
  if (status === 502) {
    return "Le service externe est indisponible — réessayez dans quelques instants.";
  }
  return "Impossible de charger le widget.";
}

// Lit le message d'erreur d'une réponse JSON { error } sans jamais échouer
// (corps vide ou non-JSON, ex: 401 renvoyé par le proxy).
export async function readWidgetError(response: Response): Promise<string> {
  const json = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const detail = typeof json?.error === "string" ? json.error : undefined;
  return widgetErrorMessage(response.status, detail);
}
