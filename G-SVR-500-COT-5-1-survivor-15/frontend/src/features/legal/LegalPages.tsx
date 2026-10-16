import { Link } from 'react-router-dom';
import { Brand } from '@/components/layout/Brand';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/Tag';

/**
 * Chaque clause annotée "existant" (réellement implémentée) ou "intention"
 * (pas encore fait), exigence explicite du cahier des charges. Annoté le
 * 10/09/2026 (signalé absent par Ariel), à jour du retour à la version 1.0
 * (retrait gamification/abonnement) et des correctifs de la même session.
 */
function Clause({
  n,
  title,
  status,
  children,
}: {
  n: number;
  title: string;
  status: 'existant' | 'intention';
  children: React.ReactNode;
}) {
  return (
    <section className="not-prose">
      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <h2 className="text-[17px] font-bold text-ink">
          {n}. {title}
        </h2>
        <Badge tone={status === 'existant' ? 'forest' : 'muted'}>{status}</Badge>
      </div>
      <p className="mt-1.5 text-[15px] leading-relaxed text-[#4A4F4B]">{children}</p>
    </section>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Politique de données de localisation">
      <p>
        GéoEmploi collecte la position de l’appareil uniquement lorsque la carte est ouverte et que
        vous avez consenti. Cette position sert uniquement à afficher la distance jusqu’aux
        offres ; elle n’est jamais requise pour postuler.
      </p>
      <p>
        Aucun historique de déplacement n’est conservé. Le partage se coupe à la fermeture de la
        carte, ou si vous refusez le consentement dans les réglages du profil.
      </p>
      <p>
        Responsable de traitement : Ministère du Job et Bonheur, Direction Numérique et Innovation,
        réf. JEB/DNI/2026-001. Vous pouvez exercer vos droits (accès, rectification, opposition)
        auprès du délégué à la protection des données.
      </p>
      <p>
        Cette mention d’information et le recueil de consentement sont obligatoires. Ils ne sont
        pas retirés, y compris si une version annotée du cahier des charges les barre.
      </p>
    </LegalShell>
  );
}

export function CguPage() {
  return (
    <LegalShell title="Conditions générales d’utilisation">
      <p>
        Démonstrateur technique. Chaque clause est annotée « existant » (réellement en place
        aujourd’hui) ou « intention » (pas encore fait), pour ne jamais laisser croire qu’une
        protection existe alors qu’elle n’est qu’envisagée.
      </p>

      <Clause n={1} title="Objet du service" status="existant">
        GéoEmploi met en relation des demandeurs d’emploi et des employeurs autour d’offres
        géolocalisées à la précision de la commune. Le service complète les dispositifs existants
        (France Travail, Apec) sans s’y substituer.
      </Clause>

      <Clause n={2} title="Comptes et rôles" status="existant">
        Trois types de compte : demandeur d’emploi, employeur, administrateur. La création d’un
        compte administrateur n’est pas ouverte au public, un compte administrateur ne peut être
        créé que directement en base.
      </Clause>

      <Clause n={3} title="Publication d’une offre" status="existant">
        La publication d’une offre est gratuite. L’employeur choisit librement le rayon de
        diffusion de chaque offre, sans contrepartie financière. Chaque offre est retirée
        automatiquement 30 jours après sa publication.
      </Clause>

      <Clause n={4} title="Responsabilité des offres publiées" status="existant">
        Les offres publiées engagent la responsabilité de l’employeur qui les a rédigées.
        GéoEmploi ne vérifie pas le contenu d’une offre avant sa publication.
      </Clause>

      <Clause n={5} title="Signalement et modération" status="existant">
        Tout utilisateur connecté peut signaler une offre. Une offre signalée est retirée de la
        carte le temps de son examen par un administrateur, qui peut la rétablir ou la retirer
        définitivement.
      </Clause>

      <Clause n={6} title="Vérification d’activité de l’employeur" status="intention">
        Un compte employeur peut être marqué « vérifié » par un administrateur. Il n’existe pas
        aujourd’hui de vérification automatisée (numéro SIRET, document justificatif) : c’est une
        validation manuelle, pas un contrôle de conformité.
      </Clause>

      <Clause n={7} title="Candidature" status="existant">
        Candidater à une offre nécessite un compte demandeur d’emploi. L’employeur est notifié à
        chaque candidature reçue, et le demandeur est notifié à chaque changement de statut de sa
        candidature.
      </Clause>

      <Clause n={8} title="Consentement à la géolocalisation" status="existant">
        L’activation de la géolocalisation est soumise à un consentement explicite, révocable à
        tout moment sans perte du compte, du profil ni des candidatures. Voir la
        {' '}
        <Link to="/mentions/donnees" className="underline">
          politique de données de localisation
        </Link>
        .
      </Clause>

      <Clause n={9} title="Suppression de compte" status="existant">
        La suppression d’un compte est immédiate pour l’usage (accès bloqué, sessions révoquées).
        Les données sont effacées définitivement 30 jours après, pas au moment de la demande, pour
        permettre un très court délai de réversibilité.
      </Clause>

      <Clause n={10} title="Portabilité des données" status="existant">
        Toute personne connectée peut télécharger l’intégralité de ses données personnelles au
        format JSON, depuis son profil.
      </Clause>

      <Clause n={11} title="Disponibilité du service" status="intention">
        GéoEmploi est un démonstrateur technique, pas un service en exploitation. Aucun
        engagement de disponibilité (temps de fonctionnement garanti, astreinte, support) n’est
        pris.
      </Clause>

      <Clause n={12} title="Propriété intellectuelle" status="intention">
        Les modalités précises de propriété intellectuelle sur le contenu publié par les
        utilisateurs (offres, profils) ne sont pas encore formalisées dans un texte séparé.
      </Clause>

      <Clause n={13} title="Modification des présentes conditions" status="intention">
        Le mécanisme de notification d’une modification des CGU aux utilisateurs déjà inscrits
        n’est pas implémenté : à ce stade, seule la version affichée sur cette page fait foi.
      </Clause>

      <Clause n={14} title="Droit applicable" status="intention">
        Droit français, pas de clause de règlement des litiges rédigée à ce stade.
      </Clause>
    </LegalShell>
  );
}

