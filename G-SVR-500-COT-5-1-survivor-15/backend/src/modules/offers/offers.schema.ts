import { z } from 'zod';

// Valeurs alignées sur le frontend (frontend/src/types/index.ts), pas d'enum Prisma
// car certaines valeurs sont accentuées (Bâtiment, Santé), invalides comme identifiants.
export const SECTORS = [
  'Restauration',
  'Logistique',
  'Santé',
  'Commerce',
  'Bâtiment',
  'Tech',
  'Services',
] as const;
export const CONTRACT_TYPES = ['CDI', 'CDD', 'Intérim', 'Extra', 'Alternance', 'Stage'] as const;
export const SALARY_KINDS = ['brut', 'net'] as const;

// feature/employer, validation des offres.
// Exigence Vignal : les coordonnées ne viennent PAS du client, elles sont dérivées
// de l'adresse via l'API Adresse cote serveur. Donc pas de latitude/longitude ici.
export const createOfferSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
  address: z.string().min(3).max(200),
  commune: z.string().max(120).optional(),
  radiusKm: z.number().min(1).max(200).default(10),
  sector: z.enum(SECTORS).optional(),
  contractType: z.enum(CONTRACT_TYPES).optional(),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  salaryKind: z.enum(SALARY_KINDS).optional(),
  workTime: z.string().max(60).optional(),
  experienceLevel: z.string().max(60).optional(),
  requiredSkills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
});

// Modération (admin) : le frontend envoie son propre vocabulaire de statut
// (frontend/src/types/index.ts, OfferStatus : published/unpublished/reported),
// pas l'enum Prisma directement.
export const OFFER_STATUS_FRONTEND_TO_BACKEND = {
  published: 'ACTIVE',
  unpublished: 'ARCHIVED',
  reported: 'REPORTED',
} as const;

export const updateOfferSchema = createOfferSchema.partial().extend({
  status: z.enum(['published', 'unpublished', 'reported']).optional(),
});

// POST /api/offers/:offerId/report (feature/admin, signalement d'une offre).
export const createReportSchema = z.object({
  reason: z.string().min(1).max(200),
  comment: z.string().max(1000).optional(),
});

// Recherche de proximité (module carte / consommée par feature/job-seeker).
export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(200).default(10),
});

// Listing générique (carte + filtres), consommé par frontend/src/hooks/useOffers.ts.
// lat/lng optionnels : sans position, pas de tri par distance ni de rayon appliqué.
export const listOffersQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(200).optional(),
  bbox: z.string().optional(),
  q: z.string().trim().max(200).optional(),
  contract: z.enum(CONTRACT_TYPES).optional(),
  sector: z.enum(SECTORS).optional(),
  new: z.enum(['1']).optional(),
});
