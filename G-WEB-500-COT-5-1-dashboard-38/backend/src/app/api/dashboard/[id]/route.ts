import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authOptions } from "@/server/auth/auth";
import { closePositionGap, moveWidgetInstance } from "@/server/dashboard/reorder";
import {
  DashboardValidationError,
  getWidgetDefinition,
  validateInstanceParams,
  validateRefreshRate,
} from "@/server/dashboard/validate-params";
import { registerInstanceTimer, unregisterInstanceTimer } from "@/server/timer/register-instance";
import { isSubscribed } from "@/server/services/subscriptions";

// Postgres aborte (40P01) l'une des deux transactions concurrentes qui se
// disputent les mêmes lignes — ex : deux PATCH position rapprochés lors d'un
// drag-and-drop, ou un reorder pendant qu'un autre passe. Le conflit est
// transitoire (pas une erreur de logique) : rejouer une ou deux fois suffit.
// Sans ça, l'utilisateur prenait un 500 aléatoire sur un simple déplacement.
const MAX_TRANSACTION_ATTEMPTS = 3;

function isDeadlockError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (code === "40P01" || code === "P2034") return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("40P01") || message.includes("deadlock detected");
}

async function runTransactionWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isDeadlockError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  throw lastError;
}

// PATCH /api/dashboard/[id] — reconfigure (params/refreshRateSeconds) et/ou
// déplace (position) une instance. Tous les champs sont optionnels : n'envoyer
// que ce qui change.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // 404 (pas 403) si l'instance existe mais appartient à quelqu'un d'autre : ne
  // pas révéler l'existence d'une ressource qu'on n'a pas le droit de voir.
  const existing = await prisma.widgetInstance.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Widget instance not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  // Une résiliation ne supprime pas les instances existantes (cf. DELETE
  // /api/services/[name]/subscribe), mais reconfigurer une instance d'un
  // service qu'on ne suit plus reviendrait à contourner la souscription — POST
  // /api/dashboard et GET /api/widgets/[service]/[widget] font déjà cette
  // vérification, PATCH ne l'avait jamais faite. Un simple déplacement
  // (position seule, sans toucher params/refreshRateSeconds) n'a pas besoin de
  // ce check : il ne touche pas au service.
  if (body?.params !== undefined || body?.refreshRateSeconds !== undefined) {
    if (!(await isSubscribed(session.user.id, existing.service))) {
      return NextResponse.json(
        { error: "You are not subscribed to this service anymore" },
        { status: 403 },
      );
    }
  }

  try {
    if (body?.params !== undefined) {
      const definition = getWidgetDefinition(existing.service, existing.widget);
      const validatedParams = validateInstanceParams(definition, body.params);
      await prisma.widgetInstance.update({
        where: { id },
        // isDefault: false dès qu'un params custom est posé à la main : sinon
        // le prochain PATCH /api/settings (cf. applySettingsToDefaultInstances)
        // écrasait silencieusement cette customisation en réappliquant les
        // valeurs dérivées des settings — "par défaut" doit vouloir dire
        // "suit encore les settings", pas juste "a été créé au départ ainsi".
        data: { params: validatedParams, isDefault: false },
      });
    }

    if (body?.refreshRateSeconds !== undefined) {
      const refreshRateSeconds = validateRefreshRate(existing.service, body.refreshRateSeconds);
      await prisma.widgetInstance.update({ where: { id }, data: { refreshRateSeconds } });
    }

    if (body?.position !== undefined) {
      const position = Number(body.position);
      if (!Number.isInteger(position)) {
        throw new DashboardValidationError("position must be an integer");
      }
      await runTransactionWithRetry(() =>
        prisma.$transaction((tx) => moveWidgetInstance(tx, session.user.id, id, position)),
      );
    }

    const instance = await prisma.widgetInstance.findUnique({ where: { id } });

    // Re-enregistrer seulement si la config ou le rythme a bougé — un simple
    // déplacement (position) n'a aucun impact sur ce qui doit être rafraîchi.
    if (instance && (body?.params !== undefined || body?.refreshRateSeconds !== undefined)) {
      registerInstanceTimer({
        id: instance.id,
        userId: instance.userId,
        service: instance.service,
        widget: instance.widget,
        params: instance.params as Record<string, string | number>,
        refreshRateSeconds: instance.refreshRateSeconds,
      });
    }

    return NextResponse.json({ instance });
  } catch (error) {
    if (error instanceof DashboardValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`[dashboard] failed to update widget instance ${id}:`, error);
    return NextResponse.json({ error: "Could not update widget instance" }, { status: 500 });
  }
}

// DELETE /api/dashboard/[id] — supprime une instance et comble le trou laissé
// dans les positions des autres instances de l'utilisateur.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.widgetInstance.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Widget instance not found" }, { status: 404 });
  }

  await runTransactionWithRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.widgetInstance.delete({ where: { id } });
      await closePositionGap(tx, session.user.id, existing.position);
    }),
  );
  unregisterInstanceTimer(id);

  return NextResponse.json({ id });
}
