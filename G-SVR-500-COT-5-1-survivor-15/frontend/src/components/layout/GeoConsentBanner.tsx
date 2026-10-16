import { Link } from 'react-router-dom';
import { useConsentStore } from '@/store/consent';

/**
 * Bannière de premier consentement uniquement (geo === 'unknown'). Le rappel
 * persistant après refus vit dans CitySearchFallback, affiché sur la carte
 * elle-même : c'est là que l'utilisateur a besoin de savoir que la position
 * n'est pas la sienne, pas dans une bannière qui a déjà disparu.
 */
export function GeoConsentBanner() {
  const geo = useConsentStore((s) => s.geo);
  const setGeo = useConsentStore((s) => s.setGeo);
  if (geo !== 'unknown') return null;

  return (
    <div
      role="dialog"
      aria-labelledby="geo-consent-title"
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[70] rounded-block bg-ink p-5 text-white shadow-live md:inset-x-auto md:bottom-5 md:right-5 md:max-w-[420px]"
    >
      <h2 id="geo-consent-title" className="text-[clamp(16px,4vw,18px)]">
        Votre position, uniquement pour la carte
      </h2>
      <p className="mt-2 text-[13px] text-white/70 sm:text-[13.5px]">
        GéoEmploi calcule les distances pendant que la carte est ouverte. Aucun historique de
        déplacement n'est conservé. Vous pouvez refuser et changer d'avis dans les réglages.
      </p>
      <p className="mt-2 text-[12.5px]">
        <Link className="underline" to="/mentions/donnees">
          Politique de données de localisation
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-lime py-2.5" onClick={() => setGeo('granted')}>
          Accepter
        </button>
        <button type="button" className="btn btn-white py-2.5" onClick={() => setGeo('denied')}>
          Refuser
        </button>
      </div>
    </div>
  );
}
