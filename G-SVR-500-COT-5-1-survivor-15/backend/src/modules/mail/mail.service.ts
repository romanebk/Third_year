import fs from 'node:fs';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { loadEnv } from '../../config/env';

const env = loadEnv();
const OUTBOX_DIR = path.resolve(__dirname, '../../../mail-outbox');

let transporter: Transporter | null = null;

/**
 * Sans SMTP_HOST configuré (cas de ce démonstrateur, aucun credential
 * provisionné), les e-mails ne sont pas envoyés sur le réseau : ils sont
 * écrits tels quels (format .eml, ouvrable par n'importe quel client mail)
 * dans backend/mail-outbox/, pour rester vérifiables sans dépendance externe.
 */
function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
  }
  return transporter;
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(input: SendMailInput): Promise<{ delivered: boolean; outboxFile?: string }> {
  const t = getTransporter();
  const info = await t.sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (env.SMTP_HOST) {
    return { delivered: true };
  }

  fs.mkdirSync(OUTBOX_DIR, { recursive: true });
  const safeTo = input.to.replace(/[^a-z0-9@.]/gi, '_');
  const file = path.join(OUTBOX_DIR, `${Date.now()}-${safeTo}.eml`);
  fs.writeFileSync(file, (info as { message: Buffer }).message);
  console.log(`[mail] SMTP non configuré, e-mail écrit dans ${file}`);
  return { delivered: false, outboxFile: file };
}
