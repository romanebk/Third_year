import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { authOptions } from "@/server/auth/auth";

// Partagé par les routes /api/users/* (section admin) : session.user.role vient
// du callback jwt() de auth.ts, déjà revérifié en base à chaque requête — pas
// besoin de re-requêter ici.
export async function requireAdminSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}
