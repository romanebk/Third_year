import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { Brand } from '@/components/layout/Brand';
import { Footer } from '@/components/layout/Footer';
import { Reveal } from '@/components/layout/Reveal';
import { formatDistance, haversine, PARIS_11 } from '@/lib/geo';
import { formatNumber } from '@/lib/format';
import { offers as seedOffers } from '@/mocks/data';
import { JobMap } from '@/components/map/JobMap';
import { OfferList } from '@/components/map/OfferList';
import { LiveMiniMap, ZonePreviewMap } from './MiniMaps';
import type { OfferWithDistance } from '@/hooks/useOffers';
import { useCaughtStore } from '@/store/caught';
import { useLocationStore } from '@/store/location';
import { useSessionStore } from '@/store/session';
import { OfferDetailModal } from '@/features/offers/OfferDetailModal';
import type { ReactNode } from 'react';

const SECTORS = [
  'Restauration',
  'Logistique',
  'Santé & soin',
  'Commerce',
  'Bâtiment',
  'Tech',
  'Services à domicile',
];

const FEED: [string, string, string][] = [
  ['Chef de rang', 'Maison Bardot', '180 m'],
  ['Préparateur de commandes', 'Halle Nord', '640 m'],
  ['Aide-soignant de nuit', 'Résidence Belleville', '1,2 km'],
  ['Vendeur en boulangerie', 'Le Fournil Roquette', '310 m'],
  ['Agent de maintenance', 'Cinéma Voltaire', '450 m'],
  ['Développeur front', 'Atelier Bastille', '820 m'],
  ['Livreur à vélo', 'Coursiers 11', '90 m'],
  ['Auxiliaire de crèche', 'Petits Pas', '1,4 km'],
  ['Serveur brunch', 'Café Charonne', '260 m'],
  ['Magasinier', 'Dépôt Ledru', '980 m'],
];

const CARDS = [
  {
    t: "« J'ai signé à 400 mètres de chez moi »",
    d: 'Chef de rang trouvé un mardi midi, entretien le soir même, contrat le vendredi.',
    n: 'Yasmine B.',
    r: 'Restauration · Paris 11e',
    img: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80',
    a: 'https://randomuser.me/api/portraits/women/44.jpg',
  },
  {
    t: "« La carte m'a montré l'entrepôt d'à côté »",
    d: "Trois mois d'intérim en logistique dans une zone qu'elle traversait tous les jours à vélo.",
    n: 'Karim D.',
    r: 'Logistique · Pantin',
    img: 'https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=800&q=80',
    a: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  {
    t: '« J\'ai vu l\'offre le jour même »',
    d: 'Repérée sur la carte, candidature envoyée en un tap, entretien la semaine suivante.',
    n: 'Léa M.',
    r: 'Commerce · Paris 12e',
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
    a: 'https://randomuser.me/api/portraits/women/68.jpg',
  },
  {
    t: "« Le trajet, c'était mon critère numéro un »",
    d: "Aide-soignante de nuit à dix minutes à pied, plus de deux heures de transport par jour économisées.",
    n: 'Fatou S.',
    r: 'Santé · Belleville',
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    a: 'https://randomuser.me/api/portraits/women/12.jpg',
  },
  {
    t: '« Trois offres tech dans mon quartier »',
    d: 'Un atelier de six personnes croisé sur la carte à 800 mètres, jamais vu sur les autres sites.',
    n: 'Hugo T.',
    r: 'Tech · Bastille',
    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
    a: 'https://randomuser.me/api/portraits/men/75.jpg',
  },
];

function FallbackImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [s, setS] = useState(src);
  return (
    <img
      src={s}
      alt={alt}
      className={className}
      onError={() =>
        setS(
          'data:image/svg+xml;charset=utf-8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#C9D6BB"/><text x="50%" y="52%" text-anchor="middle" font-family="Inter" font-size="28" fill="#5C6B4C">GéoEmploi</text></svg>',
            ),
        )
      }
    />
  );
}

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - t0) / 1500, 1);
      const e = 1 - (1 - p) ** 3;
      setN(Math.round(to * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce, to]);
  return <>{formatNumber(n)}</>;
}

