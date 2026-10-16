import { EventEmitter } from "node:events";

export type WidgetDataEvent =
  | { type: "data"; data: unknown }
  | { type: "error"; status: number; message: string };

// Relie le WidgetTimer (qui rafraîchit les données côté serveur) aux connexions
// SSE ouvertes par le navigateur (cf. /api/dashboard/[id]/stream) : un widgetTimer
// tick -> refresh -> emit ici -> chaque route stream abonnée pousse l'événement à
// son client. Découplé du WidgetTimer lui-même (qui ne sait rien du réseau) pour
// que timer.ts reste un scheduler générique, testable sans HTTP.
class WidgetDataEvents extends EventEmitter {
  publish(instanceId: string, event: WidgetDataEvent): void {
    this.emit(instanceId, event);
  }
}

// Singleton via globalThis : même raison que widgetTimer (Fast Refresh en dev
// recréerait un nouvel EventEmitter à chaque rechargement, perdant les abonnés).
const globalForEvents = globalThis as unknown as { widgetDataEvents?: WidgetDataEvents };

export const widgetDataEvents = globalForEvents.widgetDataEvents ?? new WidgetDataEvents();
// Beaucoup de widgets + plusieurs onglets ouverts en même temps = potentiellement
// plus de 10 listeners sur un même emitter (un par instanceId, pas par listener
// total, mais autant lever la limite par défaut de Node pour éviter un warning
// EventEmitter memory leak trompeur ici).
widgetDataEvents.setMaxListeners(100);

if (process.env.NODE_ENV !== "production") {
  globalForEvents.widgetDataEvents = widgetDataEvents;
}
