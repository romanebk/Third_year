import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

// Durée de session alignée sur le défaut NextAuth v4 (30 jours) : on monte le même
// cookie que produirait un signIn normal, pour que la confirmation débouche sur une
// session déjà ouverte (plus de second pas "login" côté utilisateur).
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

// POST /api/auth/confirm — consomme le token du lien envoyé par email et active le compte.
// Contrat attendu par le front (confirm-16.tsx, pas encore branché) : body { token }.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const verification = await prisma.emailVerificationToken.findUnique({
    where: { token },
  });

  if (!verification) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (verification.expiresAt < new Date()) {
    // Token expiré : on le nettoie, il ne resservira jamais.
    await prisma.emailVerificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  // Transaction : soit les deux écritures passent, soit aucune. Sans ça, un crash entre les
  // deux laisserait soit un token encore utilisable après confirmation (rejouable), soit un
  // token supprimé sans que le compte soit marqué confirmé (utilisateur bloqué sans recours).
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: verification.userId },
      data: { emailVerified: new Date() },
    });
    await tx.emailVerificationToken.delete({ where: { token } });
    return updated;
  });

  // Auto-login : le compte confirmé est authentifié immédiatement. On fabrique ici
  // le même cookie de session que NextAuth (JWE dir/A256GCM signé avec NEXTAUTH_SECRET,
  // via l'encode officiel de la lib, pas un JWT artisanal) — les callbacks jwt()/session()
  // d'auth.ts tourneront ensuite à chaque lecture et revérifieront rôle/statut en base.

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const sessionToken = await encode({
    secret,
    maxAge: SESSION_MAX_AGE,
    token: {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
  });

  // Même logique que defaultCookies() dans next-auth/core/lib/cookie.js (auth.ts
  // ne surcharge pas authOptions.useSecureCookies, donc NextAuth la dérive lui
  // aussi de NEXTAUTH_URL) : nom + flag Secure dynamiques plutôt que codés en
  // dur sur le cas http local — sans ça, en prod HTTPS, NextAuth chercherait
  // __Secure-next-auth.session-token et ne reconnaîtrait jamais ce cookie-ci,
  // en plus de son absence de Secure quel que soit le protocole.
  const useSecureCookies = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const cookieName = `${useSecureCookies ? "__Secure-" : ""}next-auth.session-token`;

  const response = NextResponse.json({ email: user.email }, { status: 200 });
  response.headers.set(
    "Set-Cookie",
    `${cookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${useSecureCookies ? "; Secure" : ""}`,
  );
  return response;
}
