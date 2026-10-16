import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isValidUsername, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "@/lib/validation";
import { authOptions } from "@/server/auth/auth";
import { deleteUserAccount } from "@/server/users/delete-user";

// Mot à taper pour confirmer la suppression d'un compte sans mot de passe
// (créé via GitHub/Google) : même rôle que le mot de passe pour les autres.
const DELETE_CONFIRMATION_WORD = "DELETE";

// GET /api/profile — les vraies données affichées sur /profile (frontend).
// Avant ça, ProfileView affichait des valeurs en dur (Role: "Admin" pour
// tout le monde, "Provider: Local · Hubly" même pour un compte lié à GitHub) —
// trouvé lors d'un audit pré-soutenance.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
    // Jamais le hash lui-même : seulement de quoi afficher "Email & password"
    // parmi les méthodes de connexion du compte.
    hasPassword: Boolean(user.passwordHash),
    linkedProviders: user.accounts.map((account) => account.provider),
  });
}

// PATCH /api/profile — { name } : nom d'utilisateur du compte (User.name),
// mêmes règles qu'à l'inscription (isValidUsername). 200 { name } ; 400 nom
// invalide ; 401 sans session.
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!isValidUsername(name)) {
    return NextResponse.json(
      {
        error: `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters: letters, numbers, spaces, _ . -`,
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
    select: { name: true },
  });
  return NextResponse.json({ name: user.name });
}

// DELETE /api/profile — suppression de son propre compte et de toutes ses
// données (cf. deleteUserAccount). Body : { password } pour un compte avec
// mot de passe, { confirmation: "DELETE" } pour un compte GitHub/Google.
// 200 { deleted: true } ; 400 confirmation manquante ; 401 sans session ;
// 403 mot de passe incorrect ; 409 dernier administrateur (l'instance
// resterait sans admin).
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, passwordHash: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (user.passwordHash) {
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ error: "Enter your password to delete your account" }, { status: 400 });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 });
    }
  } else if (body?.confirmation !== DELETE_CONFIRMATION_WORD) {
    return NextResponse.json(
      { error: `Type ${DELETE_CONFIRMATION_WORD} to confirm the deletion` },
      { status: 400 },
    );
  }

  if (user.role === "ADMIN") {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", id: { not: user.id } } });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "You are the only administrator: promote another admin before deleting this account" },
        { status: 409 },
      );
    }
  }

  try {
    await deleteUserAccount(user.id);
  } catch (error) {
    console.error(`[api/profile] DELETE failed for user ${user.id}:`, error);
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
