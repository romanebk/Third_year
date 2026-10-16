import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { JobMap } from '@/components/map/JobMap';
import { OfferDetailModal } from '@/features/offers/OfferDetailModal';
import { ApplicationModal } from '@/features/candidate/ApplicationModal';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useOffers, type OfferWithDistance } from '@/hooks/useOffers';
import { useRealtimeOffers } from '@/hooks/useRealtime';
import { useConsentStore } from '@/store/consent';
import { useLocationStore } from '@/store/location';
import { usePreferencesStore } from '@/store/preferences';
import { useSessionStore } from '@/store/session';
import { useCaughtStore } from '@/store/caught';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/cn';
import { Badge, type BadgeTone } from '@/components/ui/Tag';
import { SectorMark } from '@/components/ui/SectorIcon';
import {
  CONTRACTS,
  SECTORS,
  type Application,
  type ContractType,
  type Offer,
  type Sector,
} from '@/types';

const STATUS: Record<Application['status'], { label: string; tone: BadgeTone }> = {
  sent: { label: 'Envoyée', tone: 'muted' },
  viewed: { label: 'Vue', tone: 'sage' },
  interview: { label: 'Entretien', tone: 'sage' },
  accepted: { label: 'Acceptée', tone: 'forest' },
  rejected: { label: 'Refusée', tone: 'danger' },
};

const RADIUS_OPTS = [
  { km: 0.6, label: '600 m' },
  { km: 1, label: '1 km' },
  { km: 2, label: '2 km' },
  { km: 5, label: '5 km' },
];

function PrefChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition',
        active
          ? 'border-forest bg-forest text-white'
          : 'border-line bg-white text-ink hover:border-forest/40',
      )}
    >
      {children}
    </button>
  );
}

function StatTile({
  n,
  label,
  icon,
  accent,
}: {
  n: number;
  label: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-paper p-3.5 shadow-soft">
      <span className={cn('mb-2 grid h-9 w-9 place-items-center rounded-[12px]', accent)}>
        {icon}
      </span>
      <p className="text-[24px] font-extrabold tracking-[-0.03em] text-ink">{formatNumber(n)}</p>
      <p className="mt-0.5 text-[12px] font-medium text-muted">{label}</p>
    </div>
  );
}

