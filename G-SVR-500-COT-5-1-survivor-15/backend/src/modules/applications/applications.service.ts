import { ApplicationStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { createNotification } from '../notifications/notifications.service';
import { requireEmployerProfileId } from '../offers/offers.service';
import { emitApplicationStatus } from '../../realtime/socket';

const APP_STATUS_TO_FE: Record<ApplicationStatus, string> = {
  PENDING: 'sent',
  VIEWED: 'viewed',
  INTERVIEW: 'interview',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'rejected',
};

const APP_STATUS_TO_LABEL_FR: Record<ApplicationStatus, string> = {
  PENDING: 'envoyée',
  VIEWED: 'vue par l’employeur',
  INTERVIEW: 'entretien proposé',
  ACCEPTED: 'acceptée',
  REJECTED: 'refusée',
  WITHDRAWN: 'retirée',
};

interface ApplicationRowForFrontend {
  id: string;
  offerId: string;
  userId: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: Date;
  offer: { title: string; employer: { companyName: string } };
  user: {
    email: string;
    jobseekerProfile: { firstName: string; lastName: string } | null;
  };
}

/** Forme attendue par le frontend (frontend/src/types/index.ts, `Application`), consommée
 * par le dashboard et l'espace candidatures reçues (employeur). */
function mapApplicationForFrontend(a: ApplicationRowForFrontend) {
  const profile = a.user.jobseekerProfile;
  return {
    id: a.id,
    offerId: a.offerId,
    candidateId: a.userId,
    candidateName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '',
    candidateEmail: a.user.email,
    offerTitle: a.offer.title,
    company: a.offer.employer.companyName,
    status: APP_STATUS_TO_FE[a.status] ?? 'sent',
    message: a.message ?? undefined,
    createdAt: a.createdAt,
  };
}

/** Toutes les candidatures reçues, agrégées sur l'ensemble des offres de l'employeur
 * (aucune route d'agrégat n'existait, uniquement GET /applications/offer/:offerId, une
 * par offre). Consommé par le dashboard employeur et /pro/applications. */
export async function listEmployerApplications(userId: string) {
  const employerId = await requireEmployerProfileId(userId);
  const applications = await prisma.application.findMany({
    where: { offer: { employerId } },
    orderBy: { createdAt: 'desc' },
    include: {
      offer: { select: { title: true, employer: { select: { companyName: true } } } },
      user: {
        select: {
          email: true,
          jobseekerProfile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  return applications.map(mapApplicationForFrontend);
}

/**
 * Change le statut d'une candidature (employeur propriétaire uniquement), notifie le
 * demandeur. Logique partagée entre PATCH /api/applications/:id et
 * PATCH /api/pro/applications/:id (même route, deux chemins attendus côté frontend).
 */
export async function updateApplicationStatus(
  applicationId: string,
  employerUserId: string,
  status: ApplicationStatus,
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { offer: { include: { employer: true } } },
  });
  if (!application) throw new NotFoundError('Candidature introuvable');
  if (application.offer.employer.userId !== employerUserId) {
    throw new ForbiddenError('Cette candidature appartient à un autre employeur');
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });

  await createNotification({
    userId: application.userId,
    title: 'Mise à jour de votre candidature',
    message: `Votre candidature pour « ${application.offer.title} » : ${APP_STATUS_TO_LABEL_FR[status]}.`,
    type: 'application_status',
  });

  emitApplicationStatus({ id: updated.id, offerId: updated.offerId, status: APP_STATUS_TO_FE[status] });

  return updated;
}

export async function updateApplicationStatusForFrontend(
  applicationId: string,
  employerUserId: string,
  status: ApplicationStatus,
) {
  const updated = await updateApplicationStatus(applicationId, employerUserId, status);
  const full = await prisma.application.findUniqueOrThrow({
    where: { id: updated.id },
    include: {
      offer: { select: { title: true, employer: { select: { companyName: true } } } },
      user: {
        select: {
          email: true,
          jobseekerProfile: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  return mapApplicationForFrontend(full);
}
