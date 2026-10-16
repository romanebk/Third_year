import type { ReactNode } from 'react';
import { Brand } from '@/components/layout/Brand';
import { AuthPanelCarousel } from '@/features/auth/AuthPanelCarousel';

type AuthShellProps = {
  children: ReactNode;
  title: ReactNode;
  subtitle: string;
  footer?: ReactNode;
  panelTitle?: string;
  panelStory?: { title: string; body: string; cta?: { to: string; label: string } };
};

export function AuthShell({
  children,
  title,
  subtitle,
  footer,
  panelTitle = 'L’emploi, à la commune près',
  panelStory = {
    title: 'L’histoire de Yasmine',
    body: 'Chef de rang trouvé dans son arrondissement un mardi midi. Entretien le soir même, contrat le vendredi, sans quitter le quartier.',
    cta: { to: '/carte', label: 'Voir les offres près de moi' },
  },
}: AuthShellProps) {
  return (
    <div className="grid min-h-svh bg-paper lg:grid-cols-2">
      <section className="relative flex flex-col px-5 py-6 sm:px-12 lg:px-16">
        <Brand size="lg" />
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8 sm:py-10">
          <h1 className="text-center text-[clamp(28px,3.4vw,36px)] font-extrabold tracking-[-0.03em] leading-[1.08] text-ink">
            {title}
          </h1>
          <p className="mt-3 text-center text-[14px] text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-center text-[13.5px] text-muted">{footer}</div> : null}
        </div>
        <p className="text-center text-[11.5px] text-muted">
          Démonstrateur technique, ne constitue pas un service public en exploitation.
        </p>
      </section>

      <AuthPanelCarousel
        title={panelTitle}
        storyTitle={panelStory.title}
        storyBody={panelStory.body}
        cta={panelStory.cta}
      />
    </div>
  );
}
