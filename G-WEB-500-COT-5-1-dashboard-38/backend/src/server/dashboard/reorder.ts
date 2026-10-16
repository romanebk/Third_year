import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

// Invariant maintenu par ce module + les routes create/delete : pour un userId
// donné, les positions de ses WidgetInstance forment toujours une séquence
// contiguë 0..n-1, sans trou. Ça permet un algorithme de déplacement simple
// (décaler seulement ce qui est "entre" l'ancienne et la nouvelle position) au
// lieu de devoir gérer des positions arbitraires envoyées par le client.
export async function moveWidgetInstance(
  tx: TxClient,
  userId: string,
  instanceId: string,
  requestedPosition: number,
): Promise<void> {
  const siblings = await tx.widgetInstance.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  const current = siblings.find((s) => s.id === instanceId);
  if (!current) return; // appelant garantit déjà l'existence/l'ownership avant d'appeler

  const newPosition = Math.max(0, Math.min(requestedPosition, siblings.length - 1));
  if (newPosition === current.position) return;

  if (newPosition > current.position) {
    await tx.widgetInstance.updateMany({
      where: { userId, position: { gt: current.position, lte: newPosition } },
      data: { position: { decrement: 1 } },
    });
  } else {
    await tx.widgetInstance.updateMany({
      where: { userId, position: { gte: newPosition, lt: current.position } },
      data: { position: { increment: 1 } },
    });
  }

  await tx.widgetInstance.update({ where: { id: instanceId }, data: { position: newPosition } });
}

// Après une suppression, comble le trou laissé dans la séquence de positions —
// sans ça, l'invariant "0..n-1 contigu" ne tiendrait plus pour les déplacements
// suivants.
export async function closePositionGap(
  tx: TxClient,
  userId: string,
  removedPosition: number,
): Promise<void> {
  await tx.widgetInstance.updateMany({
    where: { userId, position: { gt: removedPosition } },
    data: { position: { decrement: 1 } },
  });
}

export type { Prisma };
