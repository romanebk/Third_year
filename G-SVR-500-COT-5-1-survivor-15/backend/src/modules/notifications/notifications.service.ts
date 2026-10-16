import { prisma } from '../../config/database';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
}

/**
 * Service interne, appelé par le module applications lors d'une candidature.
 * Implémentation complète : feature/admin
 */
export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({ data: input });
}
