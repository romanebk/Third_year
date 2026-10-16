import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  // URL publique réellement cliquable par un utilisateur (liens dans les e-mails).
  // Distincte de CORS_ORIGIN : le frontend local tourne en HTTPS (certificat
  // auto-signé), CORS_ORIGIN sert uniquement à la vérification d'origine côté
  // serveur et peut légitimement différer du schéma que voit l'utilisateur.
  APP_URL: z.string().default('https://localhost:5173'),

  // E-mail transactionnel. Sans SMTP_HOST, les e-mails sont journalisés
  // (console + fichier local) plutôt qu'envoyés : pas de credentials à
  // provisionner pour ce démonstrateur.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('GéoEmploi <no-reply@geoemploi.local>'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
