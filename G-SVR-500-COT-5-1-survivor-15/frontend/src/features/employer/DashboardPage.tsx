import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Badge, type BadgeTone } from '@/components/ui/Tag';
import { SectorMark } from '@/components/ui/SectorIcon';
import { useSessionStore } from '@/store/session';
import type { EmployerStats, Offer, Application } from '@/types';

const APP_STATUS: Record<Application['status'], { label: string; tone: BadgeTone }> = {
  sent: { label: 'Envoyée', tone: 'muted' },
  viewed: { label: 'Vue', tone: 'sage' },
  interview: { label: 'Entretien', tone: 'sage' },
  accepted: { label: 'Acceptée', tone: 'forest' },
  rejected: { label: 'Refusée', tone: 'danger' },
};

/* ─── Stat card (Niond-inspired: colored left border + large number) ─── */
function StatCard({
  n,
  label,
  sub,
  icon,
  border,
  accent,
}: {
  n: number | string;
  label: string;
  sub?: string;
  icon: ReactNode;
  border: string;
  accent: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[16px] border border-line bg-paper p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card',
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-[4px] rounded-l-[16px]', border)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{label}</p>
          <p className="mt-2 text-[32px] font-extrabold leading-none tracking-[-0.03em] text-ink">
            {typeof n === 'number' ? formatNumber(n) : n}
          </p>
          {sub ? (
            <p className="mt-1.5 text-[12px] font-medium text-muted">{sub}</p>
          ) : null}
        </div>
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[14px]', accent)}>
          {icon}
        </span>
      </div>
    </div>
  );
}

/* ─── Vertical bar chart (Niond-inspired) ─── */
const BAR_HEIGHT = 140;

function BarChart({ hours }: { hours: { hour: string; count: number }[] }) {
  const max = Math.max(...hours.map((h) => h.count), 1);
  return (
    <div className="flex items-end justify-around gap-3 sm:gap-5">
      {hours.map((h) => {
        const pct = max > 0 ? h.count / max : 0;
        const barH = Math.max(Math.round(pct * BAR_HEIGHT), 6);
        const isPeak = h.count === max;
        return (
          <div key={h.hour} className="flex flex-col items-center gap-2">
            <span className={cn('text-[12px] font-bold', isPeak ? 'text-forest' : 'text-muted')}>
              {h.count}
            </span>
            <div
              className={cn(
                'w-10 rounded-t-[8px] transition-all duration-700 sm:w-14',
                isPeak ? 'bg-forest' : 'bg-sage/60',
              )}
              style={{ height: barH }}
            />
            <span className="text-[12px] font-semibold text-muted">{h.hour}</span>
          </div>
        );
      })}
    </div>
  );
}

