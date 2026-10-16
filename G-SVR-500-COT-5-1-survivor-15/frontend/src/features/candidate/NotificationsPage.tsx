import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Tag';
import { cn } from '@/lib/cn';

/** Notification réelle (backend/prisma, table Notification). */
interface ApiNotification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: string;
  createdAt: string;
}

type NotifKind = 'offer' | 'application' | 'interview' | 'system';

type NotificationItem = {
  id: string;
  title: string;
  highlight?: string;
  body?: string;
  time: string;
  timeTone?: 'danger' | 'muted' | 'sage';
  kind: NotifKind;
  unread: boolean;
  employer: { name: string; initials: string; hue?: string };
  href?: string;
};

type SectionId = 'today' | 'yesterday' | 'earlier';

const KIND_LABEL: Record<NotifKind, string> = {
  offer: 'Offre',
  application: 'Candidature',
  interview: 'Entretien',
  system: 'Compte',
};

const KIND_ICON: Record<NotifKind, ReactNode> = {
  offer: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4 3 6.5v13L9 17l6 2.5L21 17V4l-6 2.5L9 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  ),
  application: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 7h8M8 12h8M8 17h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  interview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  system: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v5M12 16.5h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
};

// Type réel (Notification.type, backend) -> présentation. "interview" n'a pas
// d'équivalent backend dédié (une seule notification "application_status" pour
// tout changement de statut, y compris passage en entretien) : repliée sur "application".
const TYPE_TO_KIND: Record<string, NotifKind> = {
  application_received: 'application',
  application_status: 'application',
  alert: 'offer',
};
const TYPE_TO_HREF: Record<string, string> = {
  application_received: '/app/candidatures',
  application_status: '/app/candidatures',
  alert: '/app/carte',
};

