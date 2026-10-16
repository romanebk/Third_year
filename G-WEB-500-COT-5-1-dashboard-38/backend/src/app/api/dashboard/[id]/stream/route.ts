import { getServerSession } from "next-auth";

import { prisma } from "@/lib/db";
import { authOptions } from "@/server/auth/auth";
import { isSubscribed } from "@/server/services/subscriptions";
import { widgetDataEvents, type WidgetDataEvent } from "@/server/timer/events";

const HEARTBEAT_MS = 25_000;

// GET /api/dashboard/[id]/stream — Server-Sent Events : pousse les données d'une
// instance de widget à chaque rafraîchissement du timer central (cf.
// src/server/timer/), sans que le navigateur ait à repoller lui-même selon
// refreshRateSeconds. Une connexion HTTP classique en réponse "text/event-stream"
// suffit ici (pas de WebSocket) : c'est un flux à sens unique serveur -> client.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  // 404 (pas 403) si l'instance appartient à quelqu'un d'autre, même logique que
  // le reste de /api/dashboard : ne pas révéler l'existence d'une ressource qu'on
  // n'a pas le droit de voir.
  const instance = await prisma.widgetInstance.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!instance) {
    return new Response("Widget instance not found", { status: 404 });
  }

  // Même garde que PATCH /api/dashboard/[id] : une instance d'un service
  // résilié ne doit pas continuer à pousser des données en direct — sans ça,
  // se désabonner n'empêchait jamais l'accès aux données déjà en place, juste
  // la création de nouvelles instances.
  if (!(await isSubscribed(session.user.id, instance.service))) {
    return new Response("Not subscribed to this service anymore", { status: 403 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: WidgetDataEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const onEvent = (event: WidgetDataEvent) => send(event);
      widgetDataEvents.on(id, onEvent);

      // Commentaire SSE (ligne ":") ignoré par EventSource mais utile pour ouvrir
      // le flux immédiatement (certains proxies bufferisent tant qu'aucun octet
      // n'a été envoyé) et comme heartbeat pour les widgets à rafraîchissement
      // très espacé — sans ça, une connexion inactive plus d'une minute ou deux
      // peut être coupée par un proxy/navigateur avant le prochain vrai événement.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const cleanup = () => {
        clearInterval(heartbeat);
        widgetDataEvents.off(id, onEvent);
      };

      // Revalide la session à chaque battement plutôt qu'une seule fois à
      // l'ouverture : sans ça, un compte désactivé/supprimé — ou désabonné du
      // service, cf. le check plus haut, valable seulement à l'ouverture —
      // continuait de recevoir des données en direct pour toute la durée de
      // la connexion (potentiellement des heures), trouvé lors d'un audit de
      // sécurité.
      const heartbeat = setInterval(() => {
        void (async () => {
          const [user, currentInstance] = await Promise.all([
            prisma.user.findUnique({ where: { id: session.user.id }, select: { disabled: true } }),
            prisma.widgetInstance.findFirst({
              where: { id, userId: session.user.id },
              select: { service: true },
            }),
          ]);
          const stillValid =
            user &&
            !user.disabled &&
            currentInstance &&
            (await isSubscribed(session.user.id, currentInstance.service));

          if (!stillValid) {
            cleanup();
            try {
              controller.close();
            } catch {
              // déjà fermé côté client, rien à faire
            }
            return;
          }
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        })();
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // déjà fermé côté client, rien à faire
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
