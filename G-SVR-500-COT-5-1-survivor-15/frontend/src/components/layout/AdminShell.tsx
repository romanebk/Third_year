import { NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';
import { useSessionStore } from '@/store/session';
import { cn } from '@/lib/cn';

const links = [
  {
    to: '/admin/moderation',
    label: 'Modération',
    short: 'Modér.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M9.5 12.5 11 14l3.5-3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/admin/utilisateurs',
    label: 'Comptes',
    short: 'Comptes',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M16.5 14.5c2 .3 3.7 1.5 4.2 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/admin/metriques',
    label: 'Métriques',
    short: 'Métr.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 15v-4M12 15V8M16 15v-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function AdminShell() {
  const user = useSessionStore((s) => s.user);
  const clear = useSessionStore((s) => s.clear);
  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'A';

  return (
    <div className="h-svh overflow-hidden bg-paper font-sans md:h-auto md:min-h-screen">
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-paper md:min-h-screen md:grid md:grid-cols-[240px_1fr]">
        <aside className="hidden flex-col border-r border-line p-5 md:flex">
          <Brand />
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.06em] text-muted">Back-office</p>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Administration">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[14px] px-4 py-2.5 text-[13.5px] font-semibold text-muted transition-colors duration-200 ease-brand',
                    isActive && 'bg-forest text-white',
                  )
                }
              >
                <span className="shrink-0">{l.icon}</span>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto border-t border-line pt-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-[11px] font-extrabold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-bold text-ink">
                  {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin'}
                </p>
                <p className="truncate text-[11px] text-muted">{user?.email ?? ''}</p>
              </div>
            </div>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:bg-grey hover:text-ink"
              onClick={clear}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
          <main className="admin-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 sm:p-5 md:p-8">
            <Outlet />
          </main>
          <nav
            className="grid shrink-0 grid-cols-3 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
            aria-label="Navigation admin"
          >
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-semibold text-muted transition-colors duration-200 ease-brand',
                    isActive && 'bg-sageSoft text-ink',
                  )
                }
              >
                <span className="shrink-0">{l.icon}</span>
                <span className="sm:hidden">{l.short}</span>
                <span className="hidden sm:inline">{l.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
