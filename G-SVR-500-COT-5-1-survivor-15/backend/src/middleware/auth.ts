/**
 * Middleware d'authentification (feature/auth).
 *
 * Deux gardes Express à utiliser sur les routes protégées :
 *  - `authenticate`  → OBLIGE un utilisateur connecté (sinon 401)
 *  - `optionalAuth`  → autorise l'accès public, mais injecte `req.user`
 *                       si un token valide est fourni (lecture publique
 *                       avec contexte utilisateur, ex. offre à proximité).
 *
 * Après passage, `req.user` contient { id, email, role } (voir types/express.d.ts).
 */
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../config/jwt';
import { UnauthorizedError } from '../utils/errors';

/** Extrait le token de l'en-tête `Authorization: Bearer <token>`, ou null. */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Authentification obligatoire.
 * - Pas de token            → UnauthorizedError (401)
 * - Token invalide/expiré   → UnauthorizedError (401)
 * - Token valide            → `req.user` injecté puis `next()`
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(new UnauthorizedError('Authentification requise'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authentification optionnelle (consultation publique avec contexte utilisateur si connecté).
 * - Pas de token   → on continue anonyme (next sans req.user)
 * - Token invalide → on continue anonyme aussi (silencieux, pas d'erreur)
 * - Token valide   → req.user injecté
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    // token invalide : on traite la requête comme anonyme
  }
  next();
}