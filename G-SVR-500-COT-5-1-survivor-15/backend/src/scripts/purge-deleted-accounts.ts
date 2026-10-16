/**
 * Purge définitive des comptes désactivés depuis plus de 30 jours.
 *
 * La suppression de compte (DELETE /users/me) est un soft-delete : elle pose
 * `deletedAt` et anonymise l'email, mais la ligne, le profil et les
 * candidatures restent en base. Cette commande complète le dispositif :
 * passé le délai de rétention, les données sont réellement effacées
 * (suppression en cascade via Prisma, définie dans le schéma).
 *
 * Exigence Florine Pontaillac (retour v1.0, 8 septembre 2026) : la tâche de
 * purge doit exister et être vérifiable, pas seulement documentée comme
 * "à planifier". Sans ordonnanceur en place (pas de CI/CD, cf.
 * docs/NOTE_DEPLOIEMENT.md), la commande est déclenchée manuellement ou par
 * une tâche planifiée du système hôte (cron), à la discrétion de l'équipe
 * d'exploitation.
 *
 *   npm run purge:accounts -- --dry-run
 *   npm run purge:accounts
 *   npm run purge:accounts -- --retention-days=30
 */

import { prisma } from '../config/database';

function parseOptions(argv: string[]) {
  const retentionArg = argv.find((a) => a.startsWith('--retention-days='));
  return {
    dryRun: argv.includes('--dry-run'),
    retentionDays: retentionArg ? Number(retentionArg.split('=')[1]) : 30,
  };
}

async function main(): Promise<void> {
  const { dryRun, retentionDays } = parseOptions(process.argv.slice(2));
  const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: { deletedAt: { not: null, lt: threshold } },
    select: { id: true, email: true, role: true, deletedAt: true },
  });

  console.log(
    `Purge définitive, seuil ${retentionDays} jours (avant le ${threshold.toISOString()})` +
      (dryRun ? ' (simulation, aucune écriture)' : ''),
  );
  console.log(`${candidates.length} compte(s) désactivé(s) depuis plus de ${retentionDays} jours.\n`);

  let purged = 0;
  for (const u of candidates) {
    if (!dryRun) {
      await prisma.user.delete({ where: { id: u.id } });
    }
    purged++;
    console.log(`  ${u.id} (${u.role}, désactivé le ${u.deletedAt!.toISOString()}) : ${dryRun ? 'serait purgé' : 'purgé définitivement'}`);
  }

  console.log(`\n--- Relevé ---`);
  console.log(`Comptes purgés : ${purged}`);
}

main()
  .catch((error) => {
    console.error('\nLa purge s\'est interrompue :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
