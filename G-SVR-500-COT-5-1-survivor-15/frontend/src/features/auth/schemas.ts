import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(10, '10 caractères minimum')
  .regex(/[A-Z]/, 'Au moins une majuscule')
  .regex(/\d/, 'Au moins un chiffre');

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe obligatoire'),
  remember: z.boolean().optional(),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const candidateStep1 = z
  .object({
    email: z.string().email('Email invalide'),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  });

export const candidateStep2 = z.object({
  firstName: z.string().min(1, 'Prénom obligatoire'),
  lastName: z.string().min(1, 'Nom obligatoire'),
  phone: z
    .string()
    .regex(/^(?:(?:\+33|0)[1-9])(?:[\s.-]*\d{2}){4}$/, 'Téléphone français invalide'),
  city: z.string().min(1, 'Ville obligatoire'),
  defaultRadiusKm: z.number().min(1).max(20),
});

export const candidateStep3 = z.object({
  jobTitle: z.string().min(1, 'Métier recherché obligatoire'),
  contracts: z.array(z.string()).min(1, 'Choisissez au moins un type de contrat'),
  availableFrom: z.string().min(1, 'Indiquez une date'),
  geoConsent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement à la géolocalisation est obligatoire' }),
  }),
  alertsConsent: z.boolean().optional(),
});

export const employerSchema = z.object({
  companyName: z.string().min(2, 'Raison sociale obligatoire'),
  siret: z
    .string()
    .transform((s) => s.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir exactement 14 chiffres')),
  sector: z.string().min(1, 'Secteur obligatoire'),
  address: z.string().min(3, 'Adresse obligatoire'),
  lat: z.number(),
  lng: z.number(),
  firstName: z.string().min(1, 'Contact obligatoire'),
  lastName: z.string().min(1, 'Nom du contact obligatoire'),
  email: z.string().email('Email professionnel invalide'),
  password: passwordSchema,
});

export const forgotSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const resetSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirm'],
  });