/**
 * Page publique "Transparence", exigée par le cabinet, absente jusqu'ici.
 * Résume ce que fait réellement GéoEmploi aujourd'hui : pas un document de
 * communication, un état des lieux, y compris les retraits.
 */
export function TransparencyPage() {
  return (
    <LegalShell title="Transparence">
      <p>
        Cette page décrit ce que GéoEmploi fait réellement aujourd'hui, y compris ce qui a
        été retiré. Elle n'est pas un document de communication : en cas d'écart entre
        cette page et le comportement réel de l'application, c'est l'application qui fait
        foi, à corriger ici.
      </p>

      <h2 className="mt-6 text-[17px] font-bold text-ink">Ce que fait le service</h2>
      <p>
        Mettre en relation des demandeurs d'emploi et des employeurs autour d'offres
        géolocalisées. La carte est consultable sans compte ; créer un compte n'est
        nécessaire que pour postuler ou publier une offre.
      </p>

      <h2 className="mt-6 text-[17px] font-bold text-ink">Précision de la géolocalisation</h2>
      <p>
        Les offres sont positionnées au centroïde officiel de leur commune, jamais à
        l'adresse exacte (retour à la version 1.0 du cahier des charges, 8 septembre 2026).
        La position d'un candidat n'est utilisée que pendant que la carte est ouverte, et
        n'est jamais conservée en historique.
      </p>

      <h2 className="mt-6 text-[17px] font-bold text-ink">Ce qui a été retiré, et pourquoi</h2>
      <p>
        Les mécaniques de jeu (réalité augmentée, capture d'offre, badges, "Permis de
        Travailler") et l'abonnement employeur simulé ont été entièrement retirés le
        8 septembre 2026, sur instruction du cabinet, pour revenir à la version 1.0 du
        cahier des charges. Aucun enregistrement n'existait en base pour ces
        fonctionnalités : rien n'a eu besoin d'être supprimé de la base de données,
        seulement de l'interface et du code.
      </p>

      <h2 className="mt-6 text-[17px] font-bold text-ink">Ce qui n'est pas encore fait</h2>
      <p>
        Certains points restent à l'état d'intention plutôt que de réalisation : le détail
        est dans les{' '}
        <Link to="/cgu" className="underline">
          conditions générales
        </Link>
        , annotées clause par clause pour cette raison précise.
      </p>

      <h2 className="mt-6 text-[17px] font-bold text-ink">Vos droits</h2>
      <p>
        Consultez la{' '}
        <Link to="/mentions/donnees" className="underline">
          politique de données de localisation
        </Link>{' '}
        pour le détail du traitement, ou téléchargez l'intégralité de vos données
        personnelles depuis votre profil (export de portabilité, article 20 du RGPD).
      </p>
    </LegalShell>
  );
}

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-paper">
      <div className="bg-paper">
        <header className="flex items-center gap-4 px-6 py-5">
          <Brand />
          <Link to="/" className="ml-auto text-[13.5px] font-semibold">
            Accueil
          </Link>
        </header>
        <article className="prose mx-auto max-w-[68ch] space-y-4 px-6 py-12 text-[15px] leading-relaxed text-[#4A4F4B]">
          <h1 className="text-[36px] text-ink">{title}</h1>
          {children}
        </article>
      </div>
      <Footer />
    </div>
  );
}
