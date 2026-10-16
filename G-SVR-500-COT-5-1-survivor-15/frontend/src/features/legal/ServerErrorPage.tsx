import { Link } from 'react-router-dom';
import { Brand } from '@/components/layout/Brand';
import { Footer } from '@/components/layout/Footer';

export function ServerErrorPage({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex min-h-svh flex-col bg-paper">
      <header className="flex items-center gap-4 px-6 py-5">
        <Brand />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          Erreur 500
        </p>
        <h1 className="mt-3 text-[clamp(28px,5vw,44px)] font-extrabold tracking-[-0.02em] text-ink">
          Quelque chose s’est mal passé
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] text-muted">
          Une erreur inattendue est survenue de notre côté. Ce n’est pas lié à votre connexion,
          réessayez dans un instant.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="btn btn-forest"
            onClick={onRetry ?? (() => window.location.reload())}
          >
            Réessayer
          </button>
          <Link to="/" className="btn btn-outline">
            Retour à l’accueil
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
