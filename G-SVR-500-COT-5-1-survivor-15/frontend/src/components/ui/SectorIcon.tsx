import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Sector } from '@/types';

const PATHS: Record<Sector, ReactNode> = {
  Restauration: (
    <>
      <path d="M8 3v10M8 13c0 2.5-2 4-2 6h4c0-2-2-3.5-2-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 3v18M14 7h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  Logistique: (
    <>
      <path d="M4 8h12l4 4v7H4V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M16 8v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8" cy="19" r="1.5" fill="currentColor" />
      <circle cx="17" cy="19" r="1.5" fill="currentColor" />
    </>
  ),
  Santé: (
    <>
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  Commerce: (
    <>
      <path d="M4 8h16l-1.2 11.2A2 2 0 0 1 16.8 21H7.2a2 2 0 0 1-2-1.8L4 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 8V6.5A4 4 0 0 1 16 6.5V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  Bâtiment: (
    <>
      <path d="M4 20V9l8-5 8 5v11" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </>
  ),
  Tech: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
  Services: (
    <>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19.5c1.5-3 3.7-4.5 6.5-4.5s5 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </>
  ),
};

export function SectorIcon({
  sector,
  className,
  size = 18,
}: {
  sector?: string;
  className?: string;
  size?: number;
}) {
  const key = (sector && sector in PATHS ? sector : 'Services') as Sector;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('text-forest', className)}
    >
      {PATHS[key]}
    </svg>
  );
}

export function SectorMark({
  sector,
  className,
  size = 46,
}: {
  sector?: string;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        'grid flex-none place-items-center rounded-[14px] bg-sageSoft text-forest',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <SectorIcon sector={sector} size={Math.round(size * 0.42)} />
    </span>
  );
}

/** Pastilles de progression (remplace les médailles emoji). */
export const PROGRESS_BADGE_IDS = ['b1', 'b2', 'b3', 'b4', 'b5'] as const;
export type ProgressBadgeId = (typeof PROGRESS_BADGE_IDS)[number];

export function ProgressBadgeIcon({
  index,
  unlocked,
  className,
  size = 52,
}: {
  index: number;
  unlocked?: boolean;
  className?: string;
  size?: number;
}) {
  const ring = unlocked ? 'border-transparent bg-sageSoft text-forest' : 'border-line bg-white text-muted opacity-40';
  return (
    <span
      className={cn(
        'grid place-items-center rounded-[14px] border',
        unlocked && '-translate-y-0.5 -rotate-[4deg]',
        ring,
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 7.5v5l3 1.8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        {index >= 2 ? (
          <path d="M8.5 16.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        ) : null}
      </svg>
    </span>
  );
}
