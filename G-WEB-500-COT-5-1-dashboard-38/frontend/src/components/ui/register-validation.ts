import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/validation";

export type RegisterErrors = Partial<
  Record<"username" | "email" | "password" | "confirmPassword" | "terms", string | undefined>
>;

export const termsError = "Please accept the Terms of Service and the Privacy Policy to continue.";

export function validateUsername(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "Username is required.";
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return `Use ${USERNAME_MIN_LENGTH} to ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!isValidUsername(trimmed)) return "Use only letters, numbers, spaces, _ . or -";
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Email is required.";
  if (!isValidEmail(value)) return "Enter a valid email address.";
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  if (!isValidPassword(value)) return "Password must be at least 8 characters.";
  return undefined;
}

export function validateConfirmPassword(value: string, password: string): string | undefined {
  if (!value) return "Please confirm your password.";
  if (value !== password) return "Passwords do not match.";
  return undefined;
}