export function EmployerDashboard() {
  const user = useSessionStore((s) => s.user);
  const initials = `${user?.companyName?.[0] ?? ''}`.toUpperCase() || 'E';

  const statsQ = useQuery({
    queryKey: ['pro-stats'],
    queryFn: async () => (await api.get<EmployerStats>('/pro/stats')).data,
  });
  const offersQ = useQuery({
    queryKey: ['pro-offers'],
    queryFn: async () => (await api.get<Offer[]>('/pro/offers')).data,
  });
  const appsQ = useQuery({
    queryKey: ['pro-applications'],
    queryFn: async () => (await api.get<Application[]>('/pro/applications')).data,
  });

  const s = statsQ.data;
  const offers = offersQ.data ?? [];
  const apps = appsQ.data ?? [];
  const activeOffers = offers.filter((o) => o.status === 'published').length;

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-7 md:py-7">
      {/* ─── Header ─── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="text-[clamp(24px,5vw,36px)] font-extrabold tracking-[-0.035em] text-ink">
            Tableau de bord
          </h1>
          <p className="mt-1 text-[13.5px] font-medium text-muted sm:text-[14px]">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[14px] font-bold text-ink">{user?.companyName ?? 'Mon entreprise'}</p>
            <p className="text-[12px] text-muted">{user?.sector ?? 'Employeur'}</p>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-forest text-[15px] font-extrabold text-white shadow-soft">
            {initials}
          </span>
        </div>
      </div>

      {/* ─── Stat cards row ─── */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-3 sm:gap-4">
        <StatCard
          n={s?.views ?? '-'}
          label="Vues totales"
          sub="Sur l'ensemble de vos offres"
          border="bg-sage"
          accent="bg-sageSoft text-forest"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          }
        />
        <StatCard
          n={s?.approaches ?? '-'}
          label="Approches"
          sub="Candidats à moins de 600 m"
          border="bg-forest"
          accent="bg-forest/10 text-forest"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <circle cx="12" cy="11" r="2.2" fill="currentColor" />
            </svg>
          }
        />
        <StatCard
          n={s?.applications ?? '-'}
          label="Candidatures"
          sub="Reçues sur vos offres"
          border="bg-lime"
          accent="bg-lime/30 text-ink"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {user?.status === 'pending' ? (
        <div className="mb-5 rounded-[16px] border border-line bg-grey/60 px-5 py-4 sm:mb-6">
          <p className="flex items-center gap-2.5 text-[13px] font-semibold text-muted">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/8 text-[12px]">⏳</span>
            Activité vérifiée sous 48 h. Vous pouvez préparer une offre, la publication restera bloquée.
          </p>
        </div>
      ) : null}

      {/* ─── Main grid: chart + aside ─── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.85fr)]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Bar chart, heures de passage */}
          <section className="surface-card p-5 sm:p-6 md:p-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Fréquentation</h2>
                <p className="mt-1 text-[13px] font-medium text-muted">
                  Consultations de vos offres par des candidats à proximité
                </p>
              </div>
              <span className="rounded-full bg-grey px-3 py-1.5 text-[11px] font-bold text-muted">
                Temps réel
              </span>
            </div>
            {(s?.peakHours ?? []).length > 0 ? (
              <BarChart hours={s!.peakHours} />
            ) : !statsQ.isLoading ? (
              <p className="rounded-[14px] bg-grey px-4 py-10 text-center text-[13.5px] text-muted">
                Pas encore de données de fréquentation.
              </p>
            ) : null}
          </section>

          {/* Offres actives, table-like */}
          <section className="surface-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6 md:px-7">
              <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Vos offres</h2>
              <Link to="/pro/offres" className="link-forest text-[12.5px]">
                Tout gérer →
              </Link>
            </div>
            <div className="divide-y divide-line">
              {offers.slice(0, 5).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-grey/40 sm:px-6 md:px-7"
                >
                  <SectorMark sector={o.sector} size={38} className="rounded-[12px]" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[14px] font-bold">{o.title}</b>
                    <p className="text-[12px] text-muted">
                      {o.address}
                    </p>
                  </div>
                  <div className="hidden items-center gap-4 text-[12px] text-muted sm:flex">
                    <span>{o.views} vues</span>
                    <span>{o.applicationsCount} candid.</span>
                  </div>
                  <Badge tone={o.status === 'published' ? 'sage' : 'muted'}>
                    {o.status === 'published' ? 'Active' : o.status}
                  </Badge>
                </div>
              ))}
              {!offers.length && !offersQ.isLoading ? (
                <div className="px-5 py-8 text-center text-[13.5px] text-muted sm:px-6 md:px-7">
                  Aucune offre publiée.{' '}
                  <Link to="/pro/offres/nouvelle" className="link-forest">
                    Créer votre première offre
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* Right column, aside */}
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-[16px] bg-forest p-6 text-white shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/60">
              Offres actives
            </p>
            <p className="mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em]">
              {activeOffers}
            </p>
            <p className="mt-1 text-[12px] text-white/60">
              Publication gratuite, rayon de diffusion réglable par offre.
            </p>
            <Link
              to="/pro/offres/nouvelle"
              className="mt-4 inline-flex w-full items-center justify-center rounded-[12px] bg-lime px-4 py-2.5 text-[13px] font-bold text-ink transition hover:-translate-y-0.5 hover:bg-limeDeep"
            >
              Publier une offre
            </Link>
          </section>

          {/* Candidatures récentes */}
          <section className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Candidatures</h2>
              <Link to="/pro/candidatures" className="link-forest text-[12px]">
                Tout voir
              </Link>
            </div>
            <ul className="space-y-2">
              {apps.slice(0, 4).map((a) => {
                const st = APP_STATUS[a.status];
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5 transition hover:bg-grey/40"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sageSoft text-[12px] font-extrabold text-forest">
                      {a.candidateName?.[0] ?? '?'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-bold">{a.candidateName}</b>
                      <small className="text-[11px] text-muted">{a.offerTitle}</small>
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
              {!apps.length && !appsQ.isLoading ? (
                <p className="py-4 text-center text-[12.5px] text-muted">
                  Aucune candidature reçue.
                </p>
              ) : null}
            </ul>
          </section>

          {/* Profil entreprise */}
          <section className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest text-[16px] font-extrabold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{user?.companyName ?? 'Mon entreprise'}</p>
                <p className="text-[12px] text-muted">{user?.sector ?? 'Employeur'}</p>
              </div>
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <span className="text-muted">SIRET</span>
                <b className="truncate">{user?.siret ?? '-'}</b>
              </div>
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <span className="text-muted">Adresse</span>
                <b className="max-w-[18ch] truncate">{user?.address ?? '-'}</b>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <span className="text-muted">Statut</span>
                <b className={user?.status === 'active' ? 'text-forest' : 'text-muted'}>
                  {user?.status === 'active' ? 'Vérifié' : 'En attente'}
                </b>
              </div>
            </div>
          </section>

          {/* Quick actions */}
          <section className="surface-card p-5 sm:p-6">
            <h2 className="mb-3 text-[17px] font-extrabold tracking-[-0.02em]">Actions rapides</h2>
            <div className="grid gap-2">
              <Link
                to="/pro/offres/nouvelle"
                className="flex items-center gap-3 rounded-[14px] border border-line px-4 py-3 text-[13px] font-semibold transition hover:border-forest/30 hover:bg-grey/50"
              >
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-lime/40 text-ink">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                Publier une offre
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="ml-auto text-muted">
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                to="/pro/candidatures"
                className="flex items-center gap-3 rounded-[14px] border border-line px-4 py-3 text-[13px] font-semibold transition hover:border-forest/30 hover:bg-grey/50"
              >
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-sageSoft text-forest">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </span>
                Voir les candidatures
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="ml-auto text-muted">
                  <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <div className="mt-4 rounded-[14px] border border-dashed border-line px-3.5 py-3">
              <p className="text-[12px] text-muted">
                <b className="text-ink">{activeOffers}</b> offre{activeOffers !== 1 ? 's' : ''} active{activeOffers !== 1 ? 's' : ''}
                {(s?.applications ?? 0) > 0 ? (
                  <> · <b className="text-ink">{formatNumber(s!.applications)}</b> candidature{s!.applications !== 1 ? 's' : ''} au total</>
                ) : null}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
