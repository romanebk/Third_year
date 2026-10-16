import { z } from 'zod';

export const updateMeSchema = z
  .object({
    email: z.string().email('Email invalide').max(254).optional(),
    password: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .max(72)
      .optional(),
    firstName: z.string().trim().min(1, 'Le prénom est obligatoire').max(80).optional(),
    lastName: z.string().trim().min(1, 'Le nom est obligatoire').max(80).optional(),
    companyName: z.string().trim().min(1, 'Le nom de l’entreprise est obligatoire').max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    experience: z.string().trim().max(2000).optional(),
    availability: z.string().trim().max(120).optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.password !== undefined ||
      data.firstName !== undefined ||
      data.lastName !== undefined ||
      data.companyName !== undefined ||
      data.phone !== undefined ||
      data.skills !== undefined ||
      data.experience !== undefined ||
      data.availability !== undefined,
    { message: 'Au moins un champ à modifier' },
  );

export const geoConsentSchema = z.object({
  geoConsent: z.boolean(),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type GeoConsentInput = z.infer<typeof geoConsentSchema>;