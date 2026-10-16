import { Router } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { NotFoundError } from '../../utils/errors';

/**
 * Module Notifications, feature/admin.
 * Signalé par Ariel (09/09/2026) : entièrement vide, NotificationsPage.tsx (front)
 * affichait une liste 100% statique. createNotification() (notifications.service.ts)
 * est bien appelé par le module applications, mais rien ne les exposait côté API.
 * Endpoints publics : GET /, PATCH /:id (lue), PATCH /read-all (tout marquer lu).
 */
const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Mes notifications, les plus récentes en premier
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Tableau de notifications (pas d'enveloppe) }
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  }),
);

/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marquer toutes mes notifications comme lues
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: OK }
 */
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.status(204).send();
  }),
);

/**
 * @openapi
 * /notifications/{id}:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marquer une notification comme lue
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: OK }
 *       404: { description: Introuvable }
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.id) {
      throw new NotFoundError('Notification introuvable');
    }
    await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.status(204).send();
  }),
);

export default router;
