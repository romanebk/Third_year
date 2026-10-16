import { z } from 'zod';
import { Role } from '@prisma/client';

export const registerSchema = z.object({
  email: z.string().email('Email invalide').max(254),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(72),
  role: z.enum([Role.JOBSEEKER, Role.EMPLOYER]).default(Role.JOBSEEKER),
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire').max(80).optional(),
  lastName: z.string().trim().min(1, 'Le nom est obligatoire').max(80).optional(),
  companyName: z.string().trim().min(1, 'Le nom de l’entreprise est obligatoire').max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email invalide').max(254),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requis'),
});

export const logoutSchema = refreshSchema;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide').max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(72)
    .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
    .regex(/\d/, 'Le mot de passe doit contenir un chiffre'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;