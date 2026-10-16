import dns from "node:dns";
import net from "node:net";
import { prisma } from "@/lib/db";
import { registerInstanceTimer } from "@/server/timer/register-instance";

// Le réseau Docker de ce conteneur n'a pas de route IPv6 sortante alors que
// plusieurs hôtes appelés (geocoding-api.open-meteo.com, api.nasa.gov,
// fr.wikipedia.org…) publient des enregistrements AAAA. Avec Happy Eyeballs
// (autoSelectFamily) activé, Node tente l'IPv6 en premier, reste bloqué en
// ETIMEDOUT sans retomber sur l'IPv4, et le fetch échoue ("could not reach
// ...") alors que la même requête en IPv4 passe. On préfère donc l'IPv4 et on
// désactive l'auto-sélection de famille — sans quoi météo, maps, crypto, NASA
// et Wikipédia ne se chargent jamais.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

// Le WidgetTimer est en mémoire (pas persistant) — sans ça, toute instance créée
// avant le dernier redémarrage resterait "orpheline" (jamais rafraîchie) tant que
// personne ne la modifie via l'API pour la ré-enregistrer.
const instances = await prisma.widgetInstance.findMany();
for (const instance of instances) {
  registerInstanceTimer({
    id: instance.id,
    userId: instance.userId,
    service: instance.service,
    widget: instance.widget,
    params: instance.params as Record<string, string | number>,
    refreshRateSeconds: instance.refreshRateSeconds,
  });
}
console.log(`[timer] registered ${instances.length} widget instance(s) at boot`);
