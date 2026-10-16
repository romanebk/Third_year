import { z } from 'zod';

// POST /api/applications, un demandeur postule (consommé par feature/job-seeker).
export const applySchema = z.object({
  offerId: z.string().uuid(),
  message: z.string().max(2000).optional(),
});

// PATCH /api/applications/:id, l'employeur change le statut.
export const updateApplicationStatusSchema = z.object({
  status: z.enum(['PENDING', 'VIEWED', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']),
});

// Filtre optionnel côté employeur.
export const listByOfferQuery = z.object({
  status: z.enum(['PENDING', 'VIEWED', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']).optional(),
});

// PATCH /api/pro/applications/:id : le frontend envoie son propre vocabulaire de statut
// (frontend/src/types/index.ts, ApplicationStatus), pas l'enum Prisma directement.
export const FRONTEND_STATUS_TO_BACKEND = {
  sent: 'PENDING',
  viewed: 'VIEWED',
  interview: 'INTERVIEW',
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
} as const;

export const updateApplicationStatusFrontendSchema = z.object({
  status: z.enum(['sent', 'viewed', 'interview', 'accepted', 'rejected']),
});