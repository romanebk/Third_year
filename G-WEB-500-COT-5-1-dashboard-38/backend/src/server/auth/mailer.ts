import nodemailer from "nodemailer";

// Envoi de l'email de confirmation via SMTP auto-hébergé (le service `mailpit`
// du docker-compose par défaut) — aucun service d'envoi externe requis.
// Si le SMTP n'est pas configuré (SMTP_HOST absent), on retombe sur un log
// console : le flow reste testable sans aucune infrastructure, et c'est le
// signal de repli qui permet à /api/auth/register d'exposer le token de
// confirmation en retour de l'API (aucun vrai canal de réception sinon).
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 1025);
const SMTP_USER = process.env.SMTP_USER || undefined;
const SMTP_PASS = process.env.SMTP_PASS || undefined;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const MAIL_FROM = process.env.MAIL_FROM || "hubly@localhost";

// Un SMTP est "délivrant" dès qu'un hôte, un port et une adresse d'expéditeur
// sont définis ; l'auth est optionnelle (mailpit n'en exige pas).
export const isEmailDeliveryConfigured = (): boolean =>
  Boolean(SMTP_HOST && Number.isFinite(SMTP_PORT) && SMTP_PORT > 0 && MAIL_FROM);

const DELIVERY_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

const transport = isEmailDeliveryConfigured()
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      connectionTimeout: DELIVERY_TIMEOUT_MS,
      greetingTimeout: DELIVERY_TIMEOUT_MS,
      socketTimeout: DELIVERY_TIMEOUT_MS,
      ...(SMTP_USER || SMTP_PASS ? { auth: { user: SMTP_USER ?? "", pass: SMTP_PASS ?? "" } } : {}),
    })
  : null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Envoi avec nouvelles tentatives (backoff exponentiel : 1 s, 2 s). Lève la
// dernière erreur si toutes échouent — chaque appelant décide quoi en faire.
async function sendWithRetry(mail: Parameters<NonNullable<typeof transport>["sendMail"]>[0]): Promise<void> {
  if (!transport) throw new Error("email delivery is not configured");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await transport.sendMail(mail);
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(BASE_DELAY_MS * 2 ** attempt);
    }
  }
}

function publicBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:8080";
}

export async function sendConfirmationEmail(to: string, token: string): Promise<void> {
  const confirmUrl = `${publicBaseUrl()}/confirm?token=${token}`;

  if (!transport) {
    // Repli sans infrastructure : le lien est juste loggé (cf. Troubleshooting
    // du README). isEmailDeliveryConfigured() = false pilote alors l'exposition
    // du token par la route d'inscription.
    console.log(`[mailer] (fallback) Email de confirmation pour ${to} : ${confirmUrl}`);
    return;
  }

  try {
    await sendWithRetry({
      from: MAIL_FROM,
      to,
      subject: "Hubly — Confirmez votre compte",
      // Le token brut est répété en plus du lien : utile pour "I have a
      // confirmation token" côté /confirm (saisie manuelle, sans repasser
      // par le lien cliquable) — trouvé manquant en testant l'envoi réel.
      text: `Bonjour,\n\nConfirmez votre adresse email en ouvrant ce lien :\n${confirmUrl}\n\nOu collez ce token sur la page de confirmation :\n${token}\n\nCe lien expire dans 24 h.\n`,
      html: `<p>Bonjour,</p><p>Confirmez votre adresse email en ouvrant ce lien&nbsp;:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>Ou collez ce token sur la page de confirmation&nbsp;:</p><p style="font-family: monospace; word-break: break-all;">${token}</p><p>Ce lien expire dans 24&nbsp;h.</p>`,
    });
    console.log(`[mailer] Email de confirmation envoyé à ${to}`);
  } catch (error) {
    // On ne gonfle pas l'erreur (garde le contexte) et on garde une issue de
    // secours : le lien est loggé comme en mode fallback, pour ne pas bloquer
    // un compte réellement créé en base.
    console.error(`[mailer] Échec d'envoi à ${to} après ${MAX_ATTEMPTS} tentatives:`, error);
    console.log(`[mailer] (fallback) Email de confirmation pour ${to} : ${confirmUrl}`);
    throw new Error(`sendConfirmationEmail failed for ${to}`, { cause: error });
  }
}

// Lien de réinitialisation du mot de passe (valable 1 h, usage unique). Sans
// SMTP, le lien est loggé côté serveur — jamais renvoyé par l'API : il donne le
// contrôle du compte.
export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${publicBaseUrl()}/reset-password?token=${token}`;

  if (!transport) {
    console.log(`[mailer] (fallback) Réinitialisation du mot de passe pour ${to} : ${resetUrl}`);
    return;
  }

  await sendWithRetry({
    from: MAIL_FROM,
    to,
    subject: "Hubly — Réinitialisez votre mot de passe",
    text: `Bonjour,\n\nVous avez demandé à réinitialiser votre mot de passe Hubly. Ouvrez ce lien pour en choisir un nouveau :\n${resetUrl}\n\nCe lien expire dans 1 h et ne peut servir qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe ne change pas.\n`,
    html: `<p>Bonjour,</p><p>Vous avez demandé à réinitialiser votre mot de passe Hubly. Ouvrez ce lien pour en choisir un nouveau&nbsp;:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Ce lien expire dans 1&nbsp;h et ne peut servir qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email&nbsp;: votre mot de passe ne change pas.</p>`,
  });
}

// Destinataire des messages du formulaire /contact : CONTACT_EMAIL, sinon
// l'adresse d'expédition (dans le stack local, Mailpit reçoit tout).
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || MAIL_FROM;

export interface ContactMessage {
  name: string;
  email: string;
  topic: string;
  message: string;
}

// Message du formulaire de contact. Texte brut uniquement (aucun HTML
// construit à partir de la saisie) ; Reply-To = l'expéditeur, pour répondre
// directement depuis la boîte de réception.
export async function sendContactMessage(contact: ContactMessage): Promise<void> {
  const text = `From: ${contact.name} <${contact.email}>\nTopic: ${contact.topic}\n\n${contact.message}\n`;

  if (!transport) {
    console.log(`[mailer] (fallback) Contact message for ${CONTACT_EMAIL}:\n${text}`);
    return;
  }

  await sendWithRetry({
    from: MAIL_FROM,
    to: CONTACT_EMAIL,
    replyTo: `${contact.name} <${contact.email}>`,
    subject: `Hubly contact — ${contact.topic}`,
    text,
  });
}
