// Proxy catch-all vers le backend interne (jamais exposé au navigateur) : le
// frontend reste le seul conteneur publié sur le host (port 8080), donc le
// navigateur ne voit jamais qu'une seule origine — le cookie de session
// NextAuth, l'EventSource SSE (`new EventSource("/api/dashboard/[id]/stream")`,
// cf. instance-widget.tsx) et l'URL de callback OAuth GitHub continuent de
// fonctionner sans aucun changement côté client. Voir docs/adr pour le détail
// des alternatives écartées (rewrites Next.js, sidecar nginx, CORS cross-origin).
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3002";

async function proxy(request: Request, path: string[]): Promise<Response> {
  const search = new URL(request.url).search;
  const target = `${BACKEND_URL}/api/${path.join("/")}${search}`;

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  // /about.json lit x-forwarded-for pour client.host — transmis tel quel s'il est
  // déjà présent (ex: un reverse proxy en amont de ce conteneur l'a posé). Next.js
  // self-hosté n'expose pas l'IP socket brute via l'objet Request standard, donc
  // rien n'est ajouté ici si l'en-tête est absent — comportement inchangé par
  // rapport à l'app unique d'avant le split, pas une régression introduite ici.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const backendResponse = await fetch(target, {
    method: request.method,
    headers,
    // Un stream (POST/PATCH avec corps) exige duplex: "half" côté Node/undici —
    // silencieusement ignoré sans ça, le corps n'atteint jamais le backend.
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? "half" : undefined,
    // manual : un redirect NextAuth (callback OAuth) ne doit pas être suivi ici
    // côté serveur — sinon le navigateur ne reçoit ni la redirection ni le
    // Set-Cookie qui l'accompagne.
    redirect: "manual",
    cache: "no-store",
  } as RequestInit & { duplex?: "half" });

  const responseHeaders = new Headers();
  for (const [key, value] of backendResponse.headers) {
    if (key.toLowerCase() === "set-cookie") continue; // géré à part ci-dessous
    responseHeaders.set(key, value);
  }
  // NextAuth pose plusieurs Set-Cookie sur une même réponse (session, csrf,
  // callback-url) — Headers.get("set-cookie") les fusionnerait en une seule
  // valeur invalide ; getSetCookie() + append() préserve chaque cookie.
  for (const value of backendResponse.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", value);
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

// Volontairement limité à GET/POST/PATCH/DELETE (pas PUT/OPTIONS/HEAD) et ne
// transmet pas de header Authorization : verifié (grep sur tout backend/) que
// PUT/OPTIONS/HEAD ne sont utilisés par aucune route, et que l'app n'a aucun
// chemin d'authentification par bearer token côté client (uniquement le
// cookie de session NextAuth) — ajouter cette couverture serait du code mort.
// Idem pour un timeout/retry ici : ce même proxy sert aussi l'EventSource SSE
// (stream de longue durée, cf. commentaire en tête de fichier) — un timeout
// générique la couperait après quelques secondes. Le saut interne
// frontend->backend reste sur le réseau Docker (latence/fiabilité bien
// meilleures qu'un appel à une API tierce externe), donc le risque qu'un
// timeout couvrirait est faible comparé au risque de casser le mécanisme
// central du projet.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function PATCH(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, (await params).path);
}
