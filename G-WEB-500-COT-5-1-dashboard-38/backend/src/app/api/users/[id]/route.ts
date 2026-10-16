import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/server/auth/require-admin";
import { deleteUserAccount } from "@/server/users/delete-user";

// P2025 = "Record to update/delete not found" — le seul cas qui doit renvoyer
// 404. Toute autre erreur (DB injoignable, contrainte violée...) doit remonter
// en 500 au lieu d'être confondue avec un id inconnu (trouvé lors d'un audit :
// le .catch(() => null) précédent masquait les deux cas de la même façon).
function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

// PATCH /api/users/[id] — active/désactive un compte et/ou change son rôle
// (admin). Les deux champs sont optionnels, indépendamment modifiables.
// Promotion/rétrogradation de rôle exposée ici à la demande explicite (avant,
// seul le script admin:promote — cf. prisma/promote-admin.ts — le pouvait) :
// n'importe quel admin peut désormais en créer un autre depuis /admin.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // Un admin ne peut pas s'auto-modifier (désactiver ou changer son propre
  // rôle) : sinon un admin unique pourrait se rétrograder/désactiver et
  // personne ne pourrait plus rien réactiver (pas d'UI pour qu'un admin
  // désactivé/rétrogradé s'auto-restaure).
  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot modify your own account" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const data: { disabled?: boolean; role?: "USER" | "ADMIN" } = {};

  if (body?.disabled !== undefined) {
    if (typeof body.disabled !== "boolean") {
      return NextResponse.json({ error: "disabled must be a boolean" }, { status: 400 });
    }
    data.disabled = body.disabled;
  }

  if (body?.role !== undefined) {
    if (body.role !== "USER" && body.role !== "ADMIN") {
      return NextResponse.json({ error: "role must be USER or ADMIN" }, { status: 400 });
    }
    data.role = body.role;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, disabled: true },
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("[api/users/[id]] PATCH failed:", error);
    return NextResponse.json({ error: "Could not update this account" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — suppression d'un utilisateur (admin), cf.
// deleteUserAccount (cascade DB + arrêt des timers de ses widgets).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  try {
    await deleteUserAccount(id);
    return NextResponse.json({ id });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("[api/users/[id]] DELETE failed:", error);
    return NextResponse.json({ error: "Could not delete this account" }, { status: 500 });
  }
}
