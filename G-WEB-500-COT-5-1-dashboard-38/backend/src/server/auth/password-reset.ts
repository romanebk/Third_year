import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Jeton imprévisible pour l'URL (256 bits), envoyé par email uniquement.
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

// Seule cette empreinte est stockée (PasswordResetToken.tokenHash). SHA-256
// sans sel suffit : le jeton est déjà aléatoire sur 256 bits, il n'y a rien à
// deviner par dictionnaire, contrairement à un mot de passe.
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
