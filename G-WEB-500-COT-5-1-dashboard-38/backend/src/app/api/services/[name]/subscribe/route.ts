import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authOptions } from "@/server/auth/auth";
import { getServiceByName } from "@/server/services";
import {
  ApiKeyError,
  encryptApiKey,
  serverApiKey,
  usesApiKey,
  verifyApiKey,
} from "@/server/services/api-keys";
import { registerInstanceTimer, unregisterInstanceTimer } from "@/server/timer/register-instance";

// POST /api/services/[name]/subscribe — souscrit l'utilisateur connecté à un
// service (condition pour ajouter/utiliser ses widgets, cf. isSubscribed()).
// Services "apikey" (Steam, YouTube) : body { apiKey } = la clé de
// l'utilisateur, vérifiée auprès du service puis stockée chiffrée. Elle n'est
// facultative que si le serveur a sa propre clé ou si une clé est déjà
// enregistrée. 200 { subscribed: true } ; 400 clé manquante (code
// "api_key_required") ou refusée ; 401 sans session ; 404 service inconnu ;
// 502 service injoignable pendant la vérification.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const service = getServiceByName(name);
  if (!service) {
    return NextResponse.json({ error: "service not found" }, { status: 404 });
  }

  let encryptedApiKey: string | undefined;
  if (usesApiKey(name)) {
    const body = await request.json().catch(() => null);
    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (apiKey) {
      try {
        await verifyApiKey(name, apiKey);
      } catch (error) {
        if (error instanceof ApiKeyError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
      }
      encryptedApiKey = encryptApiKey(apiKey);
    } else if (!serverApiKey(name)) {
      const existing = await prisma.serviceSubscription.findUnique({
        where: { userId_service: { userId: session.user.id, service: name } },
        select: { apiKey: true },
      });
      if (!existing?.apiKey) {
        return NextResponse.json(
          { error: "An API key is required to connect this service", code: "api_key_required" },
          { status: 400 },
        );
      }
    }
  }

  // upsert : re-souscrire à un service déjà souscrit ne doit pas planter sur la
  // contrainte @@unique([userId, service]) — idempotent. Une nouvelle clé
  // remplace l'ancienne ; sans nouvelle clé, celle en place est conservée.
  await prisma.serviceSubscription.upsert({
    where: { userId_service: { userId: session.user.id, service: name } },
    create: { userId: session.user.id, service: name, apiKey: encryptedApiKey },
    update: encryptedApiKey ? { apiKey: encryptedApiKey } : {},
  });

  // Ré-enregistre le timer des instances déjà existantes pour ce service (une
  // résiliation précédente les avait désenregistrées, cf. DELETE ci-dessous —
  // sans ça, se réabonner ne relance jamais leur rafraîchissement tant que
  // l'utilisateur ne les reconfigure pas manuellement via PATCH).
  const instances = await prisma.widgetInstance.findMany({
    where: { userId: session.user.id, service: name },
  });
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

  return NextResponse.json({ subscribed: true });
}

// DELETE /api/services/[name]/subscribe — résilie la souscription (et supprime
// la clé d'API enregistrée avec elle, le cas échéant). Les instances
// de widgets déjà ajoutées pour ce service ne sont pas supprimées : l'utilisateur
// garde son dashboard, seul l'ajout de nouvelles instances/le fetch à la demande
// se remettent à exiger une souscription (cf. POST /api/dashboard, GET
// /api/widgets/[service]/[widget]).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await params;
  const service = getServiceByName(name);
  if (!service) {
    return NextResponse.json({ error: "service not found" }, { status: 404 });
  }

  await prisma.serviceSubscription.deleteMany({
    where: { userId: session.user.id, service: name },
  });

  // Les instances restent en base (cf. commentaire ci-dessus), mais leur timer
  // en mémoire est désenregistré : sinon elles continueraient à interroger
  // l'API tierce et à pousser des données en direct via SSE pour un service
  // qu'on ne suit plus (PATCH/le stream refusent déjà les nouvelles requêtes,
  // ceci coupe aussi ce qui tournait déjà en arrière-plan).
  const instances = await prisma.widgetInstance.findMany({
    where: { userId: session.user.id, service: name },
    select: { id: true },
  });
  for (const instance of instances) {
    unregisterInstanceTimer(instance.id);
  }

  return NextResponse.json({ subscribed: false });
}
