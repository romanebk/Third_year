import { NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { useSessionStore } from '@/store/session';
import { cn } from '@/lib/cn';

const links = [
  {
    to: '/pro/tableau-de-bord',
    label: 'Tableau',
    full: 'Tableau de bord',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    to: '/pro/offres',
    label: 'Offres',
    full: 'Offres',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/pro/offres/nouvelle',
    label: 'Publier',
    full: 'Nouvelle offre',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/pro/candidatures',
    label: 'Candid.',
    full: 'Candidatures',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
];

export function ProShell() {
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);

  return (
    <div className="h-svh overflow-hidden bg-paper md:h-auto md:min-h-screen">
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-paper md:min-h-screen md:grid md:grid-cols-[240px_1fr]">
        <aside className="hidden flex-col border-r border-line p-5 md:flex">
          <Brand />
          <p className="mt-4 text-[12.5px] text-muted">{user?.companyName}</p>
          {user?.status === 'pending' ? (
            <p className="mt-2 rounded-2xl bg-grey px-3 py-2 text-[12px] font-semibold">
              Activité vérifiée sous 48 h, publication bloquée.
            </p>
          ) : null}
          <nav className="mt-6 flex flex-col gap-1" aria-label="Espace employeur">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[14px] px-4 py-2.5 text-[13.5px] font-semibold text-muted transition-colors',
                    isActive && 'bg-forest text-white',
                  )
                }
              >
                <span className="shrink-0">{l.icon}</span>
                {l.full}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-line pt-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-[11px] font-extrabold text-white">
                {user?.companyName?.[0]?.toUpperCase() ?? 'E'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-bold text-ink">{user?.companyName ?? 'Entreprise'}</p>
                <p className="truncate text-[11px] text-muted">{user?.email ?? ''}</p>
              </div>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:bg-grey hover:text-ink"
              onClick={clear}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Déconnexion
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5 md:hidden">
            <Brand />
            <button
              type="button"
              className="ml-auto rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold"
              onClick={clear}
            >
              Quitter
            </button>
          </header>
          <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-5 md:p-8">
            <Outlet />
          </main>
          <nav
            className="grid shrink-0 grid-cols-5 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
            aria-label="Navigation employeur"
          >
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold text-muted transition-colors',
                    isActive && 'bg-[#F4F8EC] text-ink',
                  )
                }
              >
                <span className="shrink-0">{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
