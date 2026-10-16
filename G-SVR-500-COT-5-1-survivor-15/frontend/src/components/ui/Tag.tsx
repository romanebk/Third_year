import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'sage' | 'forest' | 'danger' | 'muted';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-grey text-ink ring-1 ring-line',
  sage: 'bg-sageSoft text-forest',
  forest: 'bg-forest text-white',
  danger: 'bg-[#F8E8E5] text-danger',
  muted: 'bg-[#F0F1EF] text-muted',
};

/** Pilule / badge unifié (secteurs, statuts, distances, filtres). */
export function Badge({
  children,
  tone = 'neutral',
  className,
  as: Comp = 'span',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  as?: 'span' | 'button';
}) {
  return (
    <Comp
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold tracking-[0.01em]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </Comp>
  );
}

/** Alias historique, même rendu que Badge. */
export function Tag({
  children,
  hot = false,
  className,
}: {
  children: ReactNode;
  hot?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={hot ? 'sage' : 'neutral'} className={cn('rounded-full', className)}>
      {children}
    </Badge>
  );
}
