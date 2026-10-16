import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';

/**
 * Serveur WebSocket temps réel (Socket.IO), exigence explicite du cahier des
 * charges : apparition immédiate des nouvelles offres côté demandeur d'emploi.
 *
 * Signalé absent (Ariel, 09/09/2026) : frontend/src/lib/socket.ts n'était
 * qu'un bus local, avec un commentaire l'admettant explicitement ("le backend
 * socket n'existe pas encore"). Ce module est ce backend.
 *
 * Un seul canal, pas de "room" par utilisateur : le volume de la démo ne le
 * justifie pas, et les événements (nouvelle offre, statut de candidature) sont
 * filtrés côté client de toute façon (distance, identité du destinataire).
 */
let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigin },
  });
  io.on('connection', (socket) => {
    socket.on('disconnect', () => undefined);
  });
  return io;
}

export function emitOfferCreated(offer: unknown): void {
  io?.emit('offer:created', offer);
}

export function emitOfferUpdated(offer: unknown): void {
  io?.emit('offer:updated', offer);
}

export function emitOfferRemoved(offerId: string): void {
  io?.emit('offer:removed', { id: offerId });
}

export function emitApplicationStatus(payload: unknown): void {
  io?.emit('application:status', payload);
}