export function DashboardPage() {
  const user = useSessionStore((s) => s.user);
  const me = useLocationStore((s) => s.position);
  const granted = useConsentStore((s) => s.geo === 'granted');
  useGeolocation(granted);
  useRealtimeOffers();

  const prefs = usePreferencesStore();
  const caught = useCaughtStore((s) => s.ids);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [catchTarget, setCatchTarget] = useState<Offer | null>(null);
  const [bbox, setBbox] = useState<string>();

  const offersQuery = useOffers({
    bbox,
    lat: me.lat,
    lng: me.lng,
    filters: {
      onlyNew: prefs.onlyNew || undefined,
      radius: prefs.radiusKm,
    },
  });

  const appsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: async () => (await api.get<Application[]>('/applications')).data,
  });

  const offers = useMemo(() => {
    let list = offersQuery.data ?? [];
    if (prefs.sectors.length) {
      list = list.filter((o) => prefs.sectors.includes(o.sector));
    }
    if (prefs.contracts.length) {
      list = list.filter((o) => prefs.contracts.includes(o.contract));
    }
    if (prefs.walkOnly) {
      list = list.filter((o) => (o.distanceM ?? 99999) <= 600);
    }
    return list;
  }, [offersQuery.data, prefs.contracts, prefs.sectors, prefs.walkOnly]);

  const apps = appsQuery.data ?? [];
  const interviews = apps.filter((a) => a.status === 'interview' || a.status === 'accepted').length;
  const near = offers.filter((o) => (o.distanceM ?? 9999) <= 600).length;
  const neu = offers.filter((o) => o.isNew).length;

  const onCatch = (offer: Offer) => setCatchTarget(offer);
  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailId(id);
  };

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-7 md:py-7">
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.85fr)_minmax(280px,0.78fr)]">
        <div className="space-y-4 sm:space-y-5">
          <section className="overflow-hidden rounded-block border border-line bg-paper shadow-map">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-5 sm:py-5 md:px-7">
              <div className="min-w-0">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted sm:text-[12px]">
                  Bonjour {user?.firstName ?? ''}
                </p>
                <h2 className="mt-1.5 text-[clamp(22px,5vw,36px)] font-extrabold tracking-[-0.035em] text-ink">
                  {offers.length} offre{offers.length === 1 ? '' : 's'} autour de vous
                </h2>
                <p className="mt-2 max-w-[48ch] text-[13.5px] font-medium leading-relaxed text-muted sm:text-[14px]">
                  La carte affiche les postes qui correspondent à vos préférences. Repérez une
                  offre, consultez la fiche, postulez.
                </p>
              </div>
              <Link to="/app/carte" className="btn btn-forest w-full justify-center py-2.5 text-[13px] sm:w-auto">
                Carte plein écran
              </Link>
            </div>
            <div className="relative h-[min(46vh,480px)] min-h-[240px] bg-grey sm:h-[min(52vh,520px)] sm:min-h-[360px]">
              <JobMap
                offers={offers as OfferWithDistance[]}
                selectedId={selectedId}
                hoveredId={null}
                onSelect={openDetail}
                onHover={() => undefined}
                onCatch={onCatch}
                onBBox={setBbox}
                me={me}
                circleRadiusM={Math.round(prefs.radiusKm * 1000)}
              />
              <div className="pointer-events-none absolute left-2 right-2 top-2 z-[600] flex flex-wrap gap-1.5 sm:left-3 sm:right-auto sm:top-3 sm:gap-2">
                <span className="chip pointer-events-none px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]">
                  Dans le rayon <b>{formatNumber(offers.length)}</b>
                </span>
                <span className="chip pointer-events-none px-2.5 py-1.5 text-[11.5px] sm:px-[15px] sm:py-[9px] sm:text-[13px]">
                  &lt; 600 m <b>{near}</b>
                </span>
                <span className="chip pointer-events-none hidden px-2.5 py-1.5 text-[11.5px] sm:inline sm:px-[15px] sm:py-[9px] sm:text-[13px]">
                  Nouvelles <b>{neu}</b>
                </span>
              </div>
            </div>
          </section>

          <section className="surface-card p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">
                  Préférences de travail
                </h2>
                <p className="mt-1.5 text-[13.5px] font-medium text-muted">
                  Affinez pour ne voir que les offres qui vous correspondent.
                </p>
              </div>
              <button
                type="button"
                className="text-[12.5px] font-semibold text-muted underline-offset-2 hover:text-forest hover:underline"
                onClick={() => prefs.clear()}
              >
                Réinitialiser
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-muted">
                  Secteurs
                </p>
                <div className="flex flex-wrap gap-2">
                  {SECTORS.map((s: Sector) => (
                    <PrefChip
                      key={s}
                      active={prefs.sectors.includes(s)}
                      onClick={() => prefs.toggleSector(s)}
                    >
                      {s}
                    </PrefChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-muted">
                  Contrats
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONTRACTS.map((c: ContractType) => (
                    <PrefChip
                      key={c}
                      active={prefs.contracts.includes(c)}
                      onClick={() => prefs.toggleContract(c)}
                    >
                      {c}
                    </PrefChip>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-muted">
                    Rayon
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RADIUS_OPTS.map((r) => (
                      <PrefChip
                        key={r.km}
                        active={prefs.radiusKm === r.km}
                        onClick={() => prefs.setRadiusKm(r.km)}
                      >
                        {r.label}
                      </PrefChip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PrefChip active={prefs.onlyNew} onClick={() => prefs.setOnlyNew(!prefs.onlyNew)}>
                    Nouvelles uniquement
                  </PrefChip>
                  <PrefChip
                    active={prefs.walkOnly}
                    onClick={() => prefs.setWalkOnly(!prefs.walkOnly)}
                  >
                    À pied (&lt; 600 m)
                  </PrefChip>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-card p-6 md:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">
                  Suivi des candidatures
                </h2>
                <p className="mt-1 text-[13.5px] font-medium text-muted">Dernières réponses reçues</p>
              </div>
              <Link to="/app/candidatures" className="link-forest text-[13px]">
                Tout voir
              </Link>
            </div>
            <ul className="space-y-2.5">
              {apps.slice(0, 5).map((a) => {
                const st = STATUS[a.status];
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-grey/60 px-4 py-3.5"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sageSoft text-[13px] font-extrabold text-forest">
                      {a.company.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] font-bold">{a.offerTitle}</b>
                      <small className="text-[12px] text-muted">
                        {a.company} · {formatDate(a.createdAt)}
                      </small>
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
              {!apps.length && !appsQuery.isLoading ? (
                <p className="rounded-[14px] bg-grey px-4 py-6 text-center text-[13.5px] text-muted">
                  Rien ici pour l’instant. Ouvrez la carte pour postuler ?
                </p>
              ) : null}
            </ul>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface-card p-6">
            <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Statistiques</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatTile
                n={offers.length}
                label="Offres visibles"
                accent="bg-sageSoft text-forest"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4Z" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                }
              />
              <StatTile
                n={apps.length}
                label="Candidatures"
                accent="bg-grey text-ink"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                }
              />
              <StatTile
                n={interviews}
                label="Entretiens / OK"
                accent="bg-forest/10 text-forest"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="m5 12 5 5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                }
              />
              <StatTile
                n={caught.length}
                label="Postulées"
                accent="bg-ink text-lime"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
                    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                  </svg>
                }
              />
            </div>
            <div className="mt-4 rounded-[14px] border border-dashed border-line px-3.5 py-3">
              <p className="text-[12.5px] text-muted">
                Rayon actif ·{' '}
                <b className="text-ink">
                  {prefs.radiusKm < 1 ? `${prefs.radiusKm * 1000} m` : `${prefs.radiusKm} km`}
                </b>
                {prefs.sectors.length ? (
                  <>
                    {' '}
                    · {prefs.sectors.length} secteur{prefs.sectors.length > 1 ? 's' : ''}
                  </>
                ) : null}
              </p>
            </div>
          </section>

          <section className="surface-card p-6 text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-sageSoft text-[22px] font-extrabold text-forest">
              {`${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'CG'}
            </span>
            <p className="mt-3 text-[17px] font-extrabold tracking-[-0.02em]">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[13px] font-medium text-muted">
              {user?.jobTitle || 'Candidat · GéoEmploi'}
            </p>
            <div className="mt-4 grid gap-2 text-left text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <span className="text-muted">Ville</span>
                <b>{user?.city || 'Paris'}</b>
              </div>
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <span className="text-muted">Disponible</span>
                <b>{user?.availableFrom ? formatDate(user.availableFrom) : 'Immédiat'}</b>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <span className="text-muted">Profil</span>
                <b className="text-forest">{user?.profileVisible === false ? 'Masqué' : 'Visible'}</b>
              </div>
            </div>
            <Link
              to="/app/profil"
              className="btn btn-forest mt-4 w-full justify-center py-2.5 text-[13px]"
            >
              Éditer le profil
            </Link>
          </section>

          <section className="surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Matches proches</h2>
              <Link to="/app/carte" className="link-forest text-[12.5px]">
                Carte
              </Link>
            </div>
            <ul className="space-y-2">
              {offers.slice(0, 4).map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[14px] border border-line px-3 py-2.5 text-left transition hover:border-forest/25 hover:bg-grey/50"
                    onClick={() => openDetail(o.id)}
                  >
                    <SectorMark sector={o.sector} size={36} className="rounded-[12px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-bold">{o.title}</b>
                      <small className="text-[11.5px] text-muted">
                        {o.company} · {o.contract}
                      </small>
                    </span>
                    <Badge tone="sage">
                      {o.distanceM != null ? formatDistance(o.distanceM) : '-'}
                    </Badge>
                  </button>
                </li>
              ))}
              {!offers.length && !offersQuery.isLoading ? (
                <p className="py-4 text-center text-[13px] text-muted">
                  Rien ici pour l’instant. Élargissez vos préférences ?
                </p>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>

      {detailId ? (
        <OfferDetailModal
          offerId={detailId}
          onClose={() => setDetailId(null)}
          onCatch={onCatch}
        />
      ) : null}
      {catchTarget ? (
        <ApplicationModal offer={catchTarget} onClose={() => setCatchTarget(null)} />
      ) : null}
    </div>
  );
}
