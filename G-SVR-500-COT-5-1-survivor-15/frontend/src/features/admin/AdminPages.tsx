import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Tag';
import { Modal } from '@/components/ui/Modal';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import type {
  AdminMetrics,
  AdminMetricsSeriesPoint,
  Offer,
  OfferReport,
  OfferStatus,
  Role,
  User,
  UserStatus,
} from '@/types';

const OFFER_STATUS_META: Record<OfferStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Brouillon', tone: 'sage' },
  pending: { label: 'En attente', tone: 'sage' },
  published: { label: 'Active', tone: 'forest' },
  unpublished: { label: 'Dépubliée', tone: 'sage' },
  reported: { label: 'Signalée', tone: 'danger' },
};

/** Modale "offres de cet employeur", ouverte depuis une ligne employeur de AdminUsersPage. */
function EmployerOffersModal({ employer, onClose }: { employer: User; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['admin-offers', 'by-employer', employer.id],
    queryFn: async () => (await api.get<Offer[]>(`/admin/offers?employerId=${employer.id}`)).data,
  });
  const offers = q.data ?? [];

  return (
    <Modal open title={`Offres de ${employer.companyName ?? employer.email}`} onClose={onClose}>
      {q.isLoading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Chargement">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-[64px] animate-pulse rounded-block border border-line bg-grey" />
          ))}
        </ul>
      ) : q.isError ? (
        <p className="text-[14px] text-danger">Impossible de charger les offres de cet employeur.</p>
      ) : offers.length === 0 ? (
        <p className="text-[14px] text-muted">Cet employeur n’a publié aucune offre.</p>
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => (
            <li key={o.id} className="rounded-block border border-line bg-paper p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <b className="text-[14.5px]">{o.title}</b>
                <Badge tone={OFFER_STATUS_META[o.status].tone}>{OFFER_STATUS_META[o.status].label}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted">{o.address}</p>
              <p className="mt-1 text-[12px] text-muted">
                Publiée le {new Date(o.createdAt).toLocaleDateString('fr-FR')} · {o.applicationsCount} candidature
                {o.applicationsCount > 1 ? 's' : ''} · {o.views} vue{o.views > 1 ? 's' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const ROLE_LABEL: Record<Role, string> = {
  candidate: 'Demandeur d’emploi',
  employer: 'Employeur',
  admin: 'Admin',
};

const STATUS_META: Record<UserStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Actif', tone: 'forest' },
  pending: { label: 'En attente', tone: 'sage' },
  suspended: { label: 'Suspendu', tone: 'danger' },
};

type RoleFilter = 'all' | 'candidate' | 'employer';

function userDisplayName(u: User) {
  if (u.role === 'employer' && u.companyName) return u.companyName;
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.email;
}

function userInitials(u: User) {
  if (u.role === 'employer' && u.companyName) return u.companyName.slice(0, 1).toUpperCase();
  const a = u.firstName?.[0] ?? '';
  const b = u.lastName?.[0] ?? '';
  return `${a}${b}`.toUpperCase() || u.email.slice(0, 1).toUpperCase();
}

export function ModerationPage() {
  const qc = useQueryClient();
  const offers = useQuery({
    queryKey: ['admin-offers'],
    queryFn: async () => (await api.get<Offer[]>('/admin/offers?status=reported')).data,
  });
  const reports = useQuery({
    queryKey: ['admin-reports'],
    queryFn: async () => (await api.get<OfferReport[]>('/admin/reports')).data,
  });
  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Offer['status'] }) =>
      api.patch(`/offers/${id}`, { status }),
    // L'action réussit bien côté serveur (le signalement se referme), mais la
    // liste affichée vient de la requête ['admin-reports'], jamais invalidée
    // ici avant ce correctif : la carte restait affichée après "Rétablir" ou
    // "Retirer", donnant l'impression que les boutons ne faisaient rien.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-offers'] });
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
    },
  });

  const list = reports.data ?? [];
  const empty = !offers.isLoading && !reports.isLoading && list.length === 0 && (offers.data?.length ?? 0) === 0;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Back-office</p>
        <h1 className="mt-2 text-[clamp(26px,4vw,34px)]">Modération</h1>
        <p className="mt-2 text-[14.5px] text-muted">
          File des offres signalées. Chaque action est tracée (compte admin nominatif).
        </p>
      </header>

      {offers.isLoading || reports.isLoading ? (
        <ul className="mt-8 space-y-3" aria-busy="true" aria-label="Chargement">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-[120px] animate-pulse rounded-block border border-line bg-grey" />
          ))}
        </ul>
      ) : empty ? (
        <div className="mt-10 rounded-block border border-dashed border-line bg-grey/50 px-6 py-12 text-center">
          <p className="text-[15px] font-bold text-ink">Aucune offre en attente</p>
          <p className="mt-1.5 text-[13.5px] text-muted">Les signalements ouverts apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {list.map((r) => (
            <li
              key={r.id}
              className="rounded-block border border-line bg-paper p-4 shadow-soft transition duration-200 ease-brand sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <b className="text-[15.5px]">{r.offerTitle}</b>
                <Badge tone="danger">Signalée</Badge>
              </div>
              <p className="mt-2 text-[13.5px] text-muted">
                {r.reason}
                {r.comment ? ` · ${r.comment}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="lime"
                  className="px-4 py-2.5 text-[13px]"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ id: r.offerId, status: 'published' })}
                >
                  Rétablir
                </Button>
                <Button
                  variant="outline"
                  className="px-4 py-2.5 text-[13px]"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate({ id: r.offerId, status: 'unpublished' })}
                >
                  Retirer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [search, setSearch] = useState('');
  const [offersOf, setOffersOf] = useState<User | null>(null);

  const q = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<User[]>('/admin/users')).data,
  });

  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api.patch(`/admin/users/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const accounts = useMemo(
    () => (q.data ?? []).filter((u) => u.role === 'candidate' || u.role === 'employer'),
    [q.data],
  );

  const counts = useMemo(() => {
    const candidate = accounts.filter((u) => u.role === 'candidate').length;
    const employer = accounts.filter((u) => u.role === 'employer').length;
    return { all: accounts.length, candidate, employer };
  }, [accounts]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return accounts.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [u.email, u.firstName, u.lastName, u.companyName, ROLE_LABEL[u.role]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [accounts, roleFilter, statusFilter, search]);

  const roleTabs: { id: RoleFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: counts.all },
    { id: 'candidate', label: 'Demandeurs d’emploi', count: counts.candidate },
    { id: 'employer', label: 'Employeurs', count: counts.employer },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Back-office</p>
        <h1 className="mt-2 text-[clamp(26px,4vw,34px)]">Comptes</h1>
        <p className="mt-2 text-[14.5px] text-muted">
          Gérez les comptes employeurs et demandeurs d’emploi : activation, suspension, réactivation.
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total', value: counts.all, border: 'bg-forest', accent: 'bg-sageSoft text-forest' },
          { label: 'Demandeurs', value: counts.candidate, border: 'bg-sage', accent: 'bg-grey text-ink' },
          { label: 'Employeurs', value: counts.employer, border: 'bg-limeDeep', accent: 'bg-[#F4F8EC] text-forest' },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-block border border-line bg-paper p-4 shadow-soft sm:p-5"
          >
            <div className={cn('absolute inset-y-0 left-0 w-[4px] rounded-l-block', s.border)} />
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{s.label}</p>
            <p className="mt-1.5 text-[28px] font-extrabold tracking-[-0.03em] text-ink">
              {q.isLoading ? '—' : formatNumber(s.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div
          className="flex gap-1 overflow-x-auto scroll-smooth rounded-[16px] border border-line bg-grey p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filtrer par type de compte"
        >
          {roleTabs.map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRoleFilter(tab.id)}
                className={cn(
                  'shrink-0 rounded-[12px] px-3.5 py-2 text-[13px] font-semibold transition duration-200 ease-brand sm:px-4',
                  active ? 'bg-forest text-white shadow-soft' : 'text-muted hover:text-ink',
                )}
              >
                {tab.label}
                <span className={cn('ml-1.5 tabular-nums', active ? 'opacity-80' : 'opacity-55')}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Rechercher un compte</span>
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, e-mail, entreprise…"
              className="field-input py-2.5 pl-10 pr-4 text-[14px]"
            />
          </label>

          <label className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-muted">
            <span className="sr-only sm:not-sr-only">Statut</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | UserStatus)}
              className="field-input w-full py-2.5 text-[14px] sm:w-[160px]"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option>
              <option value="pending">En attente</option>
              <option value="suspended">Suspendu</option>
            </select>
          </label>
        </div>
      </div>

      {q.isLoading ? (
        <ul className="mt-6 space-y-3" aria-busy="true" aria-label="Chargement des comptes">
          {[1, 2, 3, 4].map((i) => (
            <li key={i} className="h-[96px] animate-pulse rounded-block border border-line bg-grey" />
          ))}
        </ul>
      ) : q.isError ? (
        <div className="mt-8 rounded-block border border-danger/30 bg-[#F8E8E5] px-5 py-6 text-center">
          <p className="text-[14.5px] font-bold text-danger">Impossible de charger les comptes.</p>
          <Button variant="outline" className="mt-3 px-4 py-2.5 text-[13px]" onClick={() => q.refetch()}>
            Réessayer
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-block border border-dashed border-line bg-grey/50 px-6 py-12 text-center">
          <p className="text-[15px] font-bold text-ink">Aucun compte trouvé</p>
          <p className="mt-1.5 text-[13.5px] text-muted">
            {search || statusFilter !== 'all' || roleFilter !== 'all'
              ? 'Modifiez les filtres ou la recherche.'
              : 'Les nouveaux comptes apparaîtront ici.'}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((u) => {
            const status = STATUS_META[u.status];
            const isEmployer = u.role === 'employer';
            return (
              <li
                key={u.id}
                className="rounded-block border border-line bg-paper p-4 shadow-soft transition duration-200 ease-brand hover:shadow-card sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        'grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[13px] font-extrabold',
                        isEmployer ? 'bg-forest text-white' : 'bg-sageSoft text-forest',
                      )}
                      aria-hidden
                    >
                      {userInitials(u)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="truncate text-[15px]">{userDisplayName(u)}</b>
                        <Badge tone={isEmployer ? 'forest' : 'sage'}>{ROLE_LABEL[u.role]}</Badge>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-muted">{u.email}</p>
                      {isEmployer && (u.firstName || u.lastName) ? (
                        <p className="mt-0.5 text-[12.5px] text-muted">
                          Contact : {[u.firstName, u.lastName].filter(Boolean).join(' ')}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {isEmployer ? (
                      <Button
                        variant="outline"
                        className="px-4 py-2.5 text-[13px]"
                        onClick={() => setOffersOf(u)}
                      >
                        Voir ses offres
                      </Button>
                    ) : null}
                    {u.status === 'pending' ? (
                      <Button
                        variant="lime"
                        className="px-4 py-2.5 text-[13px]"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ id: u.id, status: 'active' })}
                      >
                        Activer
                      </Button>
                    ) : null}
                    {u.status !== 'suspended' ? (
                      <Button
                        variant="outline"
                        className="px-4 py-2.5 text-[13px]"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ id: u.id, status: 'suspended' })}
                      >
                        Suspendre
                      </Button>
                    ) : (
                      <Button
                        variant="lime"
                        className="px-4 py-2.5 text-[13px]"
                        disabled={mut.isPending}
                        onClick={() => mut.mutate({ id: u.id, status: 'active' })}
                      >
                        Réactiver
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {offersOf ? <EmployerOffersModal employer={offersOf} onClose={() => setOffersOf(null)} /> : null}
    </div>
  );
}

const WEEKLY_FALLBACK: AdminMetricsSeriesPoint[] = [
  { label: 'Lun', applications: 0, offers: 0 },
  { label: 'Mar', applications: 0, offers: 0 },
  { label: 'Mer', applications: 0, offers: 0 },
  { label: 'Jeu', applications: 0, offers: 0 },
  { label: 'Ven', applications: 0, offers: 0 },
  { label: 'Sam', applications: 0, offers: 0 },
  { label: 'Dim', applications: 0, offers: 0 },
];

function WeeklyActivityChart({ series }: { series: AdminMetricsSeriesPoint[] }) {
  const max = Math.max(...series.flatMap((d) => [d.applications, d.offers]), 1);
  const chartH = 168;

  return (
    <div className="overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-[420px] items-end justify-between gap-2 px-1 pt-2 sm:gap-3">
        {series.map((d) => {
          const appH = Math.max(Math.round((d.applications / max) * chartH), d.applications > 0 ? 8 : 4);
          const offerH = Math.max(Math.round((d.offers / max) * chartH), d.offers > 0 ? 8 : 4);
          const isPeak = d.offers === max || d.applications === max;
          return (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-[168px] items-end gap-1 sm:gap-1.5" title={`${d.label} · ${d.offers} offres · ${d.applications} candidatures`}>
                <div
                  className={cn(
                    'w-3 rounded-t-[7px] transition-all duration-700 ease-brand sm:w-3.5',
                    isPeak ? 'bg-forest' : 'bg-forest/70',
                  )}
                  style={{ height: offerH }}
                />
                <div
                  className="w-3 rounded-t-[7px] bg-sage/80 transition-all duration-700 ease-brand sm:w-3.5"
                  style={{ height: appH }}
                />
              </div>
              <span className={cn('text-[12px] font-semibold', isPeak ? 'text-forest' : 'text-muted')}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AudienceDonut({ candidates, employers }: { candidates: number; employers: number }) {
  const total = Math.max(candidates + employers, 1);
  const candPct = candidates / total;
  const empPct = employers / total;
  const r = 54;
  const c = 2 * Math.PI * r;
  const candLen = candPct * c;
  const empLen = empPct * c;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative grid h-[160px] w-[160px] shrink-0 place-items-center">
        <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden className="-rotate-90">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#F4F5F3" strokeWidth="18" />
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="#8FBC8F"
            strokeWidth="18"
            strokeDasharray={`${candLen} ${c - candLen}`}
            strokeLinecap="round"
            className="transition-all duration-700 ease-brand"
          />
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="#1B4332"
            strokeWidth="18"
            strokeDasharray={`${empLen} ${c - empLen}`}
            strokeDashoffset={-candLen}
            strokeLinecap="round"
            className="transition-all duration-700 ease-brand"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[22px] font-extrabold tracking-[-0.03em] text-ink">{formatNumber(total)}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">Comptes</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-3">
        {[
          { label: 'Demandeurs d’emploi', value: candidates, pct: candPct, color: 'bg-sage' },
          { label: 'Employeurs', value: employers, pct: empPct, color: 'bg-forest' },
        ].map((row) => (
          <li key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <span className={cn('h-2.5 w-2.5 rounded-full', row.color)} aria-hidden />
                {row.label}
              </span>
              <span className="tabular-nums font-bold text-muted">{Math.round(row.pct * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-grey">
              <div
                className={cn('h-full rounded-full transition-all duration-700 ease-brand', row.color)}
                style={{ width: `${Math.max(row.pct * 100, 2)}%` }}
              />
            </div>
            <p className="mt-1 text-[12px] text-muted">{formatNumber(row.value)} comptes</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayBars({
  publishedToday,
  applicationsToday,
  reportsOpen,
}: {
  publishedToday: number;
  applicationsToday: number;
  reportsOpen: number;
}) {
  const rows = [
    { label: 'Offres publiées', value: publishedToday, color: 'bg-forest' },
    { label: 'Candidatures', value: applicationsToday, color: 'bg-sage' },
    { label: 'Signalements', value: reportsOpen, color: 'bg-danger' },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink">{r.label}</span>
            <span className="text-[15px] font-extrabold tabular-nums tracking-[-0.02em]">{formatNumber(r.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-grey">
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-brand', r.color)}
              style={{ width: `${Math.max((r.value / max) * 100, 3)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MetricsPage() {
  const q = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => (await api.get<AdminMetrics>('/admin/metrics')).data,
  });
  const m = q.data;
  const weekly = m?.weeklyActivity?.length ? m.weeklyActivity : WEEKLY_FALLBACK;

  const cards: { label: string; value: number | undefined; border: string; hint: string }[] = [
    { label: 'Offres actives', value: m?.activeOffers, border: 'bg-forest', hint: 'Sur la carte' },
    { label: 'Publiées aujourd’hui', value: m?.publishedToday, border: 'bg-sage', hint: 'Depuis minuit' },
    { label: 'Demandeurs d’emploi', value: m?.candidates, border: 'bg-limeDeep', hint: 'Comptes actifs' },
    { label: 'Employeurs', value: m?.employers, border: 'bg-forestSoft', hint: 'Comptes entreprise' },
    { label: 'Candidatures du jour', value: m?.applicationsToday, border: 'bg-sage', hint: 'Volume journalier' },
    { label: 'Signalements ouverts', value: m?.reportsOpen, border: 'bg-danger', hint: 'À modérer' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Back-office</p>
        <h1 className="mt-2 text-[clamp(26px,4vw,34px)]">Métriques nationales</h1>
        <p className="mt-2 text-[14.5px] text-muted">Vue d’ensemble de l’activité plateforme.</p>
      </header>

      {q.isLoading ? (
        <div className="mt-8 space-y-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[112px] animate-pulse rounded-block border border-line bg-grey" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="h-[320px] animate-pulse rounded-block border border-line bg-grey" />
            <div className="h-[320px] animate-pulse rounded-block border border-line bg-grey" />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div
                key={c.label}
                className="relative overflow-hidden rounded-block border border-line bg-paper p-5 shadow-soft transition duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-card sm:p-6"
              >
                <div className={cn('absolute inset-y-0 left-0 w-[4px] rounded-l-block', c.border)} />
                <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{c.label}</p>
                <p className="mt-2 text-[32px] font-extrabold tracking-[-0.03em]">
                  {typeof c.value === 'number' ? formatNumber(c.value) : '—'}
                </p>
                <p className="mt-1 text-[12px] font-medium text-muted">{c.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
            <section className="surface-card p-5 sm:p-6 md:p-7">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Activité 7 jours</h2>
                  <p className="mt-1 text-[13px] font-medium text-muted">
                    Offres créées et candidatures déposées
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-[12px] font-semibold text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-forest" aria-hidden />
                    Offres
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-sage" aria-hidden />
                    Candidatures
                  </span>
                </div>
              </div>
              <WeeklyActivityChart series={weekly} />
            </section>

            <section className="surface-card p-5 sm:p-6 md:p-7">
              <div className="mb-5">
                <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">Répartition des comptes</h2>
                <p className="mt-1 text-[13px] font-medium text-muted">Demandeurs vs employeurs</p>
              </div>
              <AudienceDonut candidates={m?.candidates ?? 0} employers={m?.employers ?? 0} />
            </section>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <section className="surface-card p-5 sm:p-6 md:p-7">
              <div className="mb-5">
                <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Aujourd’hui</h2>
                <p className="mt-1 text-[13px] font-medium text-muted">Volume journalier comparé</p>
              </div>
              <TodayBars
                publishedToday={m?.publishedToday ?? 0}
                applicationsToday={m?.applicationsToday ?? 0}
                reportsOpen={m?.reportsOpen ?? 0}
              />
            </section>

            <section className="relative overflow-hidden rounded-block bg-forest p-5 text-white shadow-card sm:p-6 md:p-7">
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime/20 blur-2xl"
                aria-hidden
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/55">Synthèse</p>
              <h2 className="mt-2 text-[22px] font-extrabold tracking-[-0.02em]">Plateforme en direct</h2>
              <dl className="mt-6 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-[12px] text-white/55">Offres live</dt>
                  <dd className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">
                    {formatNumber(m?.activeOffers ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-white/55">Candidatures J</dt>
                  <dd className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">
                    {formatNumber(m?.applicationsToday ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-white/55">Comptes</dt>
                  <dd className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">
                    {formatNumber((m?.candidates ?? 0) + (m?.employers ?? 0))}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-white/55">À modérer</dt>
                  <dd className="mt-1 text-[26px] font-extrabold tracking-[-0.03em]">
                    {formatNumber(m?.reportsOpen ?? 0)}
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-[12.5px] leading-relaxed text-white/65">
                Les signalements ouverts apparaissent aussi dans Modération. Les compteurs se rafraîchissent à
                chaque visite.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
