import { Link, useLocation } from 'react-router-dom';
import { Brand } from '@/components/layout/Brand';
import { Footer } from '@/components/layout/Footer';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <header className="flex items-center gap-4 px-6 py-5">
        <Brand />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          Erreur 404
        </p>
        <h1 className="mt-3 text-[clamp(28px,5vw,44px)] font-extrabold tracking-[-0.02em] text-ink">
          Cette page n’existe pas
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] text-muted">
          {location.pathname} ne correspond à aucun écran de GéoEmploi. Elle a peut-être été
          déplacée, ou l’adresse comporte une erreur.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn btn-forest">
            Retour à l’accueil
          </Link>
          <Link to="/carte" className="btn btn-outline">
            Ouvrir la carte
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
