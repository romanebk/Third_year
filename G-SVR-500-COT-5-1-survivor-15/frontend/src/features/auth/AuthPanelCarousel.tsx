import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

/** Toutes les images de frontend/images (servies via /images). */
export const AUTH_PANEL_IMAGES = [
  '/images/close-up-hand-holding-smartphone.jpg',
  '/images/friendly-diverse-business-colleagues-working-project.jpg',
  '/images/employer-welcoming-applicant-team.jpg',
  '/images/business-team-working-laptop.jpg',
] as const;

const INTERVAL_MS = 4500;
const FADE_MS = 900;

type AuthPanelCarouselProps = {
  title?: string;
  storyTitle?: string;
  storyBody?: string;
  cta?: { to: string; label: string };
  className?: string;
};

export function AuthPanelCarousel({
  title = 'L’emploi, à la commune près',
  storyTitle = 'L’histoire de Yasmine',
  storyBody = 'Chef de rang trouvé dans son arrondissement un mardi midi. Entretien le soir même, contrat le vendredi, sans quitter le quartier.',
  cta = { to: '/carte', label: 'Voir les offres près de moi' },
  className,
}: AuthPanelCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % AUTH_PANEL_IMAGES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <aside
      className={cn(
        'relative hidden min-h-screen overflow-hidden bg-ink lg:block',
        className,
      )}
      aria-roledescription="carrousel"
      aria-label="Ambiances GéoEmploi"
    >
      {/* Slides plein écran */}
      <div className="absolute inset-0">
        {AUTH_PANEL_IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity ease-brand',
              i === index ? 'opacity-100' : 'opacity-0',
            )}
            style={{ transitionDuration: `${FADE_MS}ms` }}
            decoding="async"
          />
        ))}
        {/* Voile léger pour lisibilité du titre blanc */}
        <div className="absolute inset-0 bg-black/35" aria-hidden />
      </div>

      <div className="relative z-10 flex h-full flex-col px-10 pb-8 pt-10 xl:px-12 xl:pb-10 xl:pt-12">
        <div className="flex items-start justify-between gap-4">
          <h2 className="max-w-[11ch] text-[clamp(34px,3.4vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
            {title}
          </h2>
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/55 text-ink shadow-sm backdrop-blur-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
        </div>

        {/* Indicateurs */}
        <div className="mt-6 flex gap-1.5" aria-hidden>
          {AUTH_PANEL_IMAGES.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-500 ease-brand',
                i === index ? 'w-6 bg-lime' : 'w-1.5 bg-white/40',
              )}
            />
          ))}
        </div>

        {/* Encart glass, texte noir */}
        <div className="mt-auto">
          <div className="rounded-[22px] border border-white/60 bg-white/55 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <p className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">{storyTitle}</p>
            <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-[#2A2E2B]">
              {storyBody}
            </p>
            {cta ? (
              <Link
                to={cta.to}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-ink shadow-soft transition hover:-translate-y-0.5"
              >
                {cta.label} →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
