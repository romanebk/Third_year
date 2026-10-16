import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isValidPassword } from "@/lib/validation";
import { hashResetToken } from "@/server/auth/password-reset";
import { clientIp, createRateLimiter } from "@/server/rate-limit";

// Même coût que l'inscription (cf. api/auth/register).
const SALT_ROUNDS = 12;
// 10 essais par quart d'heure et par adresse IP : le jeton fait 256 bits, la
// limite sert surtout à ne pas offrir un bcrypt gratuit en boucle.
const limiter = createRateLimiter(10, 15 * 60 * 1000);

const INVALID_LINK = "This reset link is invalid or has expired. Request a new one.";

// POST /api/auth/reset-password — body { token, password }. Remplace le mot de
// passe du compte lié au jeton, puis supprime tous ses jetons (usage unique).
// 200 { reset: true } ; 400 mot de passe trop court, jeton inconnu ou expiré ;
// 429 trop d'essais.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (limiter.isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { userId: true, expiresAt: true },
  });
  if (!reset || reset.expiresAt < new Date()) {
    if (reset) await prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } });
    return NextResponse.json({ error: INVALID_LINK }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.findUnique({
    where: { id: reset.userId },
    select: { emailVerified: true },
  });
  // Transaction : le mot de passe change et le jeton disparaît ensemble, sinon
  // un crash entre les deux laisserait un lien encore utilisable.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash,
        // Avoir reçu ce lien prouve que l'adresse appartient à l'utilisateur :
        // un compte jamais confirmé l'est du même coup.
        ...(user?.emailVerified ? {} : { emailVerified: new Date() }),
      },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } }),
  ]);

  return NextResponse.json({ reset: true });
}
