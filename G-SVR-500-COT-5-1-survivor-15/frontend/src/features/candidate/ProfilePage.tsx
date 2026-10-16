import { useEffect, useMemo, useState, forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FileDrop } from '@/components/ui/FileDrop';
import { useSessionStore } from '@/store/session';
import { useToastStore } from '@/store/toast';
import { useConsentStore } from '@/store/consent';
import { usePreferencesStore } from '@/store/preferences';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import {
  CONTRACTS,
  SECTORS,
  type Application,
  type ContractType,
  type Sector,
  type User,
} from '@/types';

type TabId = 'personal' | 'prefs' | 'cv' | 'privacy' | 'account';

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  city: z.string().optional(),
  jobTitle: z.string().optional(),
  skills: z.string().optional(),
  mobility: z.string().optional(),
  availableFrom: z.string().optional(),
  profileVisible: z.boolean().optional(),
  alertsConsent: z.boolean().optional(),
  experiences: z.array(
    z.object({
      id: z.string(),
      title: z.string().min(1, 'Intitulé requis'),
      company: z.string().min(1, 'Entreprise requise'),
      start: z.string(),
      end: z.string().optional(),
      description: z.string().optional(),
    }),
  ),
  education: z.array(
    z.object({
      id: z.string(),
      school: z.string().min(1),
      diploma: z.string().min(1),
      year: z.string(),
    }),
  ),
});

type FormValues = z.infer<typeof schema>;

const TABS: { id: TabId; label: string; short: string; icon: ReactNode }[] = [
  {
    id: 'personal',
    label: 'Informations personnelles',
    short: 'Perso',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5.5 19c1.6-3.1 3.8-4.6 6.5-4.6S16.9 15.9 18.5 19"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'prefs',
    label: 'Préférences emploi',
    short: 'Prefs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 7h10M14 7a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0ZM4 17h6M10 17a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0ZM20 17h-4M4 7H2M22 17h-1"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: 'cv',
    label: 'CV & parcours',
    short: 'CV',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'privacy',
    label: 'Confidentialité',
    short: 'Privé',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    id: 'account',
    label: 'Compte',
    short: 'Compte',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 8v4.5M12 16.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

const RADIUS_OPTS = [
  { km: 0.6, label: '600 m' },
  { km: 1, label: '1 km' },
  { km: 2, label: '2 km' },
  { km: 5, label: '5 km' },
];

const SoftField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    error?: string;
    trailing?: ReactNode;
  }
>(function SoftField({ id, label, error, className, trailing, ...props }, ref) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="mb-1.5 block text-[13px] font-semibold text-[#4A524C]" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full max-w-full rounded-[14px] border border-line bg-white px-3.5 py-3 text-[14px] text-ink outline-none transition sm:px-4 sm:py-3.5 sm:text-[14.5px]',
            'placeholder:text-muted/70 focus:border-forest focus:ring-2 focus:ring-forest/20',
            trailing && 'sm:pr-28',
            error && 'border-danger ring-2 ring-danger/15',
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {trailing ? (
          <span className="mt-2 inline-flex sm:pointer-events-none sm:absolute sm:right-3 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2">
            {trailing}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-[12.5px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

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
        'rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition',
        active ? 'bg-forest text-white' : 'bg-grey text-ink hover:bg-line',
      )}
    >
      {children}
    </button>
  );
}

export function ProfilePage() {
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const clear = useSessionStore((s) => s.clear);
  const push = useToastStore((s) => s.push);
  const geo = useConsentStore((s) => s.geo);
  const setGeo = useConsentStore((s) => s.setGeo);
  const prefs = usePreferencesStore();
  const [params] = useSearchParams();
  const initialTab = (params.get('tab') as TabId | null) ?? 'personal';
  const [tab, setTab] = useState<TabId>(
    ['personal', 'prefs', 'cv', 'privacy', 'account'].includes(initialTab)
      ? initialTab
      : 'personal',
  );
  const [cv, setCv] = useState<File | null>(null);

  const appsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: async () => (await api.get<Application[]>('/applications')).data,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      city: user?.city ?? '',
      jobTitle: user?.jobTitle ?? '',
      skills: (user?.skills ?? []).join(', '),
      mobility: user?.mobility ?? '',
      availableFrom: user?.availableFrom ?? '',
      profileVisible: user?.profileVisible ?? true,
      alertsConsent: user?.alertsConsent ?? true,
      experiences: user?.experiences ?? [],
      education: user?.education ?? [],
    },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phone: user.phone ?? '',
      city: user.city ?? '',
      jobTitle: user.jobTitle ?? '',
      skills: (user.skills ?? []).join(', '),
      mobility: user.mobility ?? '',
      availableFrom: user.availableFrom ?? '',
      profileVisible: user.profileVisible ?? true,
      alertsConsent: user.alertsConsent ?? true,
      experiences: user.experiences ?? [],
      education: user.education ?? [],
    });
  }, [user, form]);

  const exp = useFieldArray({ control: form.control, name: 'experiences' });
  const edu = useFieldArray({ control: form.control, name: 'education' });

  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'CG';

  const strength = useMemo(() => {
    let s = 20;
    if (user?.firstName && user?.lastName) s += 10;
    if (user?.phone) s += 10;
    if (user?.jobTitle) s += 10;
    if ((user?.skills?.length ?? 0) > 0) s += 15;
    if ((user?.experiences?.length ?? 0) > 0) s += 15;
    if (user?.cv) s += 15;
    if (user?.profileVisible) s += 5;
    return Math.min(100, s);
  }, [user]);

  const apps = appsQuery.data ?? [];
  const interviews = apps.filter((a) => a.status === 'interview' || a.status === 'accepted').length;

  const discard = () => {
    form.reset();
    push('Modifications annulées', 'info');
  };

  const onSubmit = form.handleSubmit(async (v) => {
    const prev = user;
    const patch: Partial<User> = {
      firstName: v.firstName,
      lastName: v.lastName,
      phone: v.phone,
      city: v.city,
      jobTitle: v.jobTitle,
      skills: v.skills?.split(',').map((s) => s.trim()).filter(Boolean),
      mobility: v.mobility,
      availableFrom: v.availableFrom,
      profileVisible: v.profileVisible,
      alertsConsent: v.alertsConsent,
      experiences: v.experiences,
      education: v.education,
      contracts: prefs.contracts.length ? prefs.contracts : user?.contracts,
      defaultRadiusKm: prefs.radiusKm,
    };
    if (user) setUser({ ...user, ...patch });
    push('Profil enregistré', 'success');
    try {
      const { data } = await api.patch<User>('/me/profile', patch);
      setUser(data);
      if (cv) {
        const fd = new FormData();
        fd.append('file', cv);
        await api.post('/me/cv', fd);
        setCv(null);
      }
    } catch {
      if (prev) setUser(prev);
      push('La sauvegarde a échoué, vos modifications ont été rétablies.', 'danger');
    }
  });

  return (
    <div className="w-full min-w-0 overflow-x-hidden px-3 pb-4 pt-3 sm:px-5 sm:pb-6 sm:pt-5 md:px-7 md:py-6">
      <div className="flex w-full flex-col gap-3 lg:grid lg:grid-cols-[minmax(240px,1fr)_min(940px,100%)] lg:items-start lg:gap-5">
        {/* Identity + desktop nav */}
        <aside className="surface-card shrink-0 p-4 sm:p-5 lg:sticky lg:top-3 lg:p-6">
          <div className="flex items-center gap-3.5 text-left sm:gap-4 lg:flex-col lg:items-center lg:text-center">
            <div className="relative shrink-0">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-sageSoft text-[20px] font-extrabold text-forest shadow-soft sm:h-16 sm:w-16 sm:text-[22px] lg:h-[96px] lg:w-[96px] lg:text-[32px]">
                {initials}
              </span>
              <span
                className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-forest text-white shadow-md sm:h-7 sm:w-7 lg:bottom-1 lg:right-1 lg:h-8 lg:w-8"
                aria-hidden
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 17.25V20h2.75L18.8 8.0a1.5 1.5 0 0 0 0-2.12L17.1 4.2a1.5 1.5 0 0 0-2.12 0L4 15.18V17.25Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div className="min-w-0 flex-1 lg:mt-3">
              <p className="truncate text-[17px] font-extrabold tracking-[-0.03em] text-ink sm:text-[18px] lg:text-[20px]">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-muted sm:text-[13px]">
                {user?.jobTitle || 'Candidat GéoEmploi'}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">{user?.city || 'Paris'}</p>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-1 rounded-2xl bg-[#F6F7F5] p-2 sm:mt-4 sm:gap-1.5 sm:p-2.5 lg:mt-5 lg:p-3">
            <div className="min-w-0 text-center">
              <p className="text-[15px] font-extrabold text-ink sm:text-[16px] lg:text-[18px]">
                {formatNumber(apps.length)}
              </p>
              <p className="whitespace-nowrap text-[9.5px] font-medium text-muted sm:text-[10px]">Candid.</p>
            </div>
            <div className="min-w-0 text-center">
              <p className="text-[15px] font-extrabold text-ink sm:text-[16px] lg:text-[18px]">
                {formatNumber(interviews)}
              </p>
              <p className="whitespace-nowrap text-[9.5px] font-medium text-muted sm:text-[10px]">Entret.</p>
            </div>
            <div className="min-w-0 text-center">
              <p className="text-[15px] font-extrabold text-ink sm:text-[16px] lg:text-[18px]">{strength}%</p>
              <p className="whitespace-nowrap text-[9.5px] font-medium text-muted sm:text-[10px]">Profil</p>
            </div>
          </div>

          <nav className="mt-5 hidden flex-col gap-1 lg:flex" aria-label="Sections profil">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[13px] font-semibold leading-[1.2] transition',
                  tab === t.id ? 'bg-sageSoft text-ink' : 'text-muted hover:bg-grey hover:text-ink',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 flex-none place-items-center rounded-[12px]',
                    tab === t.id ? 'bg-forest text-white' : 'bg-grey text-muted',
                  )}
                >
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile tabs, sticky */}
        <div className="sticky top-0 z-[5] -mx-3 border-b border-line/80 bg-grey/95 px-3 py-2 backdrop-blur-md lg:hidden">
          <nav
            className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Sections profil"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition',
                  tab === t.id ? 'bg-forest text-white' : 'bg-paper text-muted ring-1 ring-line',
                )}
              >
                <span className="grid h-5 w-5 place-items-center [&_svg]:h-3.5 [&_svg]:w-3.5">{t.icon}</span>
                {t.short}
              </button>
            ))}
          </nav>
        </div>

        {/* Main panel */}
        <section className="min-w-0 overflow-hidden rounded-block border border-line/80 bg-paper p-4 shadow-soft sm:p-6 md:p-8">
          <form onSubmit={onSubmit} className="min-w-0">
            {tab === 'personal' ? (
              <div className="min-w-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-[clamp(20px,5.5vw,34px)] font-extrabold tracking-[-0.03em]">
                      Informations personnelles
                    </h1>
                    <p className="mt-1.5 max-w-[52ch] text-[13px] font-medium leading-relaxed text-muted sm:mt-2 sm:text-[14px]">
                      Ces informations apparaissent sur votre profil candidat et aident les
                      employeurs à vous retrouver.
                    </p>
                  </div>
                  <div className="w-fit rounded-full bg-sageSoft px-3 py-1.5 text-[12px] font-bold text-forest sm:px-3.5 sm:text-[12.5px]">
                    Profil rempli à {strength}%
                  </div>
                </div>

                <div className="mt-5 grid gap-3.5 sm:mt-7 sm:grid-cols-2 sm:gap-4">
                  <SoftField
                    id="firstName"
                    label="Prénom"
                    error={form.formState.errors.firstName?.message}
                    {...form.register('firstName')}
                  />
                  <SoftField
                    id="lastName"
                    label="Nom"
                    error={form.formState.errors.lastName?.message}
                    {...form.register('lastName')}
                  />
                  <SoftField
                    id="email"
                    label="Email"
                    className="sm:col-span-2"
                    value={user?.email ?? ''}
                    readOnly
                    trailing={
                      <span className="inline-flex items-center gap-1 rounded-full bg-sageSoft px-2.5 py-1 text-[11.5px] font-bold text-forest">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="m5 12 5 5L19 7"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Vérifié
                      </span>
                    }
                  />
                  <SoftField id="phone" label="Téléphone" {...form.register('phone')} />
                  <SoftField
                    id="availableFrom"
                    label="Disponible à partir du"
                    type="date"
                    {...form.register('availableFrom')}
                  />
                  <SoftField id="jobTitle" label="Métier recherché" {...form.register('jobTitle')} />
                  <SoftField id="city" label="Ville / quartier" {...form.register('city')} />
                  <SoftField
                    id="mobility"
                    label="Mobilité"
                    className="sm:col-span-2"
                    placeholder="À pied, vélo, transports…"
                    {...form.register('mobility')}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'prefs' ? (
              <div className="min-w-0">
                <h1 className="text-[clamp(20px,5.5vw,32px)] font-extrabold tracking-[-0.03em]">
                  Préférences emploi
                </h1>
                <p className="mt-1.5 max-w-[52ch] text-[13px] text-muted sm:text-[13.5px]">
                  Affinez la carte et les suggestions pour ne voir que les offres qui vous
                  correspondent.
                </p>

                <div className="mt-5 space-y-5 sm:mt-7 sm:space-y-6">
                  <div>
                    <p className="mb-2.5 text-[13px] font-semibold text-[#4A524C]">Secteurs</p>
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
                    <p className="mb-2.5 text-[13px] font-semibold text-[#4A524C]">Types de contrat</p>
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
                  <div>
                    <p className="mb-2.5 text-[13px] font-semibold text-[#4A524C]">Rayon de recherche</p>
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
                    <PrefChip
                      active={prefs.onlyNew}
                      onClick={() => prefs.setOnlyNew(!prefs.onlyNew)}
                    >
                      Nouvelles offres uniquement
                    </PrefChip>
                    <PrefChip
                      active={prefs.walkOnly}
                      onClick={() => prefs.setWalkOnly(!prefs.walkOnly)}
                    >
                      À pied (&lt; 600 m)
                    </PrefChip>
                  </div>
                  <div className="rounded-2xl bg-[#F6F7F5] p-4 text-[13.5px] text-muted">
                    Astuce : ces filtres s’appliquent aussi sur votre{' '}
                    <Link to="/app" className="font-semibold text-ink underline underline-offset-2">
                      tableau de bord
                    </Link>{' '}
                    et la carte.
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'cv' ? (
              <div className="min-w-0">
                <h1 className="text-[clamp(20px,5.5vw,32px)] font-extrabold tracking-[-0.03em]">
                  CV & parcours
                </h1>
                <p className="mt-1.5 max-w-[52ch] text-[13px] text-muted sm:text-[13.5px]">
                  Votre CV et votre expérience sont joints lorsque vous postulez.
                </p>

                <div className="mt-5 space-y-5 sm:mt-7 sm:space-y-6">
                  <SoftField
                    id="skills"
                    label="Compétences (séparées par des virgules)"
                    placeholder="Service, Anglais, Encaissement…"
                    {...form.register('skills')}
                  />

                  <FileDrop label="Remplacer le CV (PDF)" value={cv} onChange={setCv} />
                  <p className="text-[13px] text-muted">
                    CV actuel : <b className="text-ink">{user?.cv?.name ?? 'aucun fichier'}</b>
                  </p>

                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-[16px] font-extrabold sm:text-[17px]">Expériences</h2>
                      <button
                        type="button"
                        className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold sm:px-3.5 sm:py-2 sm:text-[12.5px]"
                        onClick={() =>
                          exp.append({
                            id: `e-${Date.now()}`,
                            title: '',
                            company: '',
                            start: '',
                            end: '',
                            description: '',
                          })
                        }
                      >
                        + Ajouter
                      </button>
                    </div>
                    <div className="space-y-3">
                      {exp.fields.map((f, i) => (
                        <div key={f.id} className="min-w-0 overflow-hidden rounded-2xl bg-[#F6F7F5] p-3.5 sm:p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <SoftField
                              id={`exp-t-${i}`}
                              label="Intitulé"
                              {...form.register(`experiences.${i}.title`)}
                            />
                            <SoftField
                              id={`exp-c-${i}`}
                              label="Entreprise"
                              {...form.register(`experiences.${i}.company`)}
                            />
                            <SoftField
                              id={`exp-s-${i}`}
                              label="Début"
                              type="month"
                              {...form.register(`experiences.${i}.start`)}
                            />
                            <SoftField
                              id={`exp-e-${i}`}
                              label="Fin"
                              type="month"
                              {...form.register(`experiences.${i}.end`)}
                            />
                          </div>
                          <button
                            type="button"
                            className="mt-3 text-[12.5px] font-semibold text-danger"
                            onClick={() => exp.remove(i)}
                          >
                            Supprimer
                          </button>
                        </div>
                      ))}
                      {!exp.fields.length ? (
                        <p className="rounded-2xl bg-[#F6F7F5] px-4 py-5 text-center text-[13.5px] text-muted">
                          Rien ici pour l’instant. Ajoutez votre dernier poste ?
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="text-[17px] font-extrabold">Formations</h2>
                      <button
                        type="button"
                        className="rounded-full border border-line px-3.5 py-2 text-[12.5px] font-semibold"
                        onClick={() =>
                          edu.append({ id: `ed-${Date.now()}`, school: '', diploma: '', year: '' })
                        }
                      >
                        + Ajouter
                      </button>
                    </div>
                    <div className="space-y-3">
                      {edu.fields.map((f, i) => (
                        <div key={f.id} className="rounded-2xl bg-[#F6F7F5] p-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <SoftField
                              id={`ed-s-${i}`}
                              label="École"
                              {...form.register(`education.${i}.school`)}
                            />
                            <SoftField
                              id={`ed-d-${i}`}
                              label="Diplôme"
                              {...form.register(`education.${i}.diploma`)}
                            />
                            <SoftField
                              id={`ed-y-${i}`}
                              label="Année"
                              {...form.register(`education.${i}.year`)}
                            />
                          </div>
                          <button
                            type="button"
                            className="mt-3 text-[12.5px] font-semibold text-danger"
                            onClick={() => edu.remove(i)}
                          >
                            Supprimer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'privacy' ? (
              <div className="min-w-0">
                <h1 className="text-[clamp(20px,5.5vw,32px)] font-extrabold tracking-[-0.03em]">
                  Confidentialité
                </h1>
                <p className="mt-1.5 max-w-[52ch] text-[13.5px] text-muted">
                  Contrôlez ce que les employeurs voient et comment votre position est utilisée.
                </p>

                <div className="mt-7 space-y-4">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#F6F7F5] p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-forest"
                      {...form.register('profileVisible')}
                    />
                    <span>
                      <b className="block text-[14.5px]">Profil visible par les employeurs</b>
                      <span className="text-[13px] text-muted">
                        Ils peuvent consulter votre CV et vos compétences après une candidature.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#F6F7F5] p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-forest"
                      {...form.register('alertsConsent')}
                    />
                    <span>
                      <b className="block text-[14.5px]">Alertes nouvelles offres</b>
                      <span className="text-[13px] text-muted">
                        Recevoir une notification lorsqu’une offre apparaît dans votre rayon.
                      </span>
                    </span>
                  </label>

                  <div className="rounded-2xl border border-line p-5">
                    <h2 className="text-[16px] font-extrabold">Localisation</h2>
                    <p className="mt-2 text-[13.5px] text-muted">
                      Consentement actuel :{' '}
                      <b className="text-ink">
                        {geo === 'granted' ? 'accepté' : geo === 'denied' ? 'refusé' : 'non renseigné'}
                      </b>
                      . Aucun historique de déplacement n’est conservé.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-lime py-2.5 text-[13px]"
                        onClick={() => setGeo('granted')}
                      >
                        Autoriser
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline py-2.5 text-[13px]"
                        onClick={() => setGeo('denied')}
                      >
                        Refuser
                      </button>
                      <Link
                        to="/mentions/donnees"
                        className="btn btn-white py-2.5 text-[13px] ring-1 ring-line"
                      >
                        Politique données
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'account' ? (
              <div className="min-w-0">
                <h1 className="text-[clamp(20px,5.5vw,32px)] font-extrabold tracking-[-0.03em]">
                  Compte
                </h1>
                <p className="mt-1.5 max-w-[52ch] text-[13.5px] text-muted">
                  Identifiants et sécurité de votre compte GéoEmploi.
                </p>

                <div className="mt-7 space-y-4">
                  <div className="rounded-2xl bg-[#F6F7F5] p-5">
                    <p className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted">
                      Email de connexion
                    </p>
                    <p className="mt-1 text-[16px] font-bold">{user?.email}</p>
                  </div>
                  <div className="rounded-2xl border border-line p-5">
                    <h2 className="text-[16px] font-extrabold">Mot de passe</h2>
                    <p className="mt-2 text-[13.5px] text-muted">
                      Pour changer votre mot de passe, utilisez le flux de réinitialisation
                      sécurisé.
                    </p>
                    <Link
                      to="/mot-de-passe-oublie"
                      className="btn btn-outline mt-4 py-2.5 text-[13px]"
                    >
                      Réinitialiser le mot de passe
                    </Link>
                  </div>
                  <div className="rounded-2xl border border-danger/20 bg-[#FDF5F3] p-5">
                    <h2 className="text-[16px] font-extrabold text-danger">Déconnexion</h2>
                    <p className="mt-2 text-[13.5px] text-muted">
                      Vous pourrez vous reconnecter à tout moment avec votre email.
                    </p>
                    <button
                      type="button"
                      className="mt-4 rounded-full bg-danger px-5 py-2.5 text-[13px] font-semibold text-white"
                      onClick={clear}
                    >
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab !== 'account' ? (
              <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-line pt-5 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3 sm:pt-6">
                <button
                  type="button"
                  onClick={discard}
                  className="w-full rounded-[14px] border-2 border-forest/20 px-6 py-3 text-[14px] font-semibold text-forest transition hover:border-forest sm:w-auto"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full rounded-[14px] bg-forest px-6 py-3 text-[14px] font-semibold text-white shadow-soft transition hover:bg-forestSoft disabled:opacity-60 sm:w-auto"
                >
                  {form.formState.isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
