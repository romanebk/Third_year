/**
 * Correction de la reprise du 8 septembre 2026 (retour v1.0, précision commune).
 *
 * La première passe (regeocode-offers.ts --all) interrogeait l'API Adresse avec
 * `adresse + commune` concaténés. Beaucoup d'offres du jeu de démo ont une adresse
 * générique ("Centre-ville, X"), et la concaténation avec la commune produisait
 * une requête légèrement malformée ("Centre-ville, Lyon Lyon") que l'API a parfois
 * mal résolue avec un score faible (< 0.6) sur une commune totalement différente,
 * parfois à plus de 600 km. Cette passe corrige en interrogeant uniquement le nom
 * de commune, une recherche non ambiguë, et ne réécrit que les offres dont le
 * résultat de la première passe a un score sous le seuil de confiance retenu.
 *
 *   npm run geocoding:fix-commune -- --dry-run
 *   npm run geocoding:fix-commune
 */

import { prisma } from '../config/database';
import { geocodeForOffer, GeocodingError } from '../modules/geocoding/geocoding.service';
import { distanceInMeters } from '../modules/geocoding/lambert93';

const SCORE_THRESHOLD = 0.6;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const startedAt = Date.now();

  const offers = await prisma.offer.findMany({
    where: { OR: [{ geocodeScore: { lt: SCORE_THRESHOLD } }, { geocodeScore: null }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, commune: true, latitude: true, longitude: true, geocodeScore: true },
  });

  console.log(
    `Correction ciblée, ${offers.length} offre(s) sous le seuil de confiance ${SCORE_THRESHOLD}` +
      (dryRun ? ' (simulation, aucune écriture)' : ''),
  );

  let fixed = 0;
  let stillUnresolved = 0;
  let failed = 0;
  const moves: { id: string; title: string; commune: string; moved: number }[] = [];

  for (const [index, offer] of offers.entries()) {
    const position = `[${index + 1}/${offers.length}]`;
    if (!offer.commune) {
      stillUnresolved++;
      console.log(`${position} ${offer.id} : pas de commune renseignée, laissée à vérifier`);
      continue;
    }

    let result;
    try {
      result = await geocodeForOffer(offer.commune);
    } catch (error) {
      failed++;
      const message = error instanceof GeocodingError ? error.message : String(error);
      console.error(`${position} ${offer.id} : ÉCHEC API : ${message}`);
      continue;
    }

    if (!result) {
      stillUnresolved++;
      console.log(`${position} ${offer.id} : commune « ${offer.commune} » non résolue, laissée à vérifier`);
      continue;
    }

    const moved = distanceInMeters(offer.latitude, offer.longitude, result.latitude, result.longitude);
    moves.push({ id: offer.id, title: offer.title, commune: offer.commune, moved });

    if (!dryRun) {
      await prisma.offer.update({
        where: { id: offer.id },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          address: result.city ?? offer.commune,
          commune: result.city ?? offer.commune,
          geocodeSource: result.source,
          geocodeScore: result.score,
          geocodeCitycode: result.citycode,
          geocodedAt: new Date(result.geocodedAt),
          geocodePrecision: 'commune',
        },
      });
    }

    fixed++;
    console.log(
      `${position} ${offer.id} : corrigé, commune « ${offer.commune} » (score ${result.score.toFixed(2)}, déplacé de ${moved} m)`,
    );
  }

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n--- Relevé de la correction ---');
  console.log(`Offres examinées      : ${offers.length}`);
  console.log(`Corrigées             : ${fixed}`);
  console.log(`Toujours à vérifier   : ${stillUnresolved}`);
  console.log(`Échecs API            : ${failed}`);
  console.log(`Durée                 : ${durationSeconds} s`);

  const largest = [...moves].sort((a, b) => b.moved - a.moved).slice(0, 10);
  if (largest.length) {
    console.log('\nDix plus grands déplacements de cette correction :');
    for (const m of largest) {
      console.log(`  ${String(m.moved).padStart(7)} m, ${m.commune} (${m.title})`);
    }
  }
}

main()
  .catch((error) => {
    console.error('\nLa correction s\'est interrompue :', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
