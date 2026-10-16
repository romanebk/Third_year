import { Router, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schemas';
import {
  login,
  logout,
  refreshToken,
  register,
  requestPasswordReset,
  resetPassword,
} from './auth.service';

const router = Router();

/**
 * POST /register
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Inscription (demandeur ou employeur)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [JOBSEEKER, EMPLOYER] }
 *     responses:
 *       201:
 *         description: Compte créé, tokens retournés, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 15 min)"
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 7 jours)"
 *               user:
 *                 id: "cc466915-33df-479a-aaae-1ff6ef7e82e1"
 *                 email: "arch-cand-1788469862@test.fr"
 *                 role: "JOBSEEKER"
 *                 geoConsent: false
 *                 firstName: "Ariane"
 *                 lastName: "Docs"
 */
router.post(
  '/register',
  validate(registerSchema),
  async (req, res, next: NextFunction) => {
    try {
      const result = await register(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /login
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Connexion
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Tokens retournés, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 15 min)"
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 7 jours)"
 *               user:
 *                 id: "cc466915-33df-479a-aaae-1ff6ef7e82e1"
 *                 email: "arch-cand-1788469862@test.fr"
 *                 role: "JOBSEEKER"
 *                 geoConsent: false
 *                 firstName: "Ariane"
 *                 lastName: "Docs"
 */
router.post(
  '/login',
  validate(loginSchema),
  async (req, res, next: NextFunction) => {
    try {
      const result = await login(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /refresh
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Renouveler les tokens via refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Nouveaux tokens (rotation, l'ancien refresh token est invalidé), exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(JWT, 15 min)"
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(nouveau JWT, 7 jours)"
 *               user:
 *                 id: "cc466915-33df-479a-aaae-1ff6ef7e82e1"
 *                 email: "arch-cand-1788469862@test.fr"
 *                 role: "JOBSEEKER"
 *                 geoConsent: false
 *                 firstName: "Ariane"
 *                 lastName: "Docs"
 */
router.post(
  '/refresh',
  validate(refreshSchema),
  async (req, res, next: NextFunction) => {
    try {
      const result = await refreshToken(req.body.refreshToken);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /logout
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Déconnexion, révoque la session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       204:
 *         description: Session révoquée, vérifié réel (204 sans corps, capturé le 2026-09-03)
 */
router.post(
  '/logout',
  validate(logoutSchema),
  async (req, res, next: NextFunction) => {
    try {
      await logout(req.body.refreshToken);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /forgot-password
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Demander un lien de réinitialisation de mot de passe
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     description: >
 *       Anti-énumération, la réponse est identique que le compte existe ou non. Le lien de
 *       réinitialisation est envoyé par e-mail (SMTP réel si configuré, sinon écrit dans
 *       backend/mail-outbox/ en .eml), jamais retourné dans la réponse API.
 *     responses:
 *       200:
 *         description: Traité, corps vide, vérifié réel (e-mail reçu via SMTP), capturé le 2026-09-10
 *         content:
 *           application/json:
 *             example: {}
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req, res, next: NextFunction) => {
    try {
      await requestPasswordReset(req.body.email);
      res.status(200).json({});
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /reset-password
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe avec un token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Mot de passe réinitialisé, sessions révoquées, exemple réel, capturé le 2026-09-03
 *         content:
 *           application/json:
 *             example:
 *               message: "Mot de passe réinitialisé"
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req, res, next: NextFunction) => {
    try {
      await resetPassword(req.body.token, req.body.password);
      res.status(200).json({ message: 'Mot de passe réinitialisé' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;