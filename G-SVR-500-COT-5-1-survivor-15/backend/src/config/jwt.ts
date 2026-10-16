import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { loadEnv } from './env';
import { UnauthorizedError } from '../utils/errors';

const env = loadEnv();

export interface TokenUser {
  id: string;
  role: Role;
}

export interface AccessTokenPayload extends TokenUser {
  email: string;
}

export function signAccessToken(user: AccessTokenPayload): string {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(user: TokenUser): string {
  // `jti` aléatoire → chaque token est unique, même signé dans la même seconde
  // (l'`iat` JWT a une résolution de 1 s : sans jti, deux tokens identiques
  // casseraient la rotation et la contrainte UNIQUE sur Session.refreshToken).
  return jwt.sign(
    { sub: user.id, role: user.role, jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    return { id: String(payload.sub), role: payload.role as Role, email: payload.email as string };
  } catch {
    throw new UnauthorizedError('Token d’accès invalide ou expiré');
  }
}

export function verifyRefreshToken(token: string): TokenUser {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    return { id: String(payload.sub), role: payload.role as Role };
  } catch {
    throw new UnauthorizedError('Refresh token invalide ou expiré');
  }
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signResetToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  } as SignOptions);
}

export function verifyResetToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    return String(payload.sub);
  } catch {
    throw new UnauthorizedError('Lien de réinitialisation invalide ou expiré');
  }
}

export function refreshTokenExpiry(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  if (!match) throw new Error(`JWT_REFRESH_EXPIRES_IN invalide: ${env.JWT_REFRESH_EXPIRES_IN}`);
  const value = Number(match[1]);
  const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + value * unitMs[match[2]]);
}