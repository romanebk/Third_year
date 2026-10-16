import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { authenticate, optionalAuth } from '../../middleware/auth';
import { requireEmployer } from '../../middleware/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import {
  createOfferSchema,
  updateOfferSchema,
  nearbyQuerySchema,
  listOffersQuerySchema,
  createReportSchema,
  OFFER_STATUS_FRONTEND_TO_BACKEND,
} from './offers.schema';
import {
  computeExpiry,
  requireEmployerProfileId,
  mapOfferForFrontend,
  type OfferRowForFrontend,
} from './offers.service';
import { geocodeForOffer as geocodeAddress } from '../geocoding/geocoding.service';
import { streamOfferPdf } from './offer-export.pdf';
import { emitOfferCreated, emitOfferUpdated, emitOfferRemoved } from '../../realtime/socket';

/**
 * Module Offers, feature/employer
 * GET / (listing filtré, carte), GET /nearby (PostGIS), GET /:id, POST /, PATCH /:id, DELETE /:id
 * + GET /mine, GET /dashboard (métriques employeur), archivage 30 jours (offers.service).
 */
const router = Router();

/**
 * @openapi
 * /offers:
 *   get:
 *     tags: [Offers]
 *     summary: Liste des offres actives, filtrable (carte candidat)
 *     parameters:
 *       - { in: query, name: lat, schema: { type: number }, description: "Sans lat/lng, pas de tri par distance" }
 *       - { in: query, name: lng, schema: { type: number } }
 *       - { in: query, name: radius, schema: { type: number }, description: "km, nécessite lat/lng" }
 *       - { in: query, name: bbox, schema: { type: string }, example: "4.80,45.74,4.86,45.78", description: "minLng,minLat,maxLng,maxLat" }
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: contract, schema: { type: string } }
 *       - { in: query, name: sector, schema: { type: string } }
 *       - { in: query, name: new, schema: { type: string, enum: ['1'] } }
 *     responses:
 *       200:
 *         description: Tableau d'offres (pas d'enveloppe), forme frontend directe
 */
router.get(
  '/',
  validate(listOffersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { lat, lng, radius, bbox, q, contract, sector, new: onlyNew } = req.query as unknown as {
      lat?: number;
      lng?: number;
      radius?: number;
      bbox?: string;
      q?: string;
      contract?: string;
      sector?: string;
      new?: '1';
    };

    const conditions: Prisma.Sql[] = [Prisma.sql`o.status = 'ACTIVE'`];

    if (q) {
      conditions.push(
        Prisma.sql`(o.title ILIKE ${`%${q}%`} OR o.description ILIKE ${`%${q}%`})`,
      );
    }
    if (contract) conditions.push(Prisma.sql`o."contractType" = ${contract}`);
    if (sector) conditions.push(Prisma.sql`o.sector = ${sector}`);
    if (onlyNew === '1') {
      conditions.push(Prisma.sql`o."createdAt" >= now() - interval '7 days'`);
    }
    if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        conditions.push(
          Prisma.sql`o.longitude BETWEEN ${minLng} AND ${maxLng} AND o.latitude BETWEEN ${minLat} AND ${maxLat}`,
        );
      }
    }
    const hasPosition = lat !== undefined && lng !== undefined;
    if (hasPosition && radius) {
      conditions.push(
        Prisma.sql`ST_DWithin(
          o."geoPoint",
          ST_MakePoint(${lng}, ${lat})::geography,
          ${radius * 1000}
        )`,
      );
    }

    // o."geoPoint" (geography(Point,4326) + index GIST, migration
    // add_geo_point_gist_index) plutôt que ST_MakePoint(o.longitude, o.latitude)
    // recalculé à la volée : ce recalcul empêchait Postgres d'utiliser un index,
    // confirmé Seq Scan par EXPLAIN ANALYZE (rapport de charge du 3 septembre).
    const distanceSelect = hasPosition
      ? Prisma.sql`ROUND(ST_Distance(
          o."geoPoint",
          ST_MakePoint(${lng}, ${lat})::geography
        ))::int AS distance_m`
      : Prisma.sql`NULL::int AS distance_m`;
    const orderBy = hasPosition ? Prisma.sql`distance_m ASC` : Prisma.sql`o."createdAt" DESC`;

    const rows = await prisma.$queryRaw<OfferRowForFrontend[]>`
      SELECT o.id, o.title, o.description, o."employerId", o.address,
             o.latitude, o.longitude, o."radiusKm", o."viewCount", o."expiresAt", o."createdAt", o.status,
             o.sector, o."contractType", o."salaryMin", o."salaryMax", o."salaryKind", o."workTime",
             o."experienceLevel", o."requiredSkills",
             e."companyName",
             ${distanceSelect}
      FROM "Offer" o
      JOIN "EmployerProfile" e ON e.id = o."employerId"
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ${orderBy}
      LIMIT 200;`;

    res.json(rows.map(mapOfferForFrontend));
  }),
);

/** Charge une offre et vérifie qu'elle appartient à l'utilisateur employeur. */
async function loadOwnedOffer(offerId: string, userId: string) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { employer: true },
  });
  if (!offer) throw new NotFoundError('Offre introuvable');
  if (offer.employer.userId !== userId)
    throw new ForbiddenError('Cette offre appartient à un autre employeur');
  return offer;
}

/**
 * @openapi
 * /offers/nearby:
 *   get:
 *     tags: [Offers]
 *     summary: Offres actives dans un rayon (PostGIS ST_DWithin)
 *     parameters:
 *       - { in: query, name: lat, required: true, schema: { type: number }, example: 45.764 }
 *       - { in: query, name: lng, required: true, schema: { type: number }, example: 4.8357 }
 *       - { in: query, name: radiusKm, schema: { type: number, default: 10 }, example: 20 }
 *     responses:
 *       200:
 *         description: Offres triées par distance (mètres), exemple réel, capturé le 2026-09-03 (docs/module3-capture-2026-09-03.txt)
 *         content:
 *           application/json:
 *             example:
 *               offers:
 *                 - id: "bf754b6d-a81d-445b-adf9-07525c062760"
 *                   title: "Serveur en salle"
 *                   description: "Service en salle, restaurant gastronomique."
 *                   employerId: "95a2eb2b-13b9-4c73-be0d-38964058fd35"
 *                   commune: "Lyon"
 *                   address: "Lyon"
 *                   latitude: 45.7464
 *                   longitude: 4.8265
 *                   radiusKm: 15
 *                   viewCount: 0
 *                   sector: "Restauration"
 *                   contractType: "CDI"
 *                   salaryMin: 1800
 *                   salaryMax: 2100
 *                   salaryKind: "brut"
 *                   workTime: "35h/semaine"
 *                   expiresAt: "2026-10-04T06:11:07.294Z"
 *                   createdAt: "2026-09-04T06:11:07.296Z"
 *                   companyName: "Swagger Secteur SARL"
 *                   distance_m: 680
 */
router.get(
  '/nearby',
  validate(nearbyQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { lat, lng, radiusKm } = req.query as unknown as {
      lat: number;
      lng: number;
      radiusKm: number;
    };
    const meters = radiusKm * 1000;
    const offers = await prisma.$queryRaw`
      SELECT o.id, o.title, o.description, o."employerId", o.commune, o.address,
             o.latitude, o.longitude, o."radiusKm", o."viewCount", o."expiresAt", o."createdAt",
             o.sector, o."contractType", o."salaryMin", o."salaryMax", o."salaryKind", o."workTime",
             o."experienceLevel", o."requiredSkills",
             e."companyName",
             ROUND(ST_Distance(
               o."geoPoint",
               ST_MakePoint(${lng}, ${lat})::geography
             ))::int AS distance_m
      FROM "Offer" o
      JOIN "EmployerProfile" e ON e.id = o."employerId"
      WHERE o.status = 'ACTIVE'
        AND ST_DWithin(
          o."geoPoint",
          ST_MakePoint(${lng}, ${lat})::geography,
          ${meters}
        )
      ORDER BY distance_m ASC
      LIMIT 200;`;
    res.json({ offers });
  }),
);

/**
 * @openapi
 * /offers/mine:
 *   get:
 *     tags: [Offers]
 *     summary: Mes offres (employeur) avec nombre de candidatures
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Liste des offres de l'employeur, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               offers:
 *                 - id: "bf754b6d-a81d-445b-adf9-07525c062760"
 *                   employerId: "95a2eb2b-13b9-4c73-be0d-38964058fd35"
 *                   title: "Serveur en salle"
 *                   description: "Service en salle, restaurant gastronomique."
 *                   latitude: 45.7464
 *                   longitude: 4.8265
 *                   address: "Lyon"
 *                   commune: "Lyon"
 *                   radiusKm: 15
 *                   viewCount: 0
 *                   status: "ACTIVE"
 *                   sector: "Restauration"
 *                   contractType: "CDI"
 *                   salaryMin: 1800
 *                   salaryMax: 2100
 *                   salaryKind: "brut"
 *                   workTime: "35h/semaine"
 *                   expiresAt: "2026-10-04T06:11:07.294Z"
 *                   createdAt: "2026-09-04T06:11:07.296Z"
 *                   applicationCount: 0
 *               count: 1
 */
router.get(
  '/mine',
  authenticate,
  requireEmployer,
  asyncHandler(async (req, res) => {
    const employerId = await requireEmployerProfileId(req.user!.id);
    const offers = await prisma.offer.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    res.json({
      offers: offers.map((o) => ({ ...o, applicationCount: o._count.applications })),
      count: offers.length,
    });
  }),
);

/**
 * @openapi
 * /offers/dashboard:
 *   get:
 *     tags: [Offers]
 *     summary: Tableau de bord employeur (vues, candidatures, par offre)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Totaux + détail par offre, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               totals: { offers: 1, active: 1, views: 0, applications: 0 }
 *               offers:
 *                 - id: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                   title: "Développeur Full-Stack"
 *                   status: "ACTIVE"
 *                   views: 0
 *                   applications: 0
 *                   expiresAt: "2026-10-03T19:21:24.925Z"
 */
router.get(
  '/dashboard',
  authenticate,
  requireEmployer,
  asyncHandler(async (req, res) => {
    const employerId = await requireEmployerProfileId(req.user!.id);
    const offers = await prisma.offer.findMany({
      where: { employerId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applications: true } } },
    });
    res.json({
      totals: {
        offers: offers.length,
        active: offers.filter((o) => o.status === 'ACTIVE').length,
        views: offers.reduce((s, o) => s + o.viewCount, 0),
        applications: offers.reduce((s, o) => s + o._count.applications, 0),
      },
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        views: o.viewCount,
        applications: o._count.applications,
        expiresAt: o.expiresAt,
      })),
    });
  }),
);

/**
 * @openapi
 * /offers:
 *   post:
 *     tags: [Offers]
 *     summary: Publier une offre géolocalisée (employeur)
 *     description: Les coordonnées sont dérivées de l'adresse via l'API Adresse (BAN) cote serveur, le client n'envoie PAS de lat/lng.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Serveur en salle"
 *             description: "Service en salle, restaurant gastronomique."
 *             address: "1 Place Bellecour, 69002 Lyon"
 *             radiusKm: 15
 *             sector: "Restauration"
 *             contractType: "CDI"
 *             salaryMin: 1800
 *             salaryMax: 2100
 *             salaryKind: "brut"
 *             workTime: "35h/semaine"
 *     responses:
 *       201:
 *         description: Offre créée (coordonnées géocodées), exemple réel, capturé le 2026-09-04
 *         content:
 *           application/json:
 *             example:
 *               offer:
 *                 id: "bf754b6d-a81d-445b-adf9-07525c062760"
 *                 employerId: "95a2eb2b-13b9-4c73-be0d-38964058fd35"
 *                 title: "Serveur en salle"
 *                 description: "Service en salle, restaurant gastronomique."
 *                 latitude: 45.7464
 *                 longitude: 4.8265
 *                 address: "Lyon"
 *                 commune: "Lyon"
 *                 radiusKm: 15
 *                 viewCount: 0
 *                 status: "ACTIVE"
 *                 sector: "Restauration"
 *                 contractType: "CDI"
 *                 salaryMin: 1800
 *                 salaryMax: 2100
 *                 salaryKind: "brut"
 *                 workTime: "35h/semaine"
 *                 geocodeSource: "api-adresse"
 *                 geocodeScore: 0.9673672727272726
 *                 geocodeCitycode: "69382"
 *                 geocodedAt: "2026-09-08T13:46:16.274Z"
 *                 geocodePrecision: "commune"
 *                 publishedAt: "2026-09-08T13:46:16.279Z"
 *                 expiresAt: "2026-10-08T13:46:16.276Z"
 *                 createdAt: "2026-09-08T13:46:16.279Z"
 *               geocoding:
 *                 label: "Lyon"
 *                 score: 0.9673672727272726
 *                 source: "api-adresse"
 *       422: { description: Adresse introuvable via l'API Adresse, ou commune non résolue }
 */
router.post(
  '/',
  authenticate,
  requireEmployer,
  validate(createOfferSchema),
  asyncHandler(async (req, res) => {
    const employerId = await requireEmployerProfileId(req.user!.id);
    const { address, commune, ...rest } = req.body as {
      address: string;
      commune?: string;
      title: string;
      description: string;
      radiusKm: number;
      sector?: string;
      contractType?: string;
      salaryMin?: number;
      salaryMax?: number;
      salaryKind?: string;
      workTime?: string;
      experienceLevel?: string;
      requiredSkills?: string[];
    };

    // Coordonnées cote serveur via l'API Adresse (jamais du client), exigence Vignal.
    const geo = await geocodeAddress(address);
    if (!geo)
      throw new ValidationError(
        "Adresse introuvable via l'API Adresse (BAN). Vérifiez l'adresse saisie.",
      );

    const offer = await prisma.offer.create({
      data: {
        ...rest,
        employerId,
        address: geo.label, // adresse normalisée par la BAN
        commune: commune ?? geo.city ?? undefined,
        latitude: geo.latitude,
        longitude: geo.longitude,
        expiresAt: computeExpiry(),
        geocodeSource: geo.source,
        geocodeScore: geo.score,
        geocodeCitycode: geo.citycode,
        geocodedAt: geo.geocodedAt,
        geocodePrecision: 'commune',
      },
      include: { employer: { select: { companyName: true } } },
    });

    // Temps réel : apparition immédiate côté carte candidat (exigence CDC).
    emitOfferCreated(
      mapOfferForFrontend({ ...offer, companyName: offer.employer.companyName }),
    );

    res.status(201).json({
      offer,
      geocoding: { label: geo.label, score: geo.score, source: geo.source },
    });
  }),
);

/**
 * @openapi
 * /offers/{id}:
 *   get:
 *     tags: [Offers]
 *     summary: Détail d'une offre (incrémente le compteur de vues)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, example: "4a78c625-bba5-441b-8e5c-3a3a75ec817a" }
 *     responses:
 *       200:
 *         description: Offre, exemple réel, capturé le 2026-09-03 (viewCount incrémenté par l'appel)
 *         content:
 *           application/json:
 *             example:
 *               offer:
 *                 id: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                 title: "Développeur Full-Stack"
 *                 address: "Lyon"
 *                 commune: "Lyon"
 *                 latitude: 45.7464
 *                 longitude: 4.8265
 *                 radiusKm: 20
 *                 viewCount: 1
 *                 status: "ACTIVE"
 *                 expiresAt: "2026-10-03T19:21:24.925Z"
 *       404: { description: Introuvable }
 */
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const updated = await prisma.offer
      .update({
        where: { id: req.params.id },
        data: { viewCount: { increment: 1 } },
        include: { employer: { select: { companyName: true } } },
      })
      .catch(() => null);
    if (!updated) throw new NotFoundError('Offre introuvable');
    const { employer, ...offer } = updated;
    res.json({ offer: { ...offer, companyName: employer.companyName } });
  }),
);

/**
 * @openapi
 * /offers/{offerId}/report:
 *   post:
 *     tags: [Offers]
 *     summary: Signaler une offre (feature/admin). Passe l'offre en statut "reported"
 *              et l'entrée en file de modération.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: offerId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { reason: "Offre trompeuse", comment: "Rien à voir avec l'annonce." }
 *     responses:
 *       201: { description: Signalement enregistré }
 *       404: { description: Offre introuvable }
 *       409: { description: Déjà signalée par ce compte }
 */
router.post(
  '/:offerId/report',
  authenticate,
  validate(createReportSchema),
  asyncHandler(async (req, res) => {
    const { offerId } = req.params;
    const { reason, comment } = req.body as { reason: string; comment?: string };

    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) throw new NotFoundError('Offre introuvable');

    const existing = await prisma.report.findUnique({
      where: { offerId_userId: { offerId, userId: req.user!.id } },
    });
    if (existing) throw new ValidationError('Vous avez déjà signalé cette offre');

    // Le modèle Report n'a pas de colonne "comment" dédiée (schéma actuel) : le
    // commentaire libre est concaténé au motif plutôt que perdu silencieusement.
    const report = await prisma.report.create({
      data: {
        offerId,
        userId: req.user!.id,
        reason: comment ? `${reason} : ${comment}` : reason,
      },
    });

    await prisma.offer.update({ where: { id: offerId }, data: { status: 'REPORTED' } });

    res.status(201).json({ report });
  }),
);

/**
 * @openapi
 * /offers/{id}:
 *   patch:
 *     tags: [Offers]
 *     summary: Modifier une de mes offres, ou modérer une offre (admin)
 *     description: >
 *       Un employeur ne peut modifier que ses propres offres. Un compte ADMIN peut modifier
 *       le statut de n'importe quelle offre via cette même route (pas de route /admin dédiée),
 *       c'est ainsi que la modération se conclut après un signalement : status "unpublished"
 *       ou "published" en body, en tant qu'admin, sur l'offre visée par GET /admin/reports.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, example: "4a78c625-bba5-441b-8e5c-3a3a75ec817a" }
 *     requestBody:
 *       content:
 *         application/json:
 *           examples:
 *             employeur:
 *               summary: Modification standard par l'employeur propriétaire
 *               value: { radiusKm: 25 }
 *             moderation_admin:
 *               summary: Moderation par un compte ADMIN, sur l'offre d'un autre employeur
 *               value: { status: "unpublished" }
 *     responses:
 *       200:
 *         description: >
 *           Offre mise à jour. Premier exemple (employeur), capturé le 2026-09-03.
 *           Second exemple (admin, moderation), capturé le 2026-09-10.
 *         content:
 *           application/json:
 *             examples:
 *               employeur:
 *                 value:
 *                   offer:
 *                     id: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                     title: "Développeur Full-Stack"
 *                     radiusKm: 25
 *                     status: "ACTIVE"
 *                     viewCount: 1
 *                     updatedAt: "2026-09-03T19:21:25.576Z"
 *               moderation_admin:
 *                 value:
 *                   offer:
 *                     id: "a03c4805-654d-4707-aeae-90222d85b3c6"
 *                     title: "Offre a moderer"
 *                     status: "ARCHIVED"
 *                     employerId: "61112915-02fc-49da-a866-0536e4aadd4b"
 *                     updatedAt: "2026-09-10T12:17:00.931Z"
 *       403: { description: Offre d'un autre employeur, et le compte n'est pas ADMIN }
 */
router.patch(
  '/:id',
  authenticate,
  validate(updateOfferSchema),
  asyncHandler(async (req, res) => {
    // Modération (admin) : n'importe quelle offre. Employeur : uniquement la sienne.
    // AdminPages.tsx (ModerationPage) réutilise cette même route pour rétablir/retirer
    // une offre signalée, avec le vocabulaire frontend (published/unpublished).
    if (req.user!.role === 'ADMIN') {
      const exists = await prisma.offer.findUnique({ where: { id: req.params.id } });
      if (!exists) throw new NotFoundError('Offre introuvable');
    } else if (req.user!.role === 'EMPLOYER') {
      await loadOwnedOffer(req.params.id, req.user!.id);
    } else {
      throw new ForbiddenError('Rôle insuffisant');
    }

    const data = { ...req.body } as Record<string, unknown>;

    if (typeof data.status === 'string') {
      data.status =
        OFFER_STATUS_FRONTEND_TO_BACKEND[data.status as keyof typeof OFFER_STATUS_FRONTEND_TO_BACKEND] ??
        data.status;
    }

    // Si l'adresse change, on re-géocode cote serveur (coordonnées jamais du client).
    if (typeof data.address === 'string') {
      const geo = await geocodeAddress(data.address);
      if (!geo)
        throw new ValidationError(
          "Adresse introuvable via l'API Adresse (BAN). Vérifiez l'adresse saisie.",
        );
      data.address = geo.label;
      data.latitude = geo.latitude;
      data.longitude = geo.longitude;
      if (!data.commune && geo.city) data.commune = geo.city;
      data.geocodeSource = geo.source;
      data.geocodeScore = geo.score;
      data.geocodeCitycode = geo.citycode;
      data.geocodedAt = geo.geocodedAt;
      data.geocodePrecision = 'commune';
    }

    const offer = await prisma.offer.update({ where: { id: req.params.id }, data });

    // Une modération qui sort l'offre du statut REPORTED referme les signalements
    // ouverts : sans ça, ils resteraient indéfiniment dans la file d'admin/reports.
    if (data.status === 'ACTIVE' || data.status === 'ARCHIVED') {
      await prisma.report.updateMany({
        where: { offerId: offer.id, status: 'PENDING' },
        data: { status: 'REVIEWED' },
      });
    }

    emitOfferUpdated({ id: offer.id, status: offer.status });

    res.json({ offer });
  }),
);

/**
 * @openapi
 * /offers/{id}:
 *   delete:
 *     tags: [Offers]
 *     summary: Supprimer une de mes offres
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Supprimée }
 */
router.delete(
  '/:id',
  authenticate,
  requireEmployer,
  asyncHandler(async (req, res) => {
    await loadOwnedOffer(req.params.id, req.user!.id);
    await prisma.offer.delete({ where: { id: req.params.id } });
    emitOfferRemoved(req.params.id);
    res.status(204).end();
  }),
);

/**
 * @openapi
 * /offers/{id}/export.pdf:
 *   get:
 *     tags: [Offers]
 *     summary: Fiche PDF imprimable d'une de mes offres (employeur)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Fichier PDF }
 *       403: { description: Offre d'un autre employeur }
 *       404: { description: Offre introuvable }
 */
router.get(
  '/:id/export.pdf',
  authenticate,
  requireEmployer,
  asyncHandler(async (req, res) => {
    const offer = await loadOwnedOffer(req.params.id, req.user!.id);
    streamOfferPdf(res, { ...offer, companyName: offer.employer.companyName });
  }),
);

export default router;
