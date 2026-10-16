import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

// session.user.id n'existe pas dans le type par défaut de NextAuth — nécessaire
// pour retrouver le compte GitHub lié (Account.userId) depuis une session, ex.
// pour aller chercher le token OAuth d'un widget github_security_alerts.
// role : ajouté pour la section admin (src/app/admin) — garde côté page/API.
//
// Dupliqué à l'identique côté frontend/src/types/next-auth.d.ts (sauf Role,
// redéfini en litéral là-bas faute de @prisma/client) : depuis le split
// backend/frontend (deux apps Next.js indépendantes, cf. ADR 0009), il n'y a
// plus de code partageable entre elles sans package npm dédié — jugé
// disproportionné ici (types uniquement, effacés à la compilation, donc
// aucun risque runtime même en cas de divergence).
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
