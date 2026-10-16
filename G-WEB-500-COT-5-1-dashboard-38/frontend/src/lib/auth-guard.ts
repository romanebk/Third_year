// Garde d'authentification côté serveur (frontend). Depuis le split
// backend/frontend, src/server/auth/* du backend n'est plus importable ici :
// la page interroge donc le backend via son URL interne (BACKEND_INTERNAL_URL,
// la même que celle du proxy /api/[...path]) en lui retransmettant le cookie
// de session du navigateur, puis redirige vers /login si la session est vide.
// Le backend reste le seul détenteur du secret NextAuth : le frontend ne fait
// que relayer le cookie, il ne peut ni lire ni forger une session.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3002";

interface AuthSessionUser {
  id?: string;
  role?: string;
}

interface AuthSession {
  user?: AuthSessionUser | null;
}

export async function getBackendSession(): Promise<AuthSession> {
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: "no-store",
    });
    if (!res.ok) return {};
    const session = (await res.json()) as AuthSession;
    // jwt() vide token.sub pour un compte désactivé/supprimé -> session sans user
    return session?.user?.id ? session : {};
  } catch {
    return {};
  }
}

export async function requireLogin(): Promise<AuthSession> {
  const session = await getBackendSession();
  if (!session.user?.id) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireLogin();
  if (session.user?.role !== "ADMIN") redirect("/dashboard");
  return session;
}