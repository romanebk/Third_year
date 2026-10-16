import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { authOptions } from "@/server/auth/auth";
import { DashboardValidationError } from "@/server/dashboard/validate-params";
import {
  applySettingsToDefaultInstances,
  getOrCreateSettings,
  upsertSettings,
} from "@/server/settings/settings";

// GET /api/settings — réglages de l'utilisateur connecté, créés avec les valeurs
// par défaut au premier appel. Tout le dashboard lit cette config (plus aucun
// localStorage côté front) : c'est la source de vérité de la config utilisateur.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getOrCreateSettings(session.user.id);
  return NextResponse.json({ settings });
}

// PATCH /api/settings — met à jour (partiellement) les réglages, puis propage les
// changements aux instances par défaut du compte (weather, rss) : leurs params et
// leur timer reflètent la nouvelle config.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const settings = await upsertSettings(session.user.id, body);
    await applySettingsToDefaultInstances(session.user.id, settings);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof DashboardValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[settings] failed to update settings:", error);
    return NextResponse.json({ error: "Could not update settings" }, { status: 500 });
  }
}