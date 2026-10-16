export function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatSalary(
  min?: number,
  max?: number,
  kind?: 'brut' | 'net',
): string | null {
  if (!min && !max) return null;
  const suffix = kind === 'net' ? ' net' : ' brut';
  if (min && max && min !== max) {
    return `${formatNumber(min)}–${formatNumber(max)} €${suffix}`;
  }
  return `${formatNumber(min ?? max ?? 0)} €${suffix}`;
}

export function passwordScore(value: string): { score: number; label: string } {
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  const labels = ['Très faible', 'Faible', 'Moyen', 'Correct', 'Fort', 'Très fort'];
  return { score, label: labels[score] ?? 'Très faible' };
}
