import bcrypt from 'bcrypt';
import fs from 'fs';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { serializeUserMe, type MeUser } from './users.types';
import type { GeoConsentInput, UpdateMeInput } from './users.schemas';

export async function getMe(userId: string): Promise<MeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { jobseekerProfile: true, employerProfile: true },
  });
  if (!user || user.deletedAt) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  return serializeUserMe(user);
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<MeUser> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || existing.deletedAt) {
    throw new NotFoundError('Utilisateur introuvable');
  }

  const data: { email?: string; passwordHash?: string } = {};

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        throw new ConflictError('Un compte existe déjà avec cet email');
      }
      data.email = email;
    }
  }

  if (input.password !== undefined) {
    data.passwordHash = await bcrypt.hash(input.password, 10);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data });

    const hasJobseekerFields =
      input.firstName !== undefined ||
      input.lastName !== undefined ||
      input.phone !== undefined ||
      input.skills !== undefined ||
      input.experience !== undefined ||
      input.availability !== undefined;

    if (hasJobseekerFields) {
      await tx.jobseekerProfile.upsert({
        where: { userId },
        create: {
          userId,
          firstName: input.firstName ?? '',
          lastName: input.lastName ?? '',
          phone: input.phone,
          skills: input.skills ?? [],
          experience: input.experience,
          availability: input.availability,
        },
        update: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          skills: input.skills,
          experience: input.experience,
          availability: input.availability,
        },
      });
    }

    if (input.companyName !== undefined) {
      await tx.employerProfile.upsert({
        where: { userId },
        create: {
          userId,
          companyName: input.companyName,
        },
        update: {
          companyName: input.companyName,
        },
      });
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { jobseekerProfile: true, employerProfile: true },
  });
  if (!user) {
    throw new NotFoundError('Utilisateur introuvable');
  }
  return serializeUserMe(user);
}

export async function deleteMe(userId: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing || existing.deletedAt) {
    throw new NotFoundError('Utilisateur introuvable');
  }

  const profile = await prisma.jobseekerProfile.findUnique({ where: { userId } });
  if (profile?.cvPath) {
    fs.unlink(profile.cvPath, () => undefined);
  }

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        // email est @unique en base : sans anonymisation, un compte supprimé
        // bloque à vie la réinscription avec cette adresse (le check applicatif
        // deletedAt ne suffit pas, la contrainte SQL rejetterait quand même l'insert).
        email: `deleted-${userId}@geoemploi.invalid`,
      },
    }),
  ]);
}

/**
 * Export de portabilité (RGPD, article 20) : l'intégralité des données
 * personnelles du compte, dans un format structuré et réutilisable. Ne
 * contient jamais le mot de passe (haché ou non) ni les identifiants de
 * session. Exigence Florine Pontaillac, 8 septembre 2026.
 */
export async function exportMyData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      jobseekerProfile: true,
      employerProfile: { include: { offers: true } },
      applications: { include: { offer: { select: { id: true, title: true } } } },
      notifications: true,
      reports: true,
    },
  });
  if (!user || user.deletedAt) {
    throw new NotFoundError('Utilisateur introuvable');
  }

  return {
    exportedAt: new Date().toISOString(),
    compte: {
      id: user.id,
      email: user.email,
      role: user.role,
      geoConsent: user.geoConsent,
      geoConsentUpdatedAt: user.geoConsentUpdatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    profilCandidat: user.jobseekerProfile
      ? {
          firstName: user.jobseekerProfile.firstName,
          lastName: user.jobseekerProfile.lastName,
          phone: user.jobseekerProfile.phone,
          skills: user.jobseekerProfile.skills,
          experience: user.jobseekerProfile.experience,
          availability: user.jobseekerProfile.availability,
          cvOriginalName: user.jobseekerProfile.cvOriginalName,
          cvUploadedAt: user.jobseekerProfile.cvUploadedAt,
        }
      : null,
    profilEmployeur: user.employerProfile
      ? {
          companyName: user.employerProfile.companyName,
          siret: user.employerProfile.siret,
          verified: user.employerProfile.verified,
          description: user.employerProfile.description,
          website: user.employerProfile.website,
          offresPubliees: user.employerProfile.offers.map((o) => ({
            id: o.id,
            title: o.title,
            status: o.status,
            createdAt: o.createdAt,
          })),
        }
      : null,
    candidatures: user.applications.map((a) => ({
      id: a.id,
      offre: a.offer.title,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
    })),
    notifications: user.notifications.map((n) => ({
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt,
    })),
    signalements: user.reports.map((r) => ({
      offerId: r.offerId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
    })),
  };
}

export async function updateGeoConsent(userId: string, input: GeoConsentInput): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      geoConsent: input.geoConsent,
      geoConsentUpdatedAt: new Date(),
    },
  });
}

export async function saveCv(
  userId: string,
  file: { path: string; originalname: string },
): Promise<void> {
  const existing = await prisma.jobseekerProfile.findUnique({ where: { userId } });
  if (!existing) {
    fs.unlinkSync(file.path);
    throw new NotFoundError('Profil demandeur introuvable');
  }

  if (existing.cvPath && existing.cvPath !== file.path) {
    fs.unlink(existing.cvPath, () => undefined);
  }

  await prisma.jobseekerProfile.update({
    where: { userId },
    data: {
      cvPath: file.path,
      cvOriginalName: file.originalname,
      cvUploadedAt: new Date(),
    },
  });
}

export async function getCvFile(
  userId: string,
): Promise<{ path: string; originalName: string }> {
  const profile = await prisma.jobseekerProfile.findUnique({ where: { userId } });
  if (!profile?.cvPath) {
    throw new NotFoundError('Aucun CV enregistré');
  }
  return { path: profile.cvPath, originalName: profile.cvOriginalName ?? 'cv.pdf' };
}

export async function deleteCv(userId: string): Promise<void> {
  const profile = await prisma.jobseekerProfile.findUnique({ where: { userId } });
  if (!profile?.cvPath) {
    throw new NotFoundError('Aucun CV enregistré');
  }

  fs.unlink(profile.cvPath, () => undefined);

  await prisma.jobseekerProfile.update({
    where: { userId },
    data: { cvPath: null, cvOriginalName: null, cvUploadedAt: null },
  });
}