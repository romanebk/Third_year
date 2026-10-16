import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'h-7',
  md: 'h-8 sm:h-9',
  lg: 'h-10 sm:h-11',
  xl: 'h-12 sm:h-14',
} as const;

type BrandProps = {
  /** Wordmark clair (blanc / lime) pour fonds sombres */
  light?: boolean;
  /** Pastille seule (pin), rail compact, favicon-like */
  mark?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
  to?: string;
};

/**
 * Logo officiel GéoEmploi (charte-chomagego/logos).
 * - fond clair → logo-primary
 * - fond sombre (light) → wordmark on-dark
 * - mark → logo-mark
 */
export function Brand({
  light = false,
  mark = false,
  size = 'md',
  className,
  to = '/',
}: BrandProps) {
  const h = SIZES[size];

  if (mark) {
    return (
      <Link to={to} className={cn('inline-flex shrink-0', className)} title="GéoEmploi">
        <img
          src="/brand/logo-mark.svg?v=geoemploi"
          alt="GéoEmploi"
          className={cn(h, 'w-auto')}
          width={120}
          height={140}
          decoding="async"
        />
      </Link>
    );
  }

  const src = light
    ? '/brand/logo-wordmark-on-dark.svg?v=geoemploi'
    : '/brand/logo-primary.svg?v=geoemploi';

  return (
    <Link to={to} className={cn('inline-flex shrink-0 items-center', className)} title="GéoEmploi">
      <img
        src={src}
        alt="GéoEmploi"
        className={cn(h, 'w-auto max-w-[min(240px,58vw)] object-contain object-left')}
        width={480}
        height={120}
        decoding="async"
      />
    </Link>
  );
}
