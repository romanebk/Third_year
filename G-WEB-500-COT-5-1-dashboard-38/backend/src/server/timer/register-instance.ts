import { buildWidgetFetchContextForUser } from "@/server/widgets/context";
import { getWidgetDataFetcher, runWidgetFetcher } from "@/server/widgets/data";
import { toPublicWidgetError } from "@/server/widgets/errors";
import { widgetDataEvents } from "@/server/timer/events";
import { widgetTimer } from "@/server/timer/timer";
import { effectiveRefreshRateSeconds } from "@/server/services/refresh-rates";

export interface TimedWidgetInstance {
  id: string;
  userId: string;
  service: string;
  widget: string;
  params: Record<string, string | number>;
  refreshRateSeconds: number;
}

// Les fetchers (src/server/widgets/data.ts) sont écrits pour la route GET
// /api/widgets/[service]/[widget], donc typés Record<string, string> (une query
// string n'a que des strings) — un param "integer" est stocké en nombre en base
// (cf. validate-params.ts), donc on le restringifie ici pour respecter exactement
// le même contrat plutôt que de dupliquer/assouplir le typage des fetchers.
function stringifyParams(params: Record<string, string | number>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
}

async function refreshInstance(instance: TimedWidgetInstance): Promise<void> {
  const fetcher = getWidgetDataFetcher(instance.service, instance.widget);
  if (!fetcher) {
    // Widget retiré du registre depuis la création de l'instance (déploiement plus
    // récent) : rien à faire, pas une erreur de fetch à pousser au client.
    return;
  }

  try {
    const context = await buildWidgetFetchContextForUser(instance.userId);
    const data = await runWidgetFetcher(fetcher, stringifyParams(instance.params), context);
    widgetDataEvents.publish(instance.id, { type: "data", data });
  } catch (error) {
    // Même contrat que la route GET /api/widgets/[service]/[widget] (cf.
    // toPublicWidgetError) : message contrôlé + code, jamais de détail interne.
    // Le détail complet est loggé par le WidgetTimer appelant (cf. timer.ts).
    widgetDataEvents.publish(instance.id, { type: "error", ...toPublicWidgetError(error) });
    throw error;
  }
}

// Enregistre (ou ré-enregistre, ex: refreshRateSeconds changé) le timer central
// d'une instance — appelé à la création, à la mise à jour, et au démarrage du
// serveur pour toutes les instances existantes (cf. instrumentation.ts).
export function registerInstanceTimer(instance: TimedWidgetInstance): void {
  widgetTimer.register({
    id: instance.id,
    refreshRateSeconds: effectiveRefreshRateSeconds(instance.service, instance.refreshRateSeconds),
    refresh: () => refreshInstance(instance),
  });
}

export function unregisterInstanceTimer(instanceId: string): void {
  widgetTimer.unregister(instanceId);
}
