import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isValidEmail, isValidPassword, isValidUsername } from "@/lib/validation";
import { isEmailDeliveryConfigured, sendConfirmationEmail } from "@/server/auth/mailer";

const SALT_ROUNDS = 12;
const TOKEN_TTL_HOURS = 24;

// POST /api/auth/register — crée le compte (non confirmé) et envoie le lien de confirmation.
// Contrat attendu par le front (register-16.tsx) : body { username, email, password,
// acceptTerms }. acceptTerms doit valoir true (Conditions d'utilisation +
// Politique de confidentialité) : la date d'acceptation est enregistrée.
// Le username est stocké dans User.name (même colonne que le nom renvoyé par
// GitHub/Google pour un compte OAuth) : c'est lui qu'affiche le dashboard.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (body?.acceptTerms !== true) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service and the Privacy Policy" },
      { status: 400 },
    );
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  if (!isValidEmail(email) || !isValidPassword(password)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Choix assumé (simple) : on révèle qu'un compte existe déjà pour cet email.
    // Une version anti-énumération répondrait pareil que le succès et enverrait un email
    // différent ("vous avez déjà un compte") — pas fait ici pour rester simple (cf. sujet :
    // "Focus on clear, minimal solutions").
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Salage + hachage : bcrypt génère un sel aléatoire différent à chaque appel et l'inclut
  // dans le hash stocké — même mot de passe = hash différent à chaque inscription.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, name: username, passwordHash, termsAcceptedAt: new Date() },
    });
  } catch (error) {
    // Deux requêtes pour le même email neuf peuvent passer le findUnique ci-dessus
    // toutes les deux avant qu'aucune n'ait écrit (fenêtre de course) — la
    // deuxième à écrire percute la contrainte unique. Sans ce catch, elle
    // remontait en 500 générique au lieu du même 409 propre que le cas normal
    // (repéré en testant deux inscriptions quasi simultanées sur le même email).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    throw error;
  }

  // Secret imprévisible pour l'URL de confirmation — généré ici, pas par Prisma
  // (cf. commentaire sur EmailVerificationToken.token dans schema.prisma).
  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  // Le compte et son token existent déjà en base à ce stade — un échec d'envoi
  // (mauvais identifiants SMTP, service tiers en panne, etc.) ne doit jamais
  // faire échouer l'inscription elle-même, seulement dégrader le canal de
  // livraison. Sans ce try/catch, sendConfirmationEmail (qui relance déjà 3
  // fois puis abandonne, cf. mailer.ts) faisait planter toute la route en 500
  // après coup : le compte existait, mais le client voyait "Unable to create
  // the account" et un nouvel essai tombait sur 409 "already registered" —
  // aucun moyen de récupérer le lien de confirmation. Trouvé en testant avec
  // des identifiants SMTP invalides.
  let emailDelivered = true;
  try {
    await sendConfirmationEmail(user.email, token);
  } catch (error) {
    console.error(`[register] confirmation email failed for ${user.email}:`, error);
    emailDelivered = false;
  }

  // Jamais renvoyer passwordHash, même côté serveur-à-serveur. Le token de
  // confirmation n'est renvoyé que lorsque le mailer ne peut pas délivrer
  // (pas de SMTP configuré, ou configuré mais l'envoi a échoué au runtime) :
  // c'est alors le seul canal de repli (le lien est aussi loggé côté serveur)
  // permettant de compléter le flow. Dès qu'un SMTP est configuré ET que
  // l'envoi réussit, l'email devient le seul canal et le token ne sort plus
  // de l'API.
  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      ...(isEmailDeliveryConfigured() && emailDelivered ? {} : { devConfirmationToken: token }),
    },
    { status: 201 },
  );
}
