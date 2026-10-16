import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM : chiffre les tokens OAuth (access_token, refresh_token) avant qu'ils
// touchent la base — jamais en clair, cf. Account.access_token/refresh_token dans
// schema.prisma. Clé dédiée (pas NEXTAUTH_SECRET, qui signe les JWT de session) :
// mélanger les deux usages affaiblirait les deux si l'un des secrets fuit.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // taille d'IV recommandée pour GCM

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set — generate one with `openssl rand -base64 32`",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)");
  }
  return key;
}

// Format stocké : "<iv>.<authTag>.<ciphertext>", chaque partie encodée en base64.
export function encryptToken(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => part.toString("base64")).join(".");
}

export function decryptToken(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted token");
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plainText = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plainText.toString("utf8");
}
