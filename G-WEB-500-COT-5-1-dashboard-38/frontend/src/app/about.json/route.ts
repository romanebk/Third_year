// Même proxy que src/app/api/[...path]/route.ts, pour la route exigée par le
// sujet à la racine (/about.json, pas /api/about.json) — donc hors du
// catch-all ci-dessus, qui ne couvre que /api/*.
const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3002";

export async function GET(request: Request) {
  const headers = new Headers({ cookie: request.headers.get("cookie") ?? "" });
  // cf. commentaire équivalent dans api/[...path]/route.ts — pass-through, pas
  // de tentative de dériver l'IP socket brute ici (non exposée par Next.js
  // self-hosté sans reverse proxy dédié, limitation préexistante au split).
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const backendResponse = await fetch(`${BACKEND_URL}/about.json`, {
    headers,
    cache: "no-store",
  });

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: { "Content-Type": backendResponse.headers.get("content-type") ?? "application/json" },
  });
}
