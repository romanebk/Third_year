// Dupliqué à l'identique côté frontend/src/lib/validation.ts (utilisé pour la
// pré-validation côté client avant soumission, en plus de cette validation
// serveur qui reste la source de vérité) : depuis le split backend/frontend
// (deux apps Next.js indépendantes, cf. ADR 0009), il n'y a plus de code
// partageable entre elles sans package npm dédié — jugé disproportionné pour
// ces quelques fonctions courtes.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPassword(password: string, minLength = 8): boolean {
  return password.length >= minLength;
}

// Nom d'utilisateur (User.name) : saisi à l'inscription, modifiable sur
// /profile, affiché en titre du dashboard. Lettres (accents compris),
// chiffres, espaces et _ . - ; 3 à 30 caractères une fois les espaces de
// bord retirés.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export function isValidUsername(username: string): boolean {
  const trimmed = username.trim();
  return (
    trimmed.length >= USERNAME_MIN_LENGTH &&
    trimmed.length <= USERNAME_MAX_LENGTH &&
    /^[\p{L}\p{N} _.-]+$/u.test(trimmed)
  );
}
