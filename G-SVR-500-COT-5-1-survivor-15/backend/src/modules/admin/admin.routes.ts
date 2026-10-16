import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';
import { mapOfferForFrontend } from '../offers/offers.service';
import { wgs84ToLambert93 } from '../geocoding/lambert93';
import { listOffersQuery, updateUserStatusSchema } from './admin.schema';

/**
 * Module Admin, feature/admin.
 * Signalé par Ariel (09/09/2026) : entièrement vide (juste un commentaire de ce qui
 * était prévu), confirmé GET /api/admin/users → 404, GET /api/admin/metrics → 404.
 * AdminPages.tsx (front) attend : GET /users, PATCH /users/:id, GET /metrics,
 * GET /offers?status=reported, GET /reports.
 */
const router = Router();

router.use(authenticate, requireAdmin);

const ROLE_TO_FE: Record<string, string> = { JOBSEEKER: 'candidate', EMPLOYER: 'employer', ADMIN: 'admin' };

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Liste des comptes (modération)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Tableau d'utilisateurs (pas d'enveloppe), exemple réel, capturé le 2026-09-10
 *         content:
 *           application/json:
 *             example:
 *               - id: "2d99e283-4a88-45ae-b7b4-161154bbafa4"
 *                 email: "employeur@exemple.fr"
 *                 role: "employer"
 *                 status: "pending"
 *                 firstName: null
 *                 lastName: null
 *                 companyName: "Exemple SARL"
 *                 siret: null
 */
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { jobseekerProfile: true, employerProfile: true },
    });
    res.json(
      users.map((u) => {
        const status = u.isSuspended
          ? 'suspended'
          : u.role === 'EMPLOYER' && u.employerProfile && !u.employerProfile.verified
            ? 'pending'
            : 'active';
        return {
          id: u.id,
          email: u.email,
          role: ROLE_TO_FE[u.role] ?? 'candidate',
          status,
          firstName: u.jobseekerProfile?.firstName,
          lastName: u.jobseekerProfile?.lastName,
          companyName: u.employerProfile?.companyName,
          siret: u.employerProfile?.siret,
        };
      }),
    );
  }),
);

/**
 * @openapi
 * /admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Suspendre / réactiver / activer un compte
 *     description: >
 *       status "active" sur un compte employeur non vérifié le passe aussi verified=true
 *       (sinon "pending" indéfiniment), couvre à la fois "activer" et "réactiver".
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           example: { status: "suspended" }
 *     responses:
 *       204: { description: Compte mis à jour, corps vide, vérifié le 2026-09-10 }
 *       404: { description: Introuvable }
 */
router.patch(
  '/users/:id',
  validate(updateUserStatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: 'pending' | 'active' | 'suspended' };
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user || user.deletedAt) throw new NotFoundError('Utilisateur introuvable');

    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.params.id },
        data: { isSuspended: status === 'suspended' },
      }),
      // "Activer" (pending -> active) et "Réactiver" envoient tous les deux status:
      // "active" : dans les deux cas, un compte employeur non vérifié doit aussi
      // passer verified=true, sinon il resterait "pending" indéfiniment.
      ...(status === 'active' && user.role === 'EMPLOYER'
        ? [
            prisma.employerProfile.updateMany({
              where: { userId: req.params.id },
              data: { verified: true },
            }),
          ]
        : []),
    ]);

    res.status(204).send();
  }),
);

/**
 * @openapi
 * /admin/offers:
 *   get:
 *     tags: [Admin]
 *     summary: Offres filtrables par statut (file de modération)
 *     description: >
 *       Chaque offre inclut lambert93 (EPSG:2154), calculé à la lecture, exigence T. Vignal.
 *       La modération elle-même (changer le statut) se fait via PATCH /api/offers/{id}, pas ici.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [published, unpublished, reported] } }
 *       - { in: query, name: employerId, schema: { type: string, format: uuid }, description: "Id du compte User employeur (celui renvoyé par GET /admin/users), pas EmployerProfile.id. Sans ce filtre, toutes les offres de tous les employeurs sont renvoyées (bornées par status si fourni)." }
 *     responses:
 *       200:
 *         description: Tableau d'offres (pas d'enveloppe), forme frontend directe, exemple réel avec status=reported, capturé le 2026-09-10
 *         content:
 *           application/json:
 *             example:
 *               - id: "18b8b72b-1f09-4348-9e58-e40631c4f5a3"
 *                 title: "Offre signalée"
 *                 status: "reported"
 *                 company: "Exemple SARL"
 *                 address: "Lyon"
 *                 lambert93: { x: 842635.52, y: 6519257.16 }
 */
