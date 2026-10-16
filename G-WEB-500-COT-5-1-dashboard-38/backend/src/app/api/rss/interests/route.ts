import { NextResponse } from "next/server";

import { RSS_INTERESTS } from "@/server/services/rss/interests";

// GET /api/rss/interests — catalogue public des centres d'intérêt (key + label)
// affichés dans /settings. Lecture seule, aucune donnée utilisateur : pas de
// session requise. Le front utilise la key dans le widget rss_interest_feed et
// le label dans les puces de sélection.
export async function GET() {
  return NextResponse.json({
    interests: RSS_INTERESTS.map(({ key, label, emoji }) => ({ key, label, emoji })),
  });
}