import { Router } from 'express';
import { ApplicationStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { requireEmployer } from '../../middleware/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireEmployerProfileId, mapOfferForFrontend } from '../offers/offers.service';
import {
  listEmployerApplications,
  updateApplicationStatusForFrontend,
} from '../applications/applications.service';
import {
  updateApplicationStatusFrontendSchema,
  FRONTEND_STATUS_TO_BACKEND,
} from '../applications/applications.schema';

/**
 * Module Pro, feature/employer.
 * Signalé par Ariel (09/09/2026) : le frontend (DashboardPage.tsx, OffersPage.tsx,
 * ApplicationsPage.tsx côté employeur) appelle /pro/stats, /pro/offers, /pro/applications,
 * aucune route de ce préfixe n'existait côté backend (seulement /offers/mine,
 * /offers/dashboard, /applications/offer/:offerId — préfixes différents, et aucun agrégat
 * candidatures toutes offres confondues). Ce module expose ce préfixe, en réutilisant les
 * fonctions déjà existantes des modules offers/applications (pas de logique dupliquée).
 */
const router = Router();

router.use(authenticate, requireEmployer);

/**
 * @openapi
 * /pro/stats:
 *   get:
 *     tags: [Pro]
 *     summary: Statistiques employeur (vues, candidatures)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "views, approaches (toujours 0, pas de concept backend), applications, peakHours (toujours [], pas de données)" }
 */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const employerId = await requireEmployerProfileId(req.user!.id);
    const offers = await prisma.offer.findMany({
      where: { employerId },
      include: { _count: { select: { applications: true } } },
    });
    res.json({
      views: offers.reduce((sum, o) => sum + o.viewCount, 0),
      approaches: 0,
      applications: offers.reduce((sum, o) => sum + o._count.applications, 0),
      peakHours: [],
    });
  }),
);

/**
 * @openapi
 * /pro/offers:
 *   get:
 *     tags: [Pro]
 *     summary: Mes offres, forme frontend directe (dashboard, liste employeur)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tableau d'offres (pas d'enveloppe) }
 */
router.get(
  '/offers',
  asyncHandler(async (req, res) => {
    const employerId = await requireEmployerProfileId(req.user!.id);
    const offers = await prisma.offer.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
      include: { employer: { select: { companyName: true } }, _count: { select: { applications: true } } },
    });
    res.json(
      offers.map((o) =>
        mapOfferForFrontend({
          ...o,
          companyName: o.employer.companyName,
          applicationCount: o._count.applications,
        }),
      ),
    );
  }),
);

/**
 * @openapi
 * /pro/applications:
 *   get:
 *     tags: [Pro]
 *     summary: Candidatures reçues, agrégées sur toutes mes offres
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tableau de candidatures (pas d'enveloppe) }
 */
router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    res.json(await listEmployerApplications(req.user!.id));
  }),
);

/**
 * @openapi
 * /pro/applications/{id}:
 *   patch:
 *     tags: [Pro]
 *     summary: Changer le statut d'une candidature (alias frontend de PATCH /api/applications/:id)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Candidature mise à jour, forme frontend directe }
 */
router.patch(
  '/applications/:id',
  validate(updateApplicationStatusFrontendSchema),
  asyncHandler(async (req, res) => {
    const backendStatus = FRONTEND_STATUS_TO_BACKEND[
      req.body.status as keyof typeof FRONTEND_STATUS_TO_BACKEND
    ] as ApplicationStatus;
    const updated = await updateApplicationStatusForFrontend(
      req.params.id,
      req.user!.id,
      backendStatus,
    );
    res.json(updated);
  }),
);

export default router;
