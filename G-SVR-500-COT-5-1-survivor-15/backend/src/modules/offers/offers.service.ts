import { prisma } from '../../config/database';
import { OfferStatus } from '@prisma/client';
import { ForbiddenError } from '../../utils/errors';

/** Durée de vie d'une offre avant archivage automatique (exigence CDC : 30 jours). */
export const OFFER_TTL_DAYS = 30;

export function computeExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + OFFER_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Archive les offres ACTIVE dont la date d'expiration est dépassée. */
export async function archiveExpiredOffers(): Promise<number> {
  const { count } = await prisma.offer.updateMany({
    where: { status: OfferStatus.ACTIVE, expiresAt: { lt: new Date() } },
    data: { status: OfferStatus.ARCHIVED },
  });
  if (count > 0) console.log(`[archive] ${count} offre(s) expirée(s) archivée(s).`);
  return count;
}

/** Lance l'archivage au démarrage puis une fois par jour. */
export function startArchiveJob(intervalMs = 24 * 60 * 60 * 1000): void {
  const run = () => archiveExpiredOffers().catch((e) => console.error('[archive]', e));
  run();
  setInterval(run, intervalMs);
}

/**
 * Résout l'EmployerProfile de l'utilisateur courant.
 * (Offer.employerId référence EmployerProfile.id, pas User.id.)
 */
export async function requireEmployerProfileId(userId: string): Promise<string> {
  const profile = await prisma.employerProfile.findUnique({ where: { userId } });
  if (!profile) throw new ForbiddenError("Profil employeur requis pour cette action");
  return profile.id;
}

const OFFER_STATUS_TO_FE: Record<string, string> = {
  ACTIVE: 'published',
  EXPIRED: 'unpublished',
  ARCHIVED: 'unpublished',
  REPORTED: 'reported',
};

export interface OfferRowForFrontend {
  id: string;
  title: string;
  description: string;
  employerId: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radiusKm: number;
  viewCount: number;
  expiresAt: Date;
  createdAt: Date;
  status: string;
  sector: string | null;
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryKind: string | null;
  workTime: string | null;
  experienceLevel: string | null;
  requiredSkills: string[];
  companyName: string;
  distance_m?: number | null;
  applicationCount?: number;
}

/** Forme attendue par le frontend (frontend/src/types/index.ts) : mêmes noms de champs
 * que le pont d'intégration local, pour éviter de toucher useOffers.ts / JobMap / OfferList
 * / OffersPage (employeur) qui consomment tous ce même type `Offer`. */
export function mapOfferForFrontend(o: OfferRowForFrontend) {
  return {
    id: o.id,
    title: o.title,
    description: o.description ?? '',
    company: o.companyName ?? '(entreprise)',
    employerId: o.employerId,
    sector: o.sector ?? undefined,
    contract: o.contractType ?? undefined,
    tags: o.contractType ? [o.contractType] : [],
    salaryMin: o.salaryMin ?? undefined,
    salaryMax: o.salaryMax ?? undefined,
    salaryKind: o.salaryKind ?? undefined,
    workTime: o.workTime ?? undefined,
    experienceLevel: o.experienceLevel ?? undefined,
    requiredSkills: o.requiredSkills ?? undefined,
    address: o.address ?? '',
    lat: o.latitude,
    lng: o.longitude,
    radiusKm: o.radiusKm,
    isNew: Date.now() - new Date(o.createdAt).getTime() < 7 * 24 * 3600 * 1000,
    createdAt: o.createdAt,
    endsAt: o.expiresAt,
    status: OFFER_STATUS_TO_FE[o.status] ?? 'published',
    views: o.viewCount ?? 0,
    approaches: 0,
    applicationsCount: o.applicationCount ?? 0,
    distanceM: o.distance_m ?? null,
  };
}