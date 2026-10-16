import { Router } from 'express';
import { ApplicationStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { requireJobseeker, requireEmployer } from '../../middleware/roles';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { createNotification } from '../notifications/notifications.service';
import { getCvFile } from '../users/users.service';
import { sendMail } from '../mail/mail.service';
import { applicationReceivedEmail } from '../mail/templates';
import {
  applySchema,
  updateApplicationStatusSchema,
  listByOfferQuery,
} from './applications.schema';
import { updateApplicationStatus } from './applications.service';

/**
 * Module Applications, feature/employer (+ consommation feature/job-seeker)
 * POST /                     : un demandeur postule (notifie l'employeur)
 * GET  /mine                 : ses candidatures (demandeur)
 * GET  /offer/:offerId       : candidatures d'une offre (employeur propriétaire)
 * PATCH /:id                 : l'employeur change le statut (notifie le demandeur)
*/
 
const router = Router();

/**
 * @openapi
 * /applications:
 *   post:
 *     tags: [Applications]
 *     summary: Postuler à une offre (demandeur authentifié)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { offerId: "4a78c625-bba5-441b-8e5c-3a3a75ec817a", message: "Disponible immédiatement, très motivée." }
 *     responses:
 *       201:
 *         description: Candidature transmise (employeur notifié), exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               application:
 *                 id: "8d34f235-998e-413e-9bab-13a8a1f0e784"
 *                 offerId: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                 userId: "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2"
 *                 status: "PENDING"
 *                 message: "Disponible immédiatement, très motivée."
 *                 createdAt: "2026-09-03T19:21:36.173Z"
 *       404: { description: Offre indisponible }
 *       409: { description: Déjà postulé }
*/

router.post(
  '/',
  authenticate,
  requireJobseeker,
  validate(applySchema),
  asyncHandler(async (req, res) => {
    const { offerId, message } = req.body as { offerId: string; message?: string };
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: { employer: { include: { user: true } } },
    });
    if (!offer || offer.status !== 'ACTIVE') throw new NotFoundError('Offre indisponible');

    const existing = await prisma.application.findUnique({
      where: { offerId_userId: { offerId, userId: req.user!.id } },
    });
    if (existing) throw new ValidationError('Vous avez déjà postulé à cette offre');

    const application = await prisma.application.create({
      data: { offerId, userId: req.user!.id, message },
    });

    // Exigence CDC : notifier l'employeur à chaque candidature.
    await createNotification({
      userId: offer.employer.userId,
      title: 'Nouvelle candidature',
      message: `Nouvelle candidature pour « ${offer.title} ».`,
      type: 'application_received',
    });

    // E-mail best-effort en plus de la notification in-app : une panne SMTP
    // ne doit jamais faire échouer l'envoi de la candidature.
    try {
      const candidate = await prisma.jobseekerProfile.findUnique({
        where: { userId: req.user!.id },
        select: { firstName: true, lastName: true },
      });
      const candidateName = candidate
        ? `${candidate.firstName} ${candidate.lastName}`
        : req.user!.email;
      await sendMail({
        to: offer.employer.user.email,
        subject: `Nouvelle candidature pour « ${offer.title} »`,
        html: applicationReceivedEmail(offer.title, candidateName),
      });
    } catch (err) {
      console.error("Échec d'envoi de l'e-mail de candidature reçue :", err);
    }

    res.status(201).json({ application });
  }),
);

/**
 * @openapi
 * /applications/mine:
 *   get:
 *     tags: [Applications]
 *     summary: Mes candidatures (demandeur) avec statut et offre
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Suivi des candidatures, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               applications:
 *                 - id: "8d34f235-998e-413e-9bab-13a8a1f0e784"
 *                   offerId: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                   userId: "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2"
 *                   status: "PENDING"
 *                   message: "Disponible immédiatement, très motivée."
 *                   createdAt: "2026-09-03T19:21:36.173Z"
 *                   offer:
 *                     id: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                     title: "Développeur Full-Stack"
 *                     commune: "Lyon"
 *                     status: "ACTIVE"
 *                     employer: { companyName: "Swagger Demo SARL" }
 *               count: 1
 */
router.get(
  '/mine',
  authenticate,
  requireJobseeker,
  asyncHandler(async (req, res) => {
    const applications = await prisma.application.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        offer: {
          select: {
            id: true,
            title: true,
            commune: true,
            status: true,
            employer: { select: { companyName: true } },
          },
        },
      },
    });
    res.json({ applications, count: applications.length });
  }),
);

/**
 * @openapi
 * /applications/offer/{offerId}:
 *   get:
 *     tags: [Applications]
 *     summary: Candidatures reçues pour une de mes offres (employeur)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: offerId, required: true, schema: { type: string }, example: "4a78c625-bba5-441b-8e5c-3a3a75ec817a" }
 *       - { in: query, name: status, schema: { type: string, enum: [PENDING, ACCEPTED, REJECTED, WITHDRAWN] } }
 *     responses:
 *       200:
 *         description: Candidatures + coordonnées du candidat, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               applications:
 *                 - id: "8d34f235-998e-413e-9bab-13a8a1f0e784"
 *                   offerId: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                   userId: "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2"
 *                   status: "PENDING"
 *                   message: "Disponible immédiatement, très motivée."
 *                   createdAt: "2026-09-03T19:21:36.173Z"
 *                   user:
 *                     id: "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2"
 *                     email: "swagger-cand-demo@test.fr"
 *                     jobseekerProfile:
 *                       firstName: "Camille"
 *                       lastName: "Swagger"
 *                       phone: null
 *                       skills: []
 *                       experience: null
 *                       availability: null
 *               count: 1
 *       403: { description: Offre d'un autre employeur }
 */
router.get(
  '/offer/:offerId',
  authenticate,
  requireEmployer,
  validate(listByOfferQuery, 'query'),
  asyncHandler(async (req, res) => {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.offerId },
      include: { employer: true },
    });
    if (!offer) throw new NotFoundError('Offre introuvable');
    if (offer.employer.userId !== req.user!.id)
      throw new ForbiddenError('Cette offre appartient à un autre employeur');

    const { status } = req.query as { status?: ApplicationStatus };
    const applications = await prisma.application.findMany({
      where: { offerId: offer.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            jobseekerProfile: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                skills: true,
                experience: true,
                availability: true,
                cvOriginalName: true,
                cvUploadedAt: true,
              },
            },
          },
        },
      },
    });
    res.json({ applications, count: applications.length });
  }),
);

/**
 * @openapi
 * /applications/offer/{offerId}/export.csv:
 *   get:
 *     tags: [Applications]
 *     summary: Export CSV des candidatures reçues pour une de mes offres (employeur)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: offerId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Fichier CSV }
 *       403: { description: Offre d'un autre employeur }
 *       404: { description: Offre introuvable }
 */
router.get(
  '/offer/:offerId/export.csv',
  authenticate,
  requireEmployer,
  asyncHandler(async (req, res) => {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.offerId },
      include: { employer: true },
    });
    if (!offer) throw new NotFoundError('Offre introuvable');
    if (offer.employer.userId !== req.user!.id)
      throw new ForbiddenError('Cette offre appartient à un autre employeur');

    const applications = await prisma.application.findMany({
      where: { offerId: offer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { include: { jobseekerProfile: { select: { firstName: true, lastName: true, phone: true } } } },
      },
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ['Candidat', 'Email', 'Téléphone', 'Statut', 'Message', 'Date'].join(',');
    const rows = applications.map((a) => {
      const profile = a.user.jobseekerProfile;
      const name = profile ? `${profile.firstName} ${profile.lastName}` : '-';
      return [
        escape(name),
        escape(a.user.email),
        escape(profile?.phone ?? ''),
        escape(a.status),
        escape(a.message ?? ''),
        escape(a.createdAt.toISOString()),
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="candidatures-${offer.id}.csv"`,
    );
    res.send('﻿' + csv); // BOM, ouverture correcte des accents dans Excel
  }),
);

/**
 * @openapi
 * /applications/{id}/cv:
 *   get:
 *     tags: [Applications]
 *     summary: Télécharger le CV du candidat pour une de mes candidatures reçues (employeur)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Fichier PDF }
 *       403: { description: Candidature d'un autre employeur }
 *       404: { description: Candidature ou CV introuvable }
 */
router.get(
  '/:id/cv',
  authenticate,
  requireEmployer,
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { offer: { include: { employer: true } } },
    });
    if (!application) throw new NotFoundError('Candidature introuvable');
    if (application.offer.employer.userId !== req.user!.id)
      throw new ForbiddenError('Cette candidature appartient à un autre employeur');

    const cv = await getCvFile(application.userId);
    res.download(cv.path, cv.originalName);
  }),
);

/**
 * @openapi
 * /applications/{id}:
 *   patch:
 *     tags: [Applications]
 *     summary: Changer le statut d'une candidature (employeur)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, example: "8d34f235-998e-413e-9bab-13a8a1f0e784" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example: { status: "ACCEPTED" }
 *     responses:
 *       200:
 *         description: Statut mis à jour (demandeur notifié), exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               application:
 *                 id: "8d34f235-998e-413e-9bab-13a8a1f0e784"
 *                 offerId: "4a78c625-bba5-441b-8e5c-3a3a75ec817a"
 *                 userId: "0608f25c-2586-4be6-a87b-1a2bb8b3e3c2"
 *                 status: "ACCEPTED"
 *                 message: "Disponible immédiatement, très motivée."
 *                 updatedAt: "2026-09-03T19:21:36.680Z"
 *       403: { description: Candidature d'un autre employeur }
 */
router.patch(
  '/:id',
  authenticate,
  requireEmployer,
  validate(updateApplicationStatusSchema),
  asyncHandler(async (req, res) => {
    const updated = await updateApplicationStatus(
      req.params.id,
      req.user!.id,
      req.body.status as ApplicationStatus,
    );

    res.json({ application: updated });
  }),
);

export default router;