/** "Il y a 12 min" / "Aujourd'hui, 14:05" / "Hier, 18:40" / "Il y a 3 j". */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Il y a ${Math.max(diffMin, 1)} min`;
  const diffH = Math.floor(diffMin / 60);
  const hhmm = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return diffH < 24 ? `Il y a ${diffH} h` : `Aujourd’hui, ${hhmm}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Hier, ${hhmm}`;
  const diffDays = Math.floor(diffMs / 86400000);
  return `Il y a ${diffDays} j`;
}

/** Pas d'information employeur dans le modèle Notification actuel (backend) :
 * avatar générique GéoEmploi plutôt qu'une donnée inventée. */
function mapNotification(n: ApiNotification): NotificationItem {
  return {
    id: n.id,
    title: n.title,
    body: n.message,
    time: formatRelativeTime(n.createdAt),
    timeTone: n.read ? 'muted' : 'sage',
    kind: TYPE_TO_KIND[n.type] ?? 'system',
    unread: !n.read,
    employer: { name: 'GéoEmploi', initials: 'GE', hue: '#1B4332' },
    href: TYPE_TO_HREF[n.type] ?? '/app',
  };
}

const SECTION_META: Record<SectionId, { label: string; icon: ReactNode }> = {
  today: {
    label: 'Aujourd’hui',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  yesterday: {
    label: 'Hier',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 8v4.5l3 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  earlier: {
    label: 'Plus tôt',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
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
};

/** Regroupe par jour réel (createdAt), pas par liste d'identifiants figée. */
function sectionForDate(iso: string): SectionId {
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'yesterday';
  return 'earlier';
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('shrink-0 text-muted transition-transform duration-200 ease-brand', open && 'rotate-0', !open && '-rotate-90')}
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimeChip({ label, tone }: { label: string; tone?: NotificationItem['timeTone'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
        tone === 'danger' && 'bg-[#F8E8E5] text-danger',
        tone === 'sage' && 'bg-sageSoft text-forest',
        (!tone || tone === 'muted') && 'bg-[#F0F1EF] text-muted',
      )}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

function KindChip({ kind }: { kind: NotifKind }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink">
      <span className="text-forest">{KIND_ICON[kind]}</span>
      {KIND_LABEL[kind]}
    </span>
  );
}

function EmployerAvatar({ name, initials, hue }: NotificationItem['employer']) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white ring-2 ring-white sm:h-10 sm:w-10 sm:text-[12px]"
      style={{ backgroundColor: hue ?? '#1B4332' }}
      title={name}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const content = (
    <>
      <span className="relative mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center sm:mt-2">
        <span
          className={cn(
            'h-[18px] w-[18px] rounded-full border-2',
            item.unread ? 'border-forest bg-sageSoft' : 'border-line bg-white',
          )}
          aria-hidden
        />
        {item.unread ? (
          <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-forest" aria-hidden />
        ) : null}
      </span>

      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em] text-ink sm:text-[15px]">
          {item.title}{' '}
          {item.highlight ? <span className="font-bold text-forest">{item.highlight}</span> : null}
        </p>
        {item.body ? (
          <p className="mt-0.5 truncate text-[13px] text-muted sm:text-[13.5px]">{item.body}</p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <TimeChip label={item.time} tone={item.timeTone} />
          <KindChip kind={item.kind} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] font-semibold text-ink">
            <span
              className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-extrabold text-white"
              style={{ backgroundColor: item.employer.hue ?? '#1B4332' }}
              aria-hidden
            >
              {item.employer.initials.slice(0, 1)}
            </span>
            {item.employer.name}
          </span>
        </div>
      </div>

      <EmployerAvatar {...item.employer} />
    </>
  );

  const className = cn(
    'flex w-full items-start gap-3 px-4 py-4 text-left transition-colors duration-150 ease-brand sm:gap-3.5 sm:px-6 sm:py-[18px]',
    item.unread ? 'bg-sageSoft/35 hover:bg-sageSoft/55' : 'bg-paper hover:bg-grey/70',
  );

  if (item.href) {
    return (
      <Link to={item.href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function SectionBlock({
  id,
  open,
  onToggle,
  items,
}: {
  id: SectionId;
  open: boolean;
  onToggle: () => void;
  items: NotificationItem[];
}) {
  const meta = SECTION_META[id];
  const unread = items.filter((i) => i.unread).length;

  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="sticky top-0 z-[2] flex w-full items-center gap-2.5 border-b border-line/80 bg-paper/95 px-4 py-3 backdrop-blur-md sm:px-6"
        aria-expanded={open}
      >
        <Chevron open={open} />
        <span className="text-muted">{meta.icon}</span>
        <span className="text-[14px] font-bold tracking-[-0.01em] text-ink sm:text-[15px]">
          {meta.label}
        </span>
        <Badge tone="sage" className="ml-0.5 min-w-[1.4rem] justify-center px-2 py-0.5 text-[11px]">
          {items.length}
        </Badge>
        {unread > 0 ? (
          <span className="ml-auto text-[12px] font-semibold text-forest">
            {unread} non lu{unread > 1 ? 's' : ''}
          </span>
        ) : (
          <span className="ml-auto text-[12px] font-medium text-muted">Tout lu</span>
        )}
      </button>

      {open ? (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <NotificationRow item={item} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    today: true,
    yesterday: true,
    earlier: true,
  });

  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<ApiNotification[]>('/notifications')).data,
  });
  const readAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = useMemo(() => (q.data ?? []).map(mapNotification), [q.data]);
  const unreadTotal = items.filter((i) => i.unread).length;

  const sections = (Object.keys(SECTION_META) as SectionId[]).map((id) => ({
    id,
    items: (q.data ?? [])
      .filter((n) => sectionForDate(n.createdAt) === id)
      .map(mapNotification),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-6">
        <p className="min-w-0 flex-1 text-[13px] text-muted sm:text-[13.5px]">
          {unreadTotal > 0 ? (
            <>
              <span className="font-bold text-forest">{unreadTotal}</span> nouvelle
              {unreadTotal > 1 ? 's' : ''} · rayon & suivi candidatures
            </>
          ) : (
            'Aucune nouvelle alerte'
          )}
        </p>
        <Link
          to="/app/profil?tab=privacy"
          className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:border-forest hover:text-forest"
        >
          Gérer les alertes
        </Link>
        <button
          type="button"
          className="rounded-full bg-forest px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-forestSoft disabled:cursor-not-allowed disabled:opacity-50"
          disabled={unreadTotal === 0 || readAll.isPending}
          onClick={() => readAll.mutate()}
        >
          Tout marquer lu
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {sections.map(({ id, items }) => (
          <SectionBlock
            key={id}
            id={id}
            items={items}
            open={open[id]}
            onToggle={() => setOpen((s) => ({ ...s, [id]: !s[id] }))}
          />
        ))}

        <p className="px-4 py-8 text-center text-[12.5px] text-muted sm:px-6">
          Fin des notifications · préférences dans{' '}
          <Link to="/app/profil?tab=privacy" className="link-forest">
            Profil
          </Link>
        </p>
      </div>
    </div>
  );
}
