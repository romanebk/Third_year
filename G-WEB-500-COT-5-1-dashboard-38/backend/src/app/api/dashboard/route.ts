import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authOptions } from "@/server/auth/auth";
import {
  DashboardValidationError,
  getWidgetDefinition,
  validateInstanceParams,
  validateRefreshRate,
} from "@/server/dashboard/validate-params";
import { isSubscribed } from "@/server/services/subscriptions";
import { seedDefaultInstances } from "@/server/settings/settings";
import { registerInstanceTimer } from "@/server/timer/register-instance";

// GET /api/dashboard — instances de widgets de l'utilisateur connecté, dans
// l'ordre d'affichage (position croissante). Au premier chargement (aucune
// instance seedée), des widgets par défaut réels sont créés (weather + rss,
// services sans compte externe) : le dashboard d'un nouveau compte n'est plus
// un ensemble de panneaux factices en localStorage mais de vraies instances.
// Le boolean defaultsSeeded indique si ce GET vient de créer ces instances
// par défaut (premier chargement du compte) — le front l'utilise pour déclencher
// l'auto-détection de la localisation météo une seule fois.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const defaultsSeeded = await seedDefaultInstances(session.user.id);

  const instances = await prisma.widgetInstance.findMany({
    where: { userId: session.user.id },
    orderBy: { position: "asc" },
  });

  return NextResponse.json({ instances, defaultsSeeded });
}

// POST /api/dashboard — ajoute une instance de widget configurée, en dernière
// position (le déplacement se fait ensuite via PATCH /api/dashboard/[id]).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const service = typeof body?.service === "string" ? body.service : "";
  const widget = typeof body?.widget === "string" ? body.widget : "";

  try {
    const definition = getWidgetDefinition(service, widget);

    // Un utilisateur non souscrit à un service ne peut pas ajouter une instance
    // d'un de ses widgets — trouvé manquant lors d'un audit de conformité (la
    // "souscription" n'était avant qu'une préférence d'affichage localStorage,
    // jamais vérifiée ici).
    if (!(await isSubscribed(session.user.id, service))) {
      return NextResponse.json({ error: "Not subscribed to this service" }, { status: 403 });
    }

    const params = validateInstanceParams(definition, body?.params);

    const refreshRateSeconds = validateRefreshRate(service, body?.refreshRateSeconds);

    const instance = await prisma.$transaction(async (tx) => {
      const position = await tx.widgetInstance.count({ where: { userId: session.user.id } });
      return tx.widgetInstance.create({
        data: {
          userId: session.user.id,
          service,
          widget,
          params,
          refreshRateSeconds,
          position,
        },
      });
    });

    registerInstanceTimer({
      id: instance.id,
      userId: instance.userId,
      service: instance.service,
      widget: instance.widget,
      params: instance.params as Record<string, string | number>,
      refreshRateSeconds: instance.refreshRateSeconds,
    });

    return NextResponse.json({ instance }, { status: 201 });
  } catch (error) {
    if (error instanceof DashboardValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[dashboard] failed to create widget instance:", error);
    return NextResponse.json({ error: "Could not create widget instance" }, { status: 500 });
  }
}
