import { Role } from '@prisma/client';

export interface MeUser {
  id: string;
  email: string;
  role: Role;
  isSuspended: boolean;
  geoConsent: boolean;
  geoConsentUpdatedAt: Date | null;
  createdAt: Date;
  profile: {
    type: 'JOBSEEKER' | 'EMPLOYER' | 'NONE';
    data: Record<string, unknown>;
  };
}

type UserWithProfiles = {
  id: string;
  email: string;
  role: Role;
  isSuspended: boolean;
  geoConsent: boolean;
  geoConsentUpdatedAt: Date | null;
  createdAt: Date;
  jobseekerProfile: {
    firstName: string;
    lastName: string;
    phone: string | null;
    skills: string[];
    experience: string | null;
    availability: string | null;
    latitude: number | null;
    longitude: number | null;
    cvPath: string | null;
    cvOriginalName: string | null;
    cvUploadedAt: Date | null;
  } | null;
  employerProfile: {
    companyName: string;
    siret: string | null;
    verified: boolean;
    description: string | null;
    website: string | null;
  } | null;
};

export function serializeUserMe(user: UserWithProfiles): MeUser {
  if (user.jobseekerProfile) {
    // cvPath est un chemin disque serveur, jamais exposé tel quel à l'API.
    const { cvPath: _cvPath, ...jobseekerProfile } = user.jobseekerProfile;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isSuspended: user.isSuspended,
      geoConsent: user.geoConsent,
      geoConsentUpdatedAt: user.geoConsentUpdatedAt,
      createdAt: user.createdAt,
      profile: {
        type: 'JOBSEEKER',
        data: { ...jobseekerProfile, hasCv: user.jobseekerProfile.cvPath !== null },
      },
    };
  }

  if (user.employerProfile) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isSuspended: user.isSuspended,
      geoConsent: user.geoConsent,
      geoConsentUpdatedAt: user.geoConsentUpdatedAt,
      createdAt: user.createdAt,
      profile: { type: 'EMPLOYER', data: { ...user.employerProfile } },
    };
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isSuspended: user.isSuspended,
    geoConsent: user.geoConsent,
    geoConsentUpdatedAt: user.geoConsentUpdatedAt,
    createdAt: user.createdAt,
    profile: { type: 'NONE', data: {} },
  };
}