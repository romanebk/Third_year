import { prisma } from "@/lib/db";
import { getServiceByName } from "@/server/services";

// Un service "auth: none" (weather, rss) n'exige aucune démarche préalable —
// autorisé d'office pour tout utilisateur authentifié, cf. checklist du sujet
// ("les services ne nécessitant pas de compte externe sont accessibles par
// défaut"). Les autres (oauth, apikey) exigent une ligne ServiceSubscription.
export async function isSubscribed(userId: string, serviceName: string): Promise<boolean> {
  const service = getServiceByName(serviceName);
  if (!service) return false;
  if (service.auth === "none") return true;

  const subscription = await prisma.serviceSubscription.findUnique({
    where: { userId_service: { userId, service: serviceName } },
  });
  return subscription !== null;
}
