import type { DefaultSession } from "next-auth";

// Copie du next-auth.d.ts backend (cf. son propre commentaire pour le detail
// de session.user.id/role) — le frontend n'a pas @prisma/client comme
// dependance (exclue du split, cf. ADR 0009), donc Role est redefini ici en
// litteral plutot qu'importe : les deux valeurs (schema.prisma) sont figees
// depuis le debut du projet, le risque de divergence est nul.
type Role = "USER" | "ADMIN";
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; role: Role };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
