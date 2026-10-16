import { z } from 'zod';

export const listOffersQuery = z.object({
  status: z.enum(['published', 'unpublished', 'reported']).optional(),
  // Id du compte User employeur (pas EmployerProfile.id) : c'est ce que /admin/users
  // renvoie déjà, pour ne pas exposer un second identifiant côté frontend.
  employerId: z.string().uuid().optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended']),
});
