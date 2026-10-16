import bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyRefreshToken,
  verifyResetToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from '../../config/jwt';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../../utils/errors';
import type { LoginInput, RegisterInput } from './auth.schemas';
import { sendMail } from '../mail/mail.service';
import { registrationEmail, resetPasswordEmail } from '../mail/templates';
import { loadEnv } from '../../config/env';

const env = loadEnv();

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  geoConsent: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

/** User chargé avec ses profils (prénom/nom pour un chercheur, entreprise pour un employeur). */
type UserWithProfile = {
  id: string;
  email: string;
  role: Role;
  geoConsent: boolean;
  jobseekerProfile?: { firstName: string; lastName: string } | null;
  employerProfile?: { companyName: string } | null;
};

function serializeUser(user: UserWithProfile): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    geoConsent: user.geoConsent,
    firstName: user.jobseekerProfile?.firstName,
    lastName: user.jobseekerProfile?.lastName,
    companyName: user.employerProfile?.companyName,
  };
}

async function createSession(userId: string, refreshToken: string): Promise<void> {
  await prisma.session.create({
    data: {
      userId,
      refreshToken: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });
}

const profileInclude = {
  jobseekerProfile: { select: { firstName: true, lastName: true } },
  employerProfile: { select: { companyName: true } },
};

/** Profil créé dès l'inscription : prénom/nom (chercheur) ou entreprise (employeur). */
async function createProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  role: Role,
  input: RegisterInput,
): Promise<void> {
  if (role === Role.JOBSEEKER) {
    await tx.jobseekerProfile.create({
      data: {
        userId,
        firstName: input.firstName ?? '',
        lastName: input.lastName ?? '',
      },
    });
  } else if (role === Role.EMPLOYER && input.companyName !== undefined) {
    await tx.employerProfile.create({
      data: { userId, companyName: input.companyName },
    });
  }
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Un compte existe déjà avec cet email');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: input.role,
      },
    });
    await createProfile(tx, created.id, created.role, input);
    return created;
  });

  const refreshToken = signRefreshToken({ id: user.id, role: user.role });
  await createSession(user.id, refreshToken);

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: profileInclude,
  });

  // E-mail de bienvenue best-effort : une panne SMTP ne doit jamais bloquer l'inscription.
  try {
    await sendMail({
      to: user.email,
      subject: 'Bienvenue sur GéoEmploi',
      html: registrationEmail(input.firstName),
    });
  } catch (err) {
    console.error("Échec d'envoi de l'e-mail de bienvenue :", err);
  }

  return {
    accessToken: signAccessToken({ id: user.id, role: user.role, email: user.email }),
    refreshToken,
    user: serializeUser(fullUser!),
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: profileInclude,
  });
  if (!user || user.deletedAt) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }
  if (user.isSuspended) {
    throw new ForbiddenError('Compte suspendu');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Email ou mot de passe incorrect');
  }

  const refreshToken = signRefreshToken({ id: user.id, role: user.role });
  await createSession(user.id, refreshToken);

  return {
    accessToken: signAccessToken({ id: user.id, role: user.role, email: user.email }),
    refreshToken,
    user: serializeUser(user),
  };
}

export async function refreshToken(refreshToken: string): Promise<AuthResult> {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({ where: { refreshToken: tokenHash } });
  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Session expirée ou révoquée');
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.deletedAt) {
    throw new UnauthorizedError('Utilisateur introuvable');
  }
  if (user.isSuspended) {
    throw new ForbiddenError('Compte suspendu');
  }

  // deleteMany (pas delete) : deux requêtes /auth/refresh quasi simultanées avec
  // le même refresh token pouvaient faire planter la seconde (Prisma P2025, session
  // déjà supprimée par la première, delete() lève si la ligne n'existe plus).
  // Avec deleteMany, la seconde requête ne lève pas : count vaut 0, on renvoie
  // proprement 401 plutôt qu'un 500, tout en gardant la rotation à usage unique.
  const revoked = await prisma.session.deleteMany({
    where: { id: session.id, refreshToken: tokenHash },
  });
  if (revoked.count === 0) {
    throw new UnauthorizedError('Session expirée ou révoquée');
  }

  const newRefreshToken = signRefreshToken({ id: user.id, role: user.role });
  await createSession(user.id, newRefreshToken);

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: profileInclude,
  });

  return {
    accessToken: signAccessToken({ id: user.id, role: user.role, email: user.email }),
    refreshToken: newRefreshToken,
    user: serializeUser(fullUser!),
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.session.deleteMany({ where: { refreshToken: hashRefreshToken(refreshToken) } });
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: profileInclude,
  });
  if (!user || user.deletedAt) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  return serializeUser(user);
}

export function isPrismaUniqueError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Demande de réinitialisation de mot de passe.
 * Ne révèle jamais si l'email existe (anti-énumération) : on renvoie le même
 * résultat que l'adresse existe ou non. En dev, le token de reset est renvoyé
 * dans la réponse (pas d'infrastructure email en local).
 */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt || user.isSuspended) {
    return;
  }
  const resetToken = signResetToken(user.id);
  const resetLink = `${env.APP_URL}/reinitialisation/${resetToken}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe GéoEmploi',
      html: resetPasswordEmail(resetLink),
    });
  } catch (err) {
    console.error("Échec d'envoi de l'e-mail de réinitialisation :", err);
  }
}

/**
 * Réinitialise réellement le mot de passe après validation du token.
 * Révoque toutes les sessions actives de l'utilisateur pour le forcer à se reconnecter.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = verifyResetToken(token);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new UnauthorizedError('Lien de réinitialisation invalide ou expiré');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
  ]);
}