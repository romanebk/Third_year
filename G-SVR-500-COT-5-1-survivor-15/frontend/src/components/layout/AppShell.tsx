import { NavLink, Outlet, useLocation, matchPath } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { useSessionStore } from '@/store/session';
import { cn } from '@/lib/cn';

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  short?: string;
  beta?: boolean;
  badge?: number;
  icon: ReactNode;
};

const mainLinks: NavItem[] = [
  {
    to: '/app',
    end: true,
    label: 'Accueil',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: '/app/carte',
    label: 'Carte',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M9 4v13M15 6.5V19" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    to: '/app/candidatures',
    label: 'Candidatures',
    short: 'Candid.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    to: '/app/notifications',
    label: 'Notifications',
    short: 'Notifs',
    badge: 2,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/app/profil',
    label: 'Profil',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5.5 19.5c1.6-3.2 3.8-4.8 6.5-4.8s4.9 1.6 6.5 4.8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

/** Ordre mobile : Accueil · Carte · Candidatures · Notifications · Profil */
const mobileLinks: NavItem[] = [
  {
    to: '/app',
    end: true,
    label: 'Accueil',
    icon: mainLinks[0]!.icon,
  },
  {
    to: '/app/carte',
    label: 'Carte',
    icon: mainLinks[1]!.icon,
  },
  {
    to: '/app/candidatures',
    label: 'Candidatures',
    short: 'Candid.',
    icon: mainLinks[2]!.icon,
  },
  {
    to: '/app/notifications',
    label: 'Notifications',
    short: 'Notifs',
    badge: 2,
    icon: mainLinks[3]!.icon,
  },
  {
    to: '/app/profil',
    label: 'Profil',
    icon: mainLinks[4]!.icon,
  },
];

const ITEM_W = 48;

function titleFor(pathname: string): string {
  if (pathname.startsWith('/app/carte')) return 'Carte';
  if (pathname.startsWith('/app/candidatures')) return 'Candidatures';
  if (pathname.startsWith('/app/notifications')) return 'Notifications';
  if (pathname.startsWith('/app/profil')) return 'Profil';
  return 'Tableau de bord';
}

function activeMobileIndex(pathname: string): number {
  const idx = mobileLinks.findIndex((l) =>
    matchPath({ path: l.to, end: Boolean(l.end) }, pathname),
  );
  return idx >= 0 ? idx : 0;
}

/** Pilule flottante fixe, style HOMEBAR, charte ink / lime. */
function MobileHomebar() {
  const { pathname } = useLocation();
  const active = activeMobileIndex(pathname);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Navigation mobile"
    >
      <div
        className="pointer-events-auto relative flex h-[58px] items-center rounded-full bg-ink px-1.5 shadow-live"
        style={{ width: ITEM_W * mobileLinks.length + 12 }}
      >
        <span
          aria-hidden
          className="absolute top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-lime shadow-soft transition-[left] duration-300 ease-brand"
          style={{ left: 6 + active * ITEM_W }}
        />
        {mobileLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            title={l.label}
            aria-label={l.label}
            className={({ isActive }) =>
              cn(
                'relative z-[1] grid h-12 w-12 shrink-0 place-items-center rounded-full text-white/75 transition-colors duration-200',
                isActive && 'text-ink',
              )
            }
          >
            <span className="relative grid place-items-center">
              {l.icon}
              {l.badge ? (
                <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-ink" />
              ) : null}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Item sidebar desktop, icône fixe, label qui apparaît à l’expansion. */
function RailNavItem({ l }: { l: NavItem }) {
  return (
    <NavLink
      to={l.to}
      end={l.end}
      title={l.label}
      className={({ isActive }) =>
        cn(
          'group/item relative flex h-11 items-center gap-3 overflow-hidden rounded-[14px] px-[11px] text-[13.5px] font-medium text-ink/55 transition-colors duration-200 ease-brand hover:bg-grey hover:text-ink',
          isActive && 'bg-forest font-semibold text-white hover:bg-forest hover:text-white',
        )
      }
    >
      <span className="relative grid h-5 w-5 shrink-0 place-items-center">
        {l.icon}
        {l.badge ? (
          <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {l.badge}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap opacity-0 transition-opacity duration-200 ease-brand group-hover/rail:opacity-100 group-focus-within/rail:opacity-100">
        <span className="truncate">{l.label}</span>
        {l.beta ? (
          <span className="shrink-0 rounded-full bg-ink/8 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink/60 [[.bg-forest]_&]:bg-white/20 [[.bg-forest]_&]:text-white">
            Bêta
          </span>
        ) : null}
      </span>
    </NavLink>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className={cn(
        'overflow-hidden px-[11px] text-[10px] font-bold uppercase tracking-[0.08em] text-ink/35',
        'max-h-0 opacity-0 transition-all duration-200 ease-brand',
        'group-hover/rail:mb-1.5 group-hover/rail:max-h-4 group-hover/rail:opacity-100',
        'group-focus-within/rail:mb-1.5 group-focus-within/rail:max-h-4 group-focus-within/rail:opacity-100',
      )}
    >
      {children}
    </p>
  );
}

function SidebarBrand() {
  return (
    <div className="flex h-11 items-center overflow-hidden px-[11px]">
      <Brand
        mark
        size="sm"
        className="group-hover/rail:hidden group-focus-within/rail:hidden"
      />
      <Brand
        size="md"
        className="hidden group-hover/rail:inline-flex group-focus-within/rail:inline-flex"
      />
    </div>
  );
}

function ZoneCta() {
  return (
    <div className="mt-auto px-2.5 pb-3 pt-2">
      <NavLink
        to="/app/carte"
        title="Ouvrir la carte"
        className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-forest text-white shadow-soft transition-all duration-300 ease-brand group-hover/rail:hidden group-focus-within/rail:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="11" r="2.2" fill="currentColor" />
        </svg>
      </NavLink>

      <div className="hidden overflow-hidden rounded-[18px] border border-line bg-grey p-3.5 shadow-soft group-hover/rail:block group-focus-within/rail:block">
        <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-forest text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="11" r="2.2" fill="currentColor" />
          </svg>
        </div>
        <p className="text-[12.5px] font-bold leading-snug text-ink">Offres autour de vous</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
          Ouvrez la carte pour voir le détail d’une offre et postuler.
        </p>
        <NavLink
          to="/app/carte"
          className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-forest px-3 py-2 text-[12px] font-bold text-white transition hover:bg-forestSoft"
        >
          Ouvrir la carte
        </NavLink>
      </div>
    </div>
  );
}

export function AppShell() {
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const { pathname } = useLocation();
  const fillHeight = pathname === '/app/carte' || pathname.startsWith('/app/notifications');
  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'CG';
  const headerSubtitle = pathname.startsWith('/app/notifications')
    ? 'Alertes offres, candidatures et entretiens'
    : 'Offres autour de vous, en temps réel';

  return (
    <div className="relative h-svh overflow-hidden bg-grey">
      <div className="flex h-full overflow-hidden bg-grey">
        <aside
          className={cn(
            'group/rail relative z-20 hidden shrink-0 flex-col overflow-hidden border-r border-line bg-paper text-ink lg:flex',
            'w-[72px] transition-[width] duration-300 ease-brand',
            'hover:w-[248px] focus-within:w-[248px]',
          )}
          aria-label="Navigation principale"
        >
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-line" aria-hidden />

          <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-5">
            <SidebarBrand />
            <span
              className="mr-1 hidden h-7 w-7 shrink-0 place-items-center rounded-full text-ink/35 group-hover/rail:grid group-focus-within/rail:grid"
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M14.5 6 8.5 12l6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          <nav className="mt-3 flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-2.5 pb-2">
            <div>
              <SectionLabel>Menu</SectionLabel>
              <div className="flex flex-col gap-0.5">
                {mainLinks.map((l) => (
                  <RailNavItem key={l.to} l={l} />
                ))}
              </div>
            </div>

          </nav>

          <ZoneCta />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-2 border-b border-line bg-paper px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3.5 md:px-7">
            <Brand className="shrink-0 lg:hidden" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[17px] font-extrabold tracking-[-0.03em] text-ink sm:text-[22px] md:text-[26px]">
                {titleFor(pathname)}
              </h1>
              <p className="mt-0.5 hidden truncate text-[13px] font-medium text-muted sm:block">
                {headerSubtitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span className="hidden text-right text-[13px] md:block">
                <b className="block font-bold text-ink">
                  {user?.firstName} {user?.lastName}
                </b>
                <span className="text-[12px] text-muted">{user?.jobTitle || 'Candidat'}</span>
              </span>
              <span
                className="grid h-8 w-8 place-items-center rounded-full bg-sageSoft text-[11px] font-extrabold text-forest sm:h-10 sm:w-10 sm:text-[13px]"
                aria-hidden
              >
                {initials}
              </span>
              <button
                type="button"
                className="rounded-[12px] border border-line bg-white px-2 py-1.5 text-[11px] font-semibold shadow-soft sm:px-3.5 sm:py-2 sm:text-[12.5px]"
                onClick={clear}
              >
                <span className="sm:hidden">Quitter</span>
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </header>

          <main
            className={cn(
              'relative flex min-h-0 flex-1 flex-col',
              /* réserve pour la homebar flottante */
              'pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0',
              fillHeight ? 'overflow-hidden' : 'overflow-auto',
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>

      <MobileHomebar />
    </div>
  );
}
