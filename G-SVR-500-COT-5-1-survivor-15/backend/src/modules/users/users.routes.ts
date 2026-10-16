import { Router, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireJobseeker } from '../../middleware/roles';
import { validate } from '../../middleware/validate';
import { geoConsentSchema, updateMeSchema } from './users.schemas';
import {
  deleteCv,
  deleteMe,
  exportMyData,
  getCvFile,
  getMe,
  saveCv,
  updateGeoConsent,
  updateMe,
} from './users.service';
import { uploadCv } from './cv-upload';
import { ValidationError } from '../../utils/errors';

const router = Router();

router.use(authenticate);

/**
 * GET /me
 * @openapi
 * /users/me:
 *   get:
 *     summary: Profil du user connecté
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Informations du compte et profil, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               id: "cc466915-33df-479a-aaae-1ff6ef7e82e1"
 *               email: "arch-cand-1788469862@test.fr"
 *               role: "JOBSEEKER"
 *               isSuspended: false
 *               geoConsent: false
 *               geoConsentUpdatedAt: null
 *               createdAt: "2026-09-03T21:11:02.385Z"
 *               profile:
 *                 type: "JOBSEEKER"
 *                 data:
 *                   firstName: "Ariane"
 *                   lastName: "Docs"
 *                   phone: null
 *                   skills: []
 *                   experience: null
 *                   availability: null
 *                   cvOriginalName: null
 *                   cvUploadedAt: null
 *                   hasCv: false
 */
router.get('/me', async (req, res, next: NextFunction) => {
  try {
    const me = await getMe(req.user!.id);
    res.json(me);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /me
 * @openapi
 * /users/me:
 *   patch:
 *     summary: Modifier email et/ou mot de passe
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phone: { type: string }
 *               skills: { type: array, items: { type: string } }
 *               experience: { type: string }
 *               availability: { type: string }
 *           example: { phone: "0655443322", skills: ["Accueil", "Caisse"] }
 *     responses:
 *       200:
 *         description: Profil mis à jour, exemple réel (PATCH phone+skills), capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               id: "cc466915-33df-479a-aaae-1ff6ef7e82e1"
 *               email: "arch-cand-1788469862@test.fr"
 *               role: "JOBSEEKER"
 *               profile:
 *                 type: "JOBSEEKER"
 *                 data:
 *                   firstName: "Ariane"
 *                   lastName: "Docs"
 *                   phone: "0655443322"
 *                   skills: ["Accueil", "Caisse"]
 *                   hasCv: false
 */
router.patch('/me', validate(updateMeSchema), async (req, res, next: NextFunction) => {
  try {
    const me = await updateMe(req.user!.id, req.body);
    res.json(me);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /me
 * @openapi
 * /users/me:
 *   delete:
 *     summary: Supprimer son compte (RGPD)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204:
 *         description: >
 *           Compte archivé (soft-delete : deletedAt posé, sessions révoquées).
 *           L'email est anonymisé pour rester réutilisable, vérifié réel
 *           (suppression puis réinscription même email → 201), capturé le 2026-09-03.
 */
router.delete('/me', async (req, res, next: NextFunction) => {
  try {
    await deleteMe(req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /me/geo-consent
 * @openapi
 * /users/me/geo-consent:
 *   put:
 *     summary: Donner/retirer le consentement géolocalisation (RGPD)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [geoConsent]
 *             properties:
 *               geoConsent: { type: boolean }
 *     responses:
 *       204:
 *         description: Consentement mis à jour, vérifié réel (204 sans corps), capturé le 2026-09-03
 */
router.put('/me/geo-consent', validate(geoConsentSchema), async (req, res, next: NextFunction) => {
  try {
    await updateGeoConsent(req.user!.id, req.body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /me/cv
 * @openapi
 * /users/me/cv:
 *   post:
 *     summary: Envoyer/remplacer son CV (demandeur, PDF, 5 Mo max)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cv: { type: string, format: binary }
 *     responses:
 *       204:
 *         description: CV enregistré (stockage disque local, jamais un service objet managé), vérifié réel, capturé le 2026-09-03
 *       400:
 *         description: Fichier manquant ou non-PDF
 */
router.post('/me/cv', requireJobseeker, uploadCv, async (req, res, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('Fichier CV manquant (champ "cv")');
    await saveCv(req.user!.id, { path: req.file.path, originalname: req.file.originalname });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /me/cv
 * @openapi
 * /users/me/cv:
 *   get:
 *     summary: Télécharger son propre CV
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: >
 *           Fichier PDF (Content-Disposition: attachment), vérifié réel :
 *           `attachment; filename="arch-cv.pdf"`, capturé le 2026-09-03
 *       404: { description: Aucun CV enregistré }
 */
router.get('/me/cv', requireJobseeker, async (req, res, next: NextFunction) => {
  try {
    const cv = await getCvFile(req.user!.id);
    res.download(cv.path, cv.originalName);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /me/cv
 * @openapi
 * /users/me/cv:
 *   delete:
 *     summary: Supprimer son CV
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       204: { description: CV supprimé }
 *       404: { description: Aucun CV enregistré }
 */
router.delete('/me/cv', requireJobseeker, async (req, res, next: NextFunction) => {
  try {
    await deleteCv(req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /me/export
 * @openapi
 * /users/me/export:
 *   get:
 *     summary: Export de portabilité (RGPD, article 20), toutes les données personnelles du compte
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Fichier JSON téléchargeable, ne contient jamais le mot de passe }
 */
router.get('/me/export', async (req, res, next: NextFunction) => {
  try {
    const data = await exportMyData(req.user!.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="geoemploi-export-${req.user!.id}.json"`,
    );
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    next(err);
  }
});

export default router;