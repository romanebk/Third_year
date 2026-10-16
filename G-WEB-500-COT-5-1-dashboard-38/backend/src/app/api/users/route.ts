import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/server/auth/require-admin";

// GET /api/users — liste des utilisateurs (admin).
export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      emailVerified: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}
