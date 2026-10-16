import { describe, expect, it } from 'vitest';
import { passwordSchema, employerSchema } from '@/features/auth/schemas';

describe('passwordSchema', () => {
  it('exige 10 caractères, une majuscule et un chiffre', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('nouppercase1').success).toBe(false);
    expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false);
    expect(passwordSchema.safeParse('Demo1234567').success).toBe(true);
  });
});

describe('SIRET', () => {
  it('accepte 14 chiffres et refuse le reste', () => {
    expect(employerSchema.shape.siret.safeParse('81234567890123').success).toBe(true);
    expect(employerSchema.shape.siret.safeParse('812 345 678 901 23').success).toBe(true);
    expect(employerSchema.shape.siret.safeParse('123').success).toBe(false);
  });
});
