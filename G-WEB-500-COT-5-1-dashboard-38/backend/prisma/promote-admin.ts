// Désigne un utilisateur existant comme admin. Nécessaire uniquement pour le
// tout premier admin d'un déploiement : sans lui, personne n'a accès à
// /admin pour en promouvoir un via l'UI (cf. PATCH /api/users/[id]). Un admin
// déjà en place peut ensuite en promouvoir d'autres directement depuis
// /admin, sans repasser par ce script.
// Usage après déploiement : npm run admin:promote -- <email>
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run admin:promote -- <email>");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  }).catch(() => null);

  if (!user) {
    console.error(`No user found with email "${email}".`);
    process.exit(1);
  }

  console.log(`${user.email} is now an admin.`);
}

main().finally(() => prisma.$disconnect());
