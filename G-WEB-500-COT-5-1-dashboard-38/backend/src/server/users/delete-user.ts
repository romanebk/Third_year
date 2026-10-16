import { prisma } from "@/lib/db";
import { unregisterInstanceTimer } from "@/server/timer/register-instance";

// Suppression d'un compte, partagée par l'admin (DELETE /api/users/[id]) et
// l'utilisateur lui-même (DELETE /api/profile). La cascade DB (onDelete:
// Cascade) supprime réglages, widgets, services, comptes liés et tokens, mais
// ne sait rien des setInterval en mémoire du timer central : on récupère les
// instances avant la suppression pour les désinscrire ensuite — sinon ils
// continueraient à tourner pour des instances qui n'existent plus.
// Lève l'erreur Prisma P2025 si l'utilisateur n'existe pas.
export async function deleteUserAccount(userId: string): Promise<void> {
  const instances = await prisma.widgetInstance.findMany({
    where: { userId },
    select: { id: true },
  });
  await prisma.user.delete({ where: { id: userId } });
  for (const instance of instances) {
    unregisterInstanceTimer(instance.id);
  }
}
