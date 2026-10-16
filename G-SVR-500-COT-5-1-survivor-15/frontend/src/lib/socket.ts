import { io, type Socket } from 'socket.io-client';

type Handler = (...args: unknown[]) => void;

const REALTIME_EVENTS = ['offer:created', 'offer:updated', 'offer:removed', 'application:status'] as const;

/**
 * Temps réel : apparition immédiate des nouvelles offres (exigence CDC).
 *
 * Signalé absent (Ariel, 09/09/2026) : ce fichier était un faux bus local, le
 * backend socket n'existait pas. Ici, un vrai client socket.io-client, connecté
 * au vrai serveur Socket.IO du backend (backend/src/realtime/socket.ts).
 *
 * Repli polling obligatoire par consigne (le réseau ministériel bloque les
 * WebSockets sortants) : activable explicitement par configuration
 * (VITE_REALTIME_MODE=polling dans .env, pas un changement de code), et
 * déclenché automatiquement si la connexion WebSocket échoue, pour que le
 * comportement reste correct même sans reconfiguration préalable. Même
 * surface publique (on/off/emit/connected) dans les deux modes : le reste de
 * l'application (useRealtime.ts, ReconnectBanner.tsx) ne sait pas lequel des
 * deux est actif.
 */
const REALTIME_MODE = (import.meta.env.VITE_REALTIME_MODE as string | undefined) ?? 'websocket';
const POLL_INTERVAL_MS = Number(import.meta.env.VITE_REALTIME_POLL_MS ?? 8000);

// En dev, le frontend (5173, servi en HTTPS localement pour la caméra) et le
// pont d'intégration (4000, non commité) ne relaient pas les mises à niveau
// WebSocket : on se connecte directement au vrai backend (3000, HTTP simple,
// pas de certificat configuré dessus ; reprendre location.protocol donnerait
// wss:// vers un serveur qui ne parle pas TLS). En production, le backend
// sert le frontend en statique depuis la même origine, donc pas d'URL
// explicite nécessaire (même hôte, même protocole).
// Port aligné sur PORT (config/env.ts, défaut 3000) : un précédent 3010 ici
// ne correspondait à aucun serveur réel, la connexion WebSocket échouait
// systématiquement en dev et retombait en silence sur le polling.
const SOCKET_URL = import.meta.env.DEV ? `http://${location.hostname}:3000` : undefined;

class RealtimeBus {
  private handlers = new Map<string, Set<Handler>>();
  connected = false;
  private socket: Socket | null = null;
  private pollTimer: number | null = null;

  constructor() {
    if (REALTIME_MODE === 'polling') {
      this.startPolling();
    } else {
      this.connectSocket();
    }
  }

  private connectSocket(): void {
    this.socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.connected = true;
      this.stopPolling();
      this.emit('connect');
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnect');
    });
    // Repli automatique : la connexion WebSocket échoue (réseau qui la bloque,
    // par exemple) -> on ne reste pas silencieux, on bascule sur le polling
    // sans attendre une reconfiguration manuelle.
    this.socket.on('connect_error', () => {
      if (!this.pollTimer) this.startPolling();
    });

    for (const event of REALTIME_EVENTS) {
      this.socket.on(event, (payload: unknown) => this.emit(event, payload));
    }
  }

  private startPolling(): void {
    this.connected = true;
    this.emit('connect');
    // Pas de contenu d'événement en mode polling (pas de flux poussé par le
    // serveur) : on force juste une revalidation régulière des données, les
    // hooks (useRealtime.ts) invalident leurs requêtes de la même façon.
    this.pollTimer = window.setInterval(() => {
      this.emit('offer:updated');
      this.emit('application:status');
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  on(event: string, handler: Handler): this {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler);
    this.handlers.set(event, set);
    return this;
  }

  off(event: string, handler?: Handler): this {
    if (!handler) {
      this.handlers.delete(event);
      return this;
    }
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  /** Dispatch local (pas un envoi réseau) : reçoit les événements du serveur
   * (via socket.io) ou du polling, et les relaie aux abonnés locaux. Utilisé
   * aussi par les mocks MSW (frontend/src/mocks/handlers.ts) pour simuler un
   * événement serveur sans backend réel. */
  emit(event: string, ...args: unknown[]): this {
    this.handlers.get(event)?.forEach((h) => h(...args));
    return this;
  }
}

export const realtime = new RealtimeBus();
