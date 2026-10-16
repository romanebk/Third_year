import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth/auth";
import { WidgetFetchError } from "@/server/widgets/errors";
import { reverseGeocodeCity } from "@/server/services/weather/fetch";
import {
  applySettingsToDefaultInstances,
  upsertSettings,
} from "@/server/settings/settings";

// POST /api/settings/locate — à partir des coordonnées du navigateur (geolocation
// API), résout la ville la plus proche puis met à jour weatherCity en suivant le
// même chemin qu'un PATCH /api/settings : les instances météo par défaut voient
// leurs params et leur timer mis à jour (applySettingsToDefaultInstances). Utilisé
// par l'auto-détection de localisation au premier chargement d'un compte neuf —
// sans ça, un nouveau compte débute toujours sur "Paris" (valeur par défaut).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { error: "latitude and longitude must be finite numbers" },
        { status: 400 },
      );
    }

    const weatherCity = await reverseGeocodeCity(latitude, longitude);
    const settings = await upsertSettings(session.user.id, { weatherCity });
    await applySettingsToDefaultInstances(session.user.id, settings);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof WidgetFetchError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[settings/locate] failed to locate user:", error);
    return NextResponse.json({ error: "Could not determine your location" }, { status: 500 });
  }
}