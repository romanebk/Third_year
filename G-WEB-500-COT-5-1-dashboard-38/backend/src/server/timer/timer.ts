export interface RegisteredWidget {
  id: string;
  refreshRateSeconds: number;
  refresh: () => Promise<void>;
}

// Scheduler central : chaque instance de widget a son propre setInterval, à son
// propre rythme (refreshRateSeconds) — pas un seul gros setInterval qui boucle sur
// tout le monde. Ça garantit que le refresh d'un widget lent (fetch d'API externe)
// ne retarde jamais celui des autres : chaque timer est indépendant dans l'event
// loop de Node.
class WidgetTimer {
  private timers = new Map<string, NodeJS.Timeout>();

  register(widget: RegisteredWidget): void {
    // Ré-enregistrer un id déjà suivi (ex: reconfiguration du refreshRate depuis le
    // dashboard) remplace proprement l'ancien timer plutôt que d'en empiler un
    // second en parallèle sur la même instance.
    this.unregister(widget.id);

    const interval = setInterval(() => {
      // Isolation des erreurs : si le refresh d'un widget plante (API externe en
      // panne, timeout...), ça ne doit jamais arrêter le timer des autres widgets
      // ni faire planter le process serveur — leçon centrale du bootstrap (Task 4C).
      void widget.refresh().catch((error: unknown) => {
        console.error(`[timer] refresh failed for widget instance ${widget.id}:`, error);
      });
    }, widget.refreshRateSeconds * 1000);

    this.timers.set(widget.id, interval);
  }

  unregister(id: string): void {
    const existing = this.timers.get(id);
    if (existing) {
      clearInterval(existing);
      this.timers.delete(id);
    }
  }

  isRegistered(id: string): boolean {
    return this.timers.has(id);
  }

  get activeCount(): number {
    return this.timers.size;
  }
}

// Singleton via globalThis : en dev, Next.js recharge les modules serveur à chaud
// (Fast Refresh) à chaque changement de fichier. Sans ce garde, une nouvelle
// instance de WidgetTimer serait recréée à chaque rechargement, empilant des
// setInterval fantômes sur les mêmes widgets — même pattern que src/lib/db.ts pour
// le client Prisma, pour la même raison.
const globalForTimer = globalThis as unknown as { widgetTimer?: WidgetTimer };

export const widgetTimer = globalForTimer.widgetTimer ?? new WidgetTimer();

if (process.env.NODE_ENV !== "production") {
  globalForTimer.widgetTimer = widgetTimer;
}
