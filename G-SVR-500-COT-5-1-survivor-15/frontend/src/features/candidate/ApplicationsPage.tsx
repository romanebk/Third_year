import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Tag } from '@/components/ui/Tag';
import type { Application } from '@/types';

const LABELS: Record<Application['status'], string> = {
  sent: 'Envoyée',
  viewed: 'Vue',
  interview: 'Entretien',
  accepted: 'Acceptée',
  rejected: 'Refusée',
};

export function ApplicationsPage() {
  const q = useQuery({
    queryKey: ['applications'],
    queryFn: async () => (await api.get<Application[]>('/applications')).data,
  });

  return (
    <div className="px-3 py-4 sm:p-5 md:p-8">
      <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold tracking-[-0.03em]">
        Vos candidatures
      </h1>
      <p className="mt-2 text-[13.5px] text-muted sm:text-[14px]">
        Suivi des offres auxquelles vous avez postulé.
      </p>
      <ul className="mt-5 space-y-2.5 sm:mt-8 sm:space-y-3">
        {(q.data ?? []).map((a) => (
          <li
            key={a.id}
            className="flex flex-col gap-3 rounded-block border border-line bg-paper p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5"
          >
            <div className="min-w-0">
              <b className="block truncate text-[15px] sm:text-[16px]">{a.offerTitle}</b>
              <small className="text-[12.5px] text-muted sm:text-[13px]">
                {a.company} · {formatDate(a.createdAt)}
              </small>
            </div>
            <Tag hot={a.status === 'interview' || a.status === 'accepted'}>{LABELS[a.status]}</Tag>
          </li>
        ))}
        {q.data?.length === 0 ? (
          <p className="rounded-2xl bg-grey px-4 py-8 text-center text-[13.5px] text-muted">
            Rien ici pour l’instant.{' '}
            <Link to="/app/carte" className="link-forest">
              Ouvrir la carte
            </Link>{' '}
            pour postuler ?
          </p>
        ) : null}
      </ul>
    </div>
  );
}