router.get(
  '/offers',
  validate(listOffersQuery, 'query'),
  asyncHandler(async (req, res) => {
    const { status, employerId } = req.query as {
      status?: 'published' | 'unpublished' | 'reported';
      employerId?: string;
    };
    const BACKEND_STATUS: Record<string, string> = {
      published: 'ACTIVE',
      unpublished: 'ARCHIVED',
      reported: 'REPORTED',
    };
    // employerId reçu ici est l'id du User (celui que /admin/users renvoie), pas
    // celui d'EmployerProfile : on filtre donc sur la relation employer.userId,
    // pour que le frontend n'ait jamais besoin de connaître EmployerProfile.id.
    const offers = await prisma.offer.findMany({
      where: {
        ...(status ? { status: BACKEND_STATUS[status] as never } : {}),
        ...(employerId ? { employer: { userId: employerId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { employer: { select: { companyName: true } } },
    });
    // Lambert-93 (EPSG:2154) en plus du WGS84, en administration : exigence
    // T. Vignal. Calculé à la lecture, rien n'est stocké en double en base.
    res.json(
      offers.map((o) => ({
        ...mapOfferForFrontend({ ...o, companyName: o.employer.companyName }),
        lambert93: wgs84ToLambert93(o.latitude, o.longitude),
      })),
    );
  }),
);

/**
 * @openapi
 * /admin/reports:
 *   get:
 *     tags: [Admin]
 *     summary: Signalements ouverts (file de modération)
 *     description: >
 *       Un signalement se ferme implicitement quand l'offre change de statut via
 *       PATCH /api/offers/{id} (pas de route dédiée /admin/reports/{id}/resolve).
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Tableau de signalements (pas d'enveloppe), exemple réel, capturé le 2026-09-10
 *         content:
 *           application/json:
 *             example:
 *               - id: "429339c8-984c-45a6-ab3a-99be23c2d762"
 *                 offerId: "18b8b72b-1f09-4348-9e58-e40631c4f5a3"
 *                 offerTitle: "Offre signalée"
 *                 reason: "Offre trompeuse : Rien à voir avec l'annonce."
 *                 reporterId: "c8ecdbc3-c95d-4ffb-908e-19c35a1ebb79"
 *                 status: "open"
 */
router.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const reports = await prisma.report.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { offer: { select: { title: true } } },
    });
    res.json(
      reports.map((r) => ({
        id: r.id,
        offerId: r.offerId,
        offerTitle: r.offer.title,
        reason: r.reason,
        reporterId: r.userId,
        createdAt: r.createdAt,
        status: 'open' as const,
      })),
    );
  }),
);

/**
 * @openapi
 * /admin/metrics:
 *   get:
 *     tags: [Admin]
 *     summary: Métriques nationales (tableau de bord admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Compteurs agrégés, exemple réel, capturé le 2026-09-10
 *         content:
 *           application/json:
 *             example:
 *               activeOffers: 539
 *               publishedToday: 0
 *               candidates: 29
 *               employers: 39
 *               applicationsToday: 0
 *               reportsOpen: 0
 *               weeklyActivity:
 *                 - { label: "Ven", applications: 7, offers: 39 }
 *                 - { label: "Sam", applications: 0, offers: 0 }
 */
router.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);

    const [activeOffers, publishedToday, candidates, employers, applicationsToday, reportsOpen, weekApps, weekOffers] =
      await Promise.all([
        prisma.offer.count({ where: { status: 'ACTIVE' } }),
        prisma.offer.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.user.count({ where: { role: 'JOBSEEKER', deletedAt: null } }),
        prisma.user.count({ where: { role: 'EMPLOYER', deletedAt: null } }),
        prisma.application.count({ where: { createdAt: { gte: startOfDay } } }),
        prisma.report.count({ where: { status: 'PENDING' } }),
        prisma.application.findMany({
          where: { createdAt: { gte: weekStart } },
          select: { createdAt: true },
        }),
        prisma.offer.findMany({
          where: { createdAt: { gte: weekStart } },
          select: { createdAt: true },
        }),
      ]);

    const dayKey = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.toISOString().slice(0, 10);
    };

    const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      const key = dayKey(day);
      const label = day.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
      return {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        applications: weekApps.filter((a) => dayKey(a.createdAt) === key).length,
        offers: weekOffers.filter((o) => dayKey(o.createdAt) === key).length,
      };
    });

    res.json({
      activeOffers,
      publishedToday,
      candidates,
      employers,
      applicationsToday,
      reportsOpen,
      weeklyActivity,
    });
  }),
);

export default router;
