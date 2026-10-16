import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/server/auth/auth";
import { isSubscribed } from "@/server/services/subscriptions";
import { buildWidgetFetchContextForUser } from "@/server/widgets/context";
import { getWidgetDataFetcher, runWidgetFetcher } from "@/server/widgets/data";
import { toPublicWidgetError } from "@/server/widgets/errors";

// GET /api/widgets/[service]/[widget]?<params> — exécute le fetch de données du
// widget avec les params fournis en query string. Route générique : ajouter un
// widget de données = une entrée dans le registre (src/server/widgets/data.ts),
// pas un nouveau fichier de route par widget.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ service: string; widget: string }> },
) {
  const { service, widget } = await params;
  const fetcher = getWidgetDataFetcher(service, widget);

  if (!fetcher) {
    return NextResponse.json({ error: "widget not found" }, { status: 404 });
  }

  // Toujours une session : le sujet réserve les widgets aux utilisateurs
  // authentifiés, y compris ceux des services "auth: none" (weather, rss...),
  // qui sont "disponibles par défaut pour tout utilisateur authentifié". Sans
  // ça, cette route servait de relais public vers les API tierces (trouvé lors
  // d'un audit avant soutenance). Les services oauth/apikey exigent en plus
  // une souscription — isSubscribed renvoie true d'office pour "auth: none".
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isSubscribed(session.user.id, service))) {
    return NextResponse.json({ error: "Not subscribed to this service" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams);

  try {
    const context = await buildWidgetFetchContextForUser(session.user.id);
    const data = await runWidgetFetcher(fetcher, queryParams, context);
    return NextResponse.json({ data });
  } catch (error) {
    // Jamais de stack trace ni de détail d'implémentation renvoyé au client :
    // seul le message contrôlé d'une WidgetFetchError l'est (cf.
    // toPublicWidgetError). Code HTTP selon le sous-type : 400 faute du client
    // (params/config invalides, compte non lié), 429 quota API externe épuisé,
    // 502 panne upstream.
    console.error(`[widgets] fetch failed for ${service}/${widget}:`, error);
    const { status, message } = toPublicWidgetError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
