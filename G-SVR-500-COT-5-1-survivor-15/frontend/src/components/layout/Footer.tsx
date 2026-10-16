import { Link } from 'react-router-dom';
import { Brand } from './Brand';

export function Footer() {
  return (
    <footer className="wrap py-[clamp(44px,6vw,80px)] pb-[26px] text-[rgba(255,255,255,.62)]">
      <div className="grid grid-cols-1 gap-7 border-b border-white/10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)_auto]">
        <div>
          <Brand light size="md" className="mb-4" />
          <p className="max-w-[30ch] text-[13px]">
            L'emploi à la commune près. Complète les dispositifs existants, sans s'y substituer.
          </p>
        </div>
        <div>
          <h5 className="mb-4 text-[14px] font-bold tracking-[-0.01em] text-white">Candidats</h5>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/carte">
            La carte
          </Link>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/#etapes">
            Comment ça marche
          </Link>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/app/candidatures">
            Suivi des candidatures
          </Link>
        </div>
        <div>
          <h5 className="mb-4 text-[14px] font-bold tracking-[-0.01em] text-white">Employeurs</h5>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/pro/offres/nouvelle">
            Publier une offre
          </Link>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/pro/tableau-de-bord">
            Tableau de bord
          </Link>
        </div>
        <div>
          <h5 className="mb-4 text-[14px] font-bold tracking-[-0.01em] text-white">Informations</h5>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/mentions/donnees">
            Données personnelles
          </Link>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/cgu">
            Conditions générales
          </Link>
          <Link className="block py-1.5 text-[13px] hover:text-white" to="/transparence">
            Transparence
          </Link>
        </div>
        <div>
          <Link to="/carte" className="btn btn-white">
            Ouvrir la carte
          </Link>
        </div>
      </div>
      <div className="flex justify-center gap-2.5 border-b border-white/10 py-[26px]">
        {['Instagram', 'LinkedIn', 'X', 'YouTube'].map((name) => (
          <a
            key={name}
            href="#top"
            aria-label={name}
            className="grid h-[38px] w-[38px] place-items-center rounded-full border border-white/15 text-white transition hover:bg-white hover:text-ink"
          >
            <span className="text-[11px] font-bold">{name[0]}</span>
          </a>
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-4 pt-[22px] text-[11.5px] text-white/45">
        <p className="max-w-[80ch] leading-relaxed">
          Démonstrateur technique, ne constitue pas un service public en exploitation. Offres,
          entreprises, chiffres et témoignages fictifs. Le traitement des données de localisation
          fait l'objet d'une mention d'information et d'un recueil de consentement. Fonds
          cartographiques © IGN, Géoplateforme.
        </p>
        <p>© 2026 GéoEmploi</p>
      </div>
    </footer>
  );
}