export function LandingPage() {
  const user = useSessionStore((s) => s.user);
  const spaceLink = user?.role === 'employer' ? '/pro' : '/app';
  const [sector, setSector] = useState(0);
  const [menu, setMenu] = useState(false);
  const [filter, setFilter] = useState<'all' | 'near' | 'new' | 'got'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(seedOffers[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [km, setKm] = useState(3);
  const me = useLocationStore((s) => s.position);
  const caught = useCaughtStore((s) => s.ids);
  const catchOffer = useCaughtStore((s) => s.catchOffer);
  const setPosition = useLocationStore((s) => s.setPosition);

  const offers: OfferWithDistance[] = useMemo(
    () =>
      seedOffers.map((o) => ({
        ...o,
        distanceM: haversine(me, { lat: o.lat, lng: o.lng }),
      })),
    [me],
  );

  const visible = offers
    .filter((o) => {
      if (filter === 'near') return (o.distanceM ?? 0) <= 600;
      if (filter === 'new') return o.isNew;
      if (filter === 'got') return caught.includes(o.id);
      return true;
    })
    .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

  const reach = Math.round(km * km * 2400).toLocaleString('fr-FR');

  return (
    <div className="overflow-x-hidden bg-black">
      <header className="hero relative flex min-h-[min(88svh,860px)] flex-col overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <FallbackImg
            src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=2000&q=80"
            alt=""
            className="h-full w-full scale-[1.12] object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(8,10,8,.94)_0%,rgba(8,10,8,.78)_34%,rgba(8,10,8,.34)_62%,rgba(8,10,8,.55)_100%)]" />
        </div>

        <nav className="relative z-[6]" aria-label="Navigation principale">
          <div className="wrap">
            <div className="flex items-center gap-3 py-4 sm:gap-[22px] sm:py-[26px]">
              <Brand light size="lg" />
              <div className="mx-auto hidden gap-[30px] text-[13.5px] font-medium text-white/70 md:flex">
                <a href="#carte" className="hover:text-white">
                  La carte
                </a>
                <a href="#etapes" className="hover:text-white">
                  Comment ça marche
                </a>
                <a href="#secteurs" className="hover:text-white">
                  Secteurs
                </a>
                <a href="#employeurs" className="hover:text-white">
                  Employeurs
                </a>
                <a href="#confiance" className="hover:text-white">
                  Vos données
                </a>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {user ? (
                  <Link to={spaceLink} className="hidden text-[13.5px] text-white/80 md:inline">
                    Mon espace
                  </Link>
                ) : (
                  <Link to="/connexion" className="hidden text-[13.5px] text-white/80 md:inline">
                    Se connecter
                  </Link>
                )}
                <Link to="/carte" className="btn btn-white hidden sm:inline-flex">
                  Ouvrir la carte
                </Link>
                <button
                  type="button"
                  className="bg-transparent p-2 md:hidden"
                  aria-label="Ouvrir le menu"
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                >
                  <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                    <path d="M0 1h22M0 7h22M0 13h22" stroke="#fff" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
            {menu ? (
              <div className="absolute left-3 right-3 z-20 flex flex-col gap-3 rounded-[20px] bg-[rgba(14,16,15,.96)] p-5 text-[15px] text-white backdrop-blur sm:left-3.5 sm:right-3.5 sm:p-[22px] md:hidden">
                <a href="#carte" onClick={() => setMenu(false)}>La carte</a>
                <a href="#etapes" onClick={() => setMenu(false)}>Comment ça marche</a>
                <a href="#secteurs" onClick={() => setMenu(false)}>Secteurs</a>
                <a href="#employeurs" onClick={() => setMenu(false)}>Employeurs</a>
                <a href="#confiance" onClick={() => setMenu(false)}>Vos données</a>
                {user ? (
                  <Link to={spaceLink} onClick={() => setMenu(false)}>Mon espace</Link>
                ) : (
                  <Link to="/connexion" onClick={() => setMenu(false)}>Se connecter</Link>
                )}
                <Link to="/carte" className="btn btn-white mt-1 w-full justify-center sm:w-fit" onClick={() => setMenu(false)}>
                  Ouvrir la carte
                </Link>
              </div>
            ) : null}
          </div>
        </nav>

        <div className="wrap relative z-[5] mt-auto pb-[clamp(36px,8vw,120px)] pt-8">
          <h1 className="max-w-[15ch] text-[clamp(34px,9vw,104px)] leading-[1.05] text-white">
            <span className="block overflow-hidden">
              <span className="block animate-[hero-up_.95s_cubic-bezier(.16,1,.3,1)_forwards] translate-y-[105%]">
                Trouvez un emploi
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="block translate-y-[105%] animate-[hero-up_.95s_.1s_cubic-bezier(.16,1,.3,1)_forwards]">
                autour de vous
              </span>
            </span>
          </h1>
          <p className="mt-[26px] max-w-[48ch] text-[clamp(15px,1.4vw,18px)] font-medium text-white">
            Les postes qui recrutent s'affichent sur une vraie carte, à la commune près. Vous
            repérez une offre, vous postulez. Votre profil part chez l'employeur en un geste.
          </p>
          <div className="mt-7 flex w-full flex-col gap-2.5 sm:mt-[34px] sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
            <Link to="/carte" className="btn btn-lime btn-lg w-full justify-center sm:w-auto">
              Voir les offres près de moi
            </Link>
            <a href="#etapes" className="btn btn-white btn-lg w-full justify-center sm:w-auto">
              Comment ça marche
            </a>
          </div>
          <div className="mt-[clamp(34px,5vw,58px)] flex flex-wrap gap-[clamp(22px,4vw,54px)]">
            <div>
              <b className="block text-[clamp(22px,2.6vw,34px)] font-extrabold tracking-[-0.03em] text-white">
                <CountUp to={12480} />
              </b>
              <span className="text-[12.5px] text-white/60">offres actives sur la carte</span>
            </div>
            <div>
              <b className="block text-[clamp(22px,2.6vw,34px)] font-extrabold tracking-[-0.03em] text-white">
                0,8 s
              </b>
              <span className="text-[12.5px] text-white/60">publication → affichage</span>
            </div>
            <div>
              <b className="block text-[clamp(22px,2.6vw,34px)] font-extrabold tracking-[-0.03em] text-white">
                <CountUp to={2317} />
              </b>
              <span className="text-[12.5px] text-white/60">offres publiées aujourd'hui</span>
            </div>
          </div>
        </div>

        <aside className="absolute bottom-[clamp(60px,9vw,120px)] right-[clamp(18px,3.4vw,44px)] z-[5] hidden w-[min(330px,40vw)] rounded-3xl border border-white/14 bg-[rgba(14,16,15,.72)] p-3 shadow-live backdrop-blur-[14px] xl:block">
          <div className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 text-[12px] font-semibold text-white">
            <i className="live-dot" aria-hidden /> En direct, Paris 11<sup>e</sup>
          </div>
          <LiveMiniMap />
        </aside>
      </header>

      <main className="relative z-[8] -mt-[56px] rounded-canvas bg-paper py-[clamp(40px,5vw,64px)] pb-[clamp(50px,7vw,96px)]">
        <section className="wrap">
          <div className="grid items-start gap-[clamp(22px,3vw,44px)] lg:grid-cols-[1fr_1.15fr_1.5fr]">
            <Reveal>
              <p className="mb-[22px] text-[11.5px] font-bold tracking-[0.02em] text-muted">
                Ils recrutent près de chez vous
              </p>
              <ul className="m-0 list-none p-0">
                {SECTORS.map((s, i) => (
                  <li key={s}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 py-2.5 text-left text-[15px] font-medium text-[#4A4F4B] transition hover:translate-x-[3px] hover:text-ink ${i === sector ? 'font-bold text-ink' : ''}`}
                      onClick={() => setSector(i)}
                    >
                      <i
                        className={`h-1.5 w-1.5 flex-none rounded-full ${i === sector ? 'scale-[1.7] bg-success' : 'bg-[#C2C7C1]'}`}
                      />
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.09}>
              <p className="mb-[22px] text-[11.5px] font-bold tracking-[0.02em] text-muted">
                La carte en temps réel
              </p>
              <h3 className="mb-4 mt-1.5 text-[clamp(22px,2.5vw,30px)]">
                Une offre publiée
                <br />
                est visible dans la seconde
              </h3>
              <p className="max-w-[38ch] text-[14.5px] text-muted">
                Pas de moteur de recherche, pas de filtres à remplir. Vous ouvrez la carte, les
                postes ouverts s'affichent au centre de leur commune, à distance de votre
                position.
              </p>
              <Link to="/carte" className="btn btn-outline mt-6">
                Explorer la carte
              </Link>
            </Reveal>
            <Reveal delay={0.18} className="relative min-h-[230px] overflow-hidden rounded-block bg-ink p-[clamp(24px,3vw,38px)] text-white">
              <div className="pointer-events-none absolute -bottom-20 -right-[60px] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(207,232,164,.22),transparent_68%)]" />
              <h3 className="relative z-[2] max-w-[14ch] text-[clamp(22px,2.6vw,32px)]">
                Vous recrutez ?
                <br />
                Publiez votre offre.
              </h3>
              <p className="relative z-[2] mt-4 max-w-[40ch] text-[14px] text-white/60">
                Publiez une offre géolocalisée, choisissez le rayon de diffusion autour de votre
                entreprise et suivez vues, approches et candidatures en direct.
              </p>
              <Link to="/inscription?role=employer" className="btn btn-lime relative z-[2] mt-[26px]">
                Publier une offre
              </Link>
            </Reveal>
          </div>

          <div
            className="mt-[clamp(40px,5vw,64px)] overflow-hidden border-y border-line py-4 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]"
            aria-label="Offres publiées en direct"
          >
            <div className="flex w-max animate-[ticker-slide_46s_linear_infinite] gap-3 hover:[animation-play-state:paused]">
              {[...FEED, ...FEED].map((f, i) => (
                <span
                  key={`${f[0]}-${i}`}
                  className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-line px-4 py-2 text-[13px]"
                >
                  <i className="h-1.5 w-1.5 rounded-full bg-success" />
                  <b>{f[0]}</b>
                  <em className="text-[12px] not-italic text-muted">
                    {f[1]} · {f[2]}
                  </em>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap pt-[clamp(56px,7vw,104px)]" id="carte">
          <div className="mb-[clamp(26px,3vw,42px)] flex flex-wrap items-end justify-between gap-6">
            <Reveal>
              <h2 className="flex flex-wrap items-center gap-3.5 text-[clamp(28px,4vw,46px)]">
                La carte, c'est l'application <span className="pill">Géoplateforme IGN · temps réel</span>
              </h2>
              <p className="mt-3 max-w-[56ch] text-[14.5px] text-muted">
                Chaque repère est un poste réellement ouvert, affiché au centre de sa commune.
                Touchez-en un, lisez l'offre, puis postulez. Activez votre position pour trier
                par distance.
              </p>
            </Reveal>
            <Link to="/inscription?role=employer" className="btn btn-dark w-full justify-center sm:w-auto">
              Publier une offre
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.55fr_.95fr]">
            <div className="relative min-h-[min(52vh,420px)] overflow-hidden rounded-block border border-line bg-grey sm:min-h-[min(66vh,600px)]">
              <JobMap
                offers={visible}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setDetailId(id);
                }}
                onHover={setHoveredId}
                onCatch={(o) => catchOffer(o.id)}
                me={me.lat ? me : PARIS_11}
                catchLocked
              />
              <div className="pointer-events-none absolute inset-x-2 top-2 z-[600] flex max-w-full flex-wrap gap-1.5 sm:inset-x-3.5 sm:top-3.5 sm:gap-2">
                {(
                  [
                    ['all', 'Toutes', offers.length],
                    ['near', 'Moins de 600 m', offers.filter((o) => (o.distanceM ?? 0) <= 600).length],
                    ['new', 'Nouvelles', offers.filter((o) => o.isNew).length],
                    ['got', 'Postulées', caught.length],
                  ] as const
                ).map(([k, label, n]) => (
                  <button
                    key={k}
                    type="button"
                    className="chip pointer-events-auto px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]"
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                  >
                    <span className="sm:hidden">{k === 'near' ? '<600m' : label}</span>
                    <span className="hidden sm:inline">{label}</span> <b>{n}</b>
                  </button>
                ))}
                <button
                  type="button"
                  className="chip pointer-events-auto ml-auto flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition((p) => {
                      setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
                    });
                  }}
                >
                  Me localiser
                </button>
              </div>
            </div>
            <div className="max-h-[min(42vh,360px)] overflow-auto sm:max-h-[min(66vh,600px)]">
              <OfferList
                offers={visible}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setDetailId(id);
                }}
                onHover={setHoveredId}
              />
            </div>
          </div>
        </section>

        <section className="wrap pt-[clamp(56px,7vw,104px)]" id="etapes">
          <Reveal>
            <h2 className="text-[clamp(28px,4vw,46px)]">Trois gestes, et c'est fait</h2>
            <p className="mt-3 text-[14.5px] text-muted">Ouvrez la carte. Le reste se passe tout seul.</p>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['1', 'La carte affiche votre secteur', "Les offres de votre commune et des environs apparaissent, avec la distance jusqu'à chacune."],
              ['2', 'Vous consultez la fiche', "Titre, salaire, expérience demandée, description : toute l'information avant de vous décider."],
              ['3', 'Vous postulez', "Un tap envoie votre profil et votre CV directement à l'employeur, sans autre condition."],
            ].map(([n, t, p], i) => (
              <Reveal key={n} delay={i * 0.09} className="rounded-3xl border border-line bg-white p-5 transition hover:bg-grey sm:p-7">
                <div className="mb-5 grid h-[34px] w-[34px] place-items-center rounded-full bg-ink text-[14px] font-extrabold text-lime">
                  {n}
                </div>
                <h3 className="mb-2.5 text-[19px]">{t}</h3>
                <p className="text-[14px] text-muted">{p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="wrap pt-[clamp(56px,7vw,104px)]" id="secteurs">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="flex flex-wrap items-center gap-3 text-[clamp(28px,4vw,46px)]">
              Ils ont trouvé à moins d'un kilomètre <span className="pill">Témoignages</span>
            </h2>
            <Link to="/carte" className="btn btn-outline">
              Voir toutes les offres
            </Link>
          </div>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-5">
            {CARDS.map((c) => (
              <article key={c.n} className="w-[min(78vw,320px)] shrink-0 snap-start sm:w-auto sm:min-w-0">
                <div className="relative aspect-[4/3.1] overflow-hidden rounded-card bg-grey">
                  <span className="absolute left-2.5 top-2.5 z-[1] rounded-full bg-white/92 px-2.5 py-1.5 text-[10.5px] font-bold backdrop-blur">
                    {c.r.split(' · ')[0]}
                  </span>
                  <FallbackImg
                    src={c.img}
                    alt=""
                    className="h-full w-full object-cover transition duration-700 ease-brand hover:scale-105"
                  />
                </div>
                <h4 className="mb-2 mt-4 text-[15px] leading-snug tracking-[-0.02em]">{c.t}</h4>
                <p className="text-[12.5px] leading-relaxed text-muted">{c.d}</p>
                <div className="mt-4 flex items-center gap-2.5">
                  <FallbackImg src={c.a} alt="" className="h-7 w-7 rounded-full object-cover" />
                  <span className="text-[11px] text-muted">
                    <b className="block text-[11.5px] font-bold text-ink">{c.n}</b>
                    {c.r}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="wrap pt-[clamp(56px,7vw,104px)]">
          <div className="grid items-center gap-[clamp(20px,3vw,44px)] rounded-block bg-grey p-[clamp(24px,3.4vw,44px)] md:grid-cols-2">
            <div>
              <h2 className="text-[clamp(24px,3.2vw,38px)]">Une candidature envoyée, un employeur qui la reçoit</h2>
              <p className="mt-3.5 max-w-[44ch] text-[14.5px] text-muted">
                Pas de compte à créer pour repérer une offre : ouvrez la carte, consultez la fiche,
                postulez. Votre candidature part directement à l'employeur, sans étape
                supplémentaire.
              </p>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-card">
              <FallbackImg
                src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=80"
                alt="Une équipe qui vient de recruter dans son quartier"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        <section className="wrap pt-[clamp(56px,7vw,104px)]" id="employeurs">
          <Reveal>
            <h2 className="text-[clamp(28px,4vw,46px)]">Vous recrutez ? Dessinez votre zone</h2>
            <p className="mt-3 max-w-[56ch] text-[14.5px] text-muted">
              Votre offre est visible par tous les candidats qui passent dans le rayon choisi autour
              de l'entreprise. Le cercle ci-dessous est calé sur une vraie carte.
            </p>
          </Reveal>
          <div className="mt-8 grid items-center gap-[clamp(22px,3vw,44px)] lg:grid-cols-2">
            <div className="rounded-block border border-line bg-white p-[clamp(18px,2.4vw,28px)]">
              <div className="relative h-[min(46vh,360px)] overflow-hidden rounded-[20px] bg-grey">
                <ZonePreviewMap km={km} />
              </div>
              <div className="mt-5 flex items-baseline gap-2.5">
                <b className="text-[30px] font-extrabold">{km}</b>
                <span className="text-[14px] text-muted">
                  km autour du 12 rue de la Roquette, Paris 11<sup>e</sup>
                </span>
              </div>
              <input
                className="mt-2 h-1.5 w-full appearance-none rounded-md bg-grey"
                type="range"
                min={1}
                max={12}
                value={km}
                onChange={(e) => setKm(Number(e.target.value))}
                aria-label="Rayon de diffusion en kilomètres"
              />
              <div className="mt-[22px] flex flex-wrap items-center justify-between gap-4 border-t border-line pt-[22px]">
                <div>
                  <div className="text-[clamp(30px,3.6vw,44px)] font-extrabold tracking-[-0.035em]">
                    Gratuit
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {`${km} km autour de l'entreprise · environ ${reach} passages/jour`}
                  </p>
                </div>
                <Link to="/inscription?role=employer" className="btn btn-dark w-full justify-center sm:w-auto">
                  Créer un compte employeur
                </Link>
              </div>
              <p className="mt-3.5 text-[11.5px] text-muted">
                Publication gratuite, sans engagement, rayon réglable par offre. Vérification
                d'activité à l'inscription.
              </p>
            </div>
            <ul className="m-0 list-none p-0">
              {(
                [
                  {
                    t: 'Vos candidats sont déjà dans le quartier',
                    p: "Ils habitent, travaillent ou passent à côté. Le trajet domicile-travail devient le point de départ, plus l'obstacle.",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" strokeDasharray="3 3" />
                      </svg>
                    ),
                  },
                  {
                    t: 'Publiée à 14 h 02, visible à 14 h 02',
                    p: "L'offre apparaît sur la carte de tous les candidats de la zone sans qu'ils aient à recharger quoi que ce soit.",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M13 3 5 14h6l-1 7 9-12h-6l0-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                  {
                    t: 'Vous voyez ce que la zone donne',
                    p: 'Vues, approches, candidatures reçues, heures de passage : de quoi ajuster le rayon ou l’heure de publication.',
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    ),
                  },
                  {
                    t: 'Un signalement en deux taps',
                    p: "Le contenu des annonces engage l'employeur. Toute offre douteuse peut être signalée et retirée le temps de la vérification.",
                    icon: (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9.5 4.5-1 8-4.5 8-9.5V6l-8-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      </svg>
                    ),
                  },
                ] as { t: string; p: string; icon: ReactNode }[]
              ).map((row) => (
                <li key={row.t} className="flex gap-3.5 border-b border-line py-4 last:border-0">
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-sageSoft text-forest">
                    {row.icon}
                  </span>
                  <div>
                    <b className="text-[15px]">{row.t}</b>
                    <p className="mt-1 text-[13.5px] text-muted">{row.p}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="wrap pt-[clamp(56px,7vw,104px)]" id="confiance">
          <h2 className="text-[clamp(28px,4vw,46px)]">Votre position vous appartient</h2>
          <p className="mt-3 max-w-[56ch] text-[14.5px] text-muted">
            GéoEmploi ne fonctionne qu'avec des données de localisation. Autant être clair sur ce
            qu'on en fait.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(
              [
                {
                  t: 'Active seulement sur la carte',
                  p: "Votre position sert à calculer les distances pendant que la carte est ouverte. Aucun historique de déplacement n'est conservé, et le partage se coupe en un tap.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      <circle cx="12" cy="11" r="2.2" fill="currentColor" />
                    </svg>
                  ),
                },
                {
                  t: 'Consentement et information claire',
                  p: "Au premier lancement, une notice indique quelles données sont collectées, pourquoi, combien de temps et par qui. Vous acceptez, refusez, ou changez d'avis dans les réglages.",
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 6h14M5 12h10M5 18h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  t: 'Signalement des offres',
                  p: 'Les annonces engagent la responsabilité de l’employeur. Une offre frauduleuse ou non conforme peut être signalée depuis sa fiche et sort de la carte le temps du contrôle.',
                  icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M6 21V4h.5L14 8.5 6.5 13" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    </svg>
                  ),
                },
              ] as { t: string; p: string; icon: ReactNode }[]
            ).map((row) => (
              <article key={row.t} className="rounded-3xl border border-line p-5 sm:p-7">
                <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-sageSoft text-forest">
                  {row.icon}
                </div>
                <h3 className="mb-2.5 mt-[18px] text-[17px]">{row.t}</h3>
                <p className="text-[13.5px] text-muted">{row.p}</p>
              </article>
            ))}
          </div>
          <div className="relative mt-[clamp(40px,6vw,90px)] overflow-hidden rounded-[22px] bg-ink px-5 py-10 text-center text-white sm:rounded-[30px] sm:px-[clamp(34px,5vw,76px)] sm:py-[clamp(34px,5vw,76px)]">
            <div className="pointer-events-none absolute inset-x-[-10%] -bottom-[60%] h-[340px] bg-[radial-gradient(ellipse_at_center,rgba(207,232,164,.22),transparent_66%)]" />
            <h2 className="relative mx-auto max-w-[18ch] text-[clamp(28px,4.4vw,54px)]">
              Sortez. Il y a du travail dans votre rue.
            </h2>
            <p className="relative mx-auto mt-[18px] max-w-[52ch] text-[15px] text-white/62">
              Ouvrez la carte, autorisez la localisation, et regardez ce qui recrute autour de vous
              en ce moment même.
            </p>
            <div className="relative mt-6 flex w-full flex-col gap-2.5 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
              <Link to="/carte" className="btn btn-lime btn-lg w-full justify-center sm:w-auto">
                Ouvrir la carte
              </Link>
              <Link to="/inscription?role=employer" className="btn btn-white btn-lg w-full justify-center sm:w-auto">
                Je recrute
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      {detailId ? (
        <OfferDetailModal offerId={detailId} onClose={() => setDetailId(null)} />
      ) : null}
      <p className="sr-only">{formatDistance(180)}</p>
    </div>
  );
}
