/**
 * Procédure de reprise des offres géocodées hors convention.
 *
 * Exigence T. Vignal (02/09/2026) : les offres déjà en base ont été géocodées par
 * un service désormais interdit. Cette commande les reprend via l'API Adresse.
 *
 *   npm run geocoding:migrate              : reprend les offres jamais vérifiées
 *   npm run geocoding:migrate -- --all     : reprend aussi celles déjà vérifiées
 *   npm run geocoding:migrate -- --dry-run : n'écrit rien, produit seulement le relevé
 *   npm run geocoding:migrate -- --limit=50
 *
 * Colonnes de traçabilité (geocodeSource/Score/Citycode, geocodedAt) définies par
 * feature/employer (PR #27) : pas de colonne de statut dédiée. Une offre jamais
 * reprise a donc geocodeSource=null ; c'est ce champ qui sert de filtre de reprise
 * ET d'indicateur "à vérifier" : une offre en échec n'est jamais écrite, elle reste
 * naturellement sélectionnée au prochain passage. Rejouable sans dégât : chaque
 * offre est écrite dès qu'elle est traitée, et une commande interrompue se relance
 * sans rien perdre.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import {
  GeocodingError,
  geocodeForOffer,
} from '../modules/geocoding/geocoding.service';
import { distanceInMeters } from '../modules/geocoding/lambert93';

interface Options {
  all: boolean;
  dryRun: boolean;
  limit?: number;
}

interface Move {
  offerId: string;
  title: string;
  address: string;
  distanceMeters: number;
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
}

function parseOptions(argv: string[]): Options {
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  return {
    all: argv.includes('--all'),
    dryRun: argv.includes('--dry-run'),
    limit: limitArg ? Number(limitArg.split('=')[1]) : undefined,
  };
}

/**
 * Reconstitue la requête d'adresse envoyée à l'API. On préfère l'adresse postale,
 * complétée de la commune ; à défaut, la commune seule, le géocodage sera moins
 * précis, ce que le score renvoyé traduira.
 */
function buildQuery(offer: { address: string | null; commune: string | null }) {
  return [offer.address, offer.commune].filter(Boolean).join(' ').trim();
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const startedAt = Date.now();

  const where: Prisma.OfferWhereInput = options.all ? {} : { geocodeSource: null };

  const offers = await prisma.offer.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: options.limit,
    select: {
      id: true,
      title: true,
      address: true,
      commune: true,
      latitude: true,
      longitude: true,
    },
  });

  console.log(
    `Reprise du géocodage, ${offers.length} offre(s) à traiter` +
      (options.dryRun ? ' (simulation, aucune écriture)' : ''),
  );
  console.log('Source : API Adresse (api-adresse.data.gouv.fr)\n');

  let succeeded = 0;
  let needsReview = 0;
  let failed = 0;
  const moves: Move[] = [];

  for (const [index, offer] of offers.entries()) {
    const position = `[${index + 1}/${offers.length}]`;
    const query = buildQuery(offer);

    if (!query) {
      needsReview++;
      console.log(`${position} ${offer.id} : aucune adresse renseignée, laissée à vérifier`);
      continue;
    }

    let result;
    try {
      result = await geocodeForOffer(query);
    } catch (error) {
      // L'API est tombée : on ne dégrade pas l'offre pour autant, elle reste à
      // reprendre et la prochaine exécution la retentera.
      failed++;
      const message =
        error instanceof GeocodingError ? error.message : String(error);
      console.error(`${position} ${offer.id} : ÉCHEC API : ${message}`);
      continue;
    }

    if (!result) {
      // Non résolue, ou résolue sous le seuil de confiance (geocodeForOffer filtre déjà).
      needsReview++;
      console.log(`${position} ${offer.id} : adresse non résolue, laissée à vérifier : « ${query} »`);
      continue;
    }

    const moved = distanceInMeters(
      offer.latitude,
      offer.longitude,
      result.latitude,
      result.longitude,
    );
    moves.push({
      offerId: offer.id,
      title: offer.title,
      address: query,
      distanceMeters: moved,
      from: { latitude: offer.latitude, longitude: offer.longitude },
      to: { latitude: result.latitude, longitude: result.longitude },
    });

    if (!options.dryRun) {
      await prisma.offer.update({
        where: { id: offer.id },
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          commune: result.city ?? offer.commune,
          geocodeSource: result.source,
          geocodeScore: result.score,
          geocodeCitycode: result.citycode,
          geocodedAt: new Date(result.geocodedAt),
          geocodePrecision: 'commune',
        },
      });
    }

    succeeded++;
    console.log(
      `${position} ${offer.id} : repris (score ${result.score.toFixed(2)}, déplacé de ${moved} m)`,
    );
  }

  printReport({ offers: offers.length, succeeded, needsReview, failed, moves, startedAt });
}

function printReport(stats: {
  offers: number;
  succeeded: number;
  needsReview: number;
  failed: number;
  moves: Move[];
  startedAt: number;
}): void {
  const durationSeconds = ((Date.now() - stats.startedAt) / 1000).toFixed(1);
  const averageMove = stats.moves.length
    ? Math.round(
        stats.moves.reduce((sum, m) => sum + m.distanceMeters, 0) /
          stats.moves.length,
      )
    : 0;

  console.log('\n--- Relevé d\'écarts ---');
  console.log(`Offres examinées      : ${stats.offers}`);
  console.log(`Reprises              : ${stats.succeeded}`);
  console.log(`Localisation à vérifier : ${stats.needsReview}`);
  console.log(`Échecs API (à relancer) : ${stats.failed}`);
  console.log(`Déplacement moyen     : ${averageMove} m`);
  console.log(`Durée                 : ${durationSeconds} s`);

  const largest = [...stats.moves]
    .sort((a, b) => b.distanceMeters - a.distanceMeters)
    .slice(0, 5);

  if (largest.length) {
    console.log('\nCinq plus grands déplacements :');
    for (const move of largest) {
      console.log(
        `  ${String(move.distanceMeters).padStart(7)} m, ${move.address} (${move.title})`,
      );
      console.log(
        `            ${move.from.latitude.toFixed(6)}, ${move.from.longitude.toFixed(6)}` +
          ` → ${move.to.latitude.toFixed(6)}, ${move.to.longitude.toFixed(6)}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error('\nLa procédure de reprise s\'est interrompue :', error);
    console.error('Relancez la commande : elle repartira des offres restantes.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
