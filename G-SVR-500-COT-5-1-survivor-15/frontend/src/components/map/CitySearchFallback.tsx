import { useState } from 'react';
import { chercherAdresse } from '@/lib/geocode';
import { useLocationStore } from '@/store/location';

/**
 * Visible uniquement quand la géolocalisation est refusée. Sans ça, la carte
 * se recentre silencieusement sur Paris 11e (position de repli codée en dur)
 * sans que l'utilisateur le sache, faussant sa recherche s'il n'est pas à
 * Paris. Trouvé en audit RGAA/comportements, corrigé ici : message explicite
 * + recherche manuelle par ville pour reprendre la main sur sa position.
 */
export function CitySearchFallback() {
  const setPosition = useLocationStore((s) => s.setPosition);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound'>('idle');
  const [found, setFound] = useState<string | null>(null);

  const search = async () => {
    if (query.trim().length < 3) return;
    setStatus('loading');
    setFound(null);
    const result = await chercherAdresse(query);
    if (!result) {
      setStatus('notfound');
      return;
    }
    setPosition({ lat: result.latitude, lng: result.longitude });
    setFound(result.city ?? result.label);
    setStatus('idle');
  };

  return (
    <div className="pointer-events-auto rounded-[16px] border border-line bg-white/95 p-3 shadow-soft backdrop-blur">
      <p className="text-[12.5px] font-semibold text-ink">
        Position non partagée : la carte est centrée sur Paris 11e par défaut.
      </p>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label htmlFor="city-fallback" className="sr-only">
          Rechercher une ville ou une adresse
        </label>
        <input
          id="city-fallback"
          className="field-input flex-1"
          placeholder="Chercher une ville…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-describedby={status === 'notfound' ? 'city-fallback-error' : undefined}
        />
        <button type="submit" className="chip px-3 py-1.5 text-[12.5px]" disabled={status === 'loading'}>
          {status === 'loading' ? '…' : 'Chercher'}
        </button>
      </form>
      {status === 'notfound' ? (
        <p id="city-fallback-error" role="alert" className="mt-1.5 text-[12px] text-red-700">
          Ville introuvable, essayez un autre nom.
        </p>
      ) : null}
      {found ? (
        <p aria-live="polite" className="mt-1.5 text-[12px] text-forest">
          Carte recentrée sur {found}.
        </p>
      ) : null}
    </div>
  );
}
