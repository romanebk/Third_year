import { NextResponse } from "next/server";

import { services } from "@/server/services";
import type { AboutJsonResponse } from "@/types";

// GET /about.json — endpoint de validation du sujet.
// Répond avec l'IP du client, l'heure serveur et la liste des services/widgets.
export function GET(request: Request): NextResponse<AboutJsonResponse> {
  const forwarded = request.headers.get("x-forwarded-for");
  const host = forwarded ? forwarded.split(",")[0].trim() : "unknown";

  const response: AboutJsonResponse = {
    client: { host },
    server: {
      current_time: Math.floor(Date.now() / 1000),
      services,
    },
  };

  return NextResponse.json(response);
}