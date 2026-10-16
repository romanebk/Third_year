import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isValidEmail } from "@/lib/validation";
import { sendPasswordResetEmail } from "@/server/auth/mailer";
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MS } from "@/server/auth/password-reset";
import { clientIp, createRateLimiter } from "@/server/rate-limit";

// 5 demandes par quart d'heure et par adresse IP.
const limiter = createRateLimiter(5, 15 * 60 * 1000);

// POST /api/auth/forgot-password — body { email }. Envoie un lien de
// réinitialisation valable 1 h si un compte actif existe pour cette adresse.
// La réponse est la même que le compte existe ou non (200 { sent: true }) :
// cette route ne doit pas permettre de savoir quelles adresses sont inscrites.
// 400 adresse mal formée ; 429 trop de demandes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (limiter.isLimited(clientIp(request))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, disabled: true },
  });
  if (user && !user.disabled) {
    const token = generateResetToken();
    // Un seul lien valable à la fois : une nouvelle demande annule les précédentes.
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: {
          tokenHash: hashResetToken(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (error) {
      // Même réponse qu'en cas de succès (cf. plus haut) : l'échec est loggé
      // pour l'exploitant, l'utilisateur pourra refaire une demande.
      console.error(`[forgot-password] could not send the reset email to user ${user.id}:`, error);
    }
  }

  return NextResponse.json({ sent: true });
}
