import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Tag';
import { SectorMark } from '@/components/ui/SectorIcon';
import type { Offer } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  published: 'Active',
  draft: 'Brouillon',
  pending: 'En attente',
  unpublished: 'Dépubliée',
  reported: 'Signalée',
};

export function EmployerOffersPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['pro-offers'],
    queryFn: async () => (await api.get<Offer[]>('/pro/offers')).data,
  });
  const unpub = useMutation({
    mutationFn: (id: string) => api.delete(`/offers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pro-offers'] }),
  });

  const offers = q.data ?? [];

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-7 md:py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold tracking-[-0.03em]">
            Vos offres
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted sm:text-[14px]">
            Gérez vos offres géolocalisées et suivez leurs performances.
          </p>
        </div>
        <Link to="/pro/offres/nouvelle" className="btn btn-forest py-2.5 text-[13px]">
          Nouvelle offre
        </Link>
      </div>

      <ul className="mt-5 space-y-2.5 sm:mt-8 sm:space-y-3">
        {offers.map((o) => (
          <li
            key={o.id}
            className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <SectorMark sector={o.sector} size={40} className="rounded-[12px]" />
              <div className="min-w-0">
                <b className="block truncate text-[15px] font-bold sm:text-[16px]">{o.title}</b>
                <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px]">
                  {o.address} · {o.views} vues · {o.applicationsCount} candidature
                  {o.applicationsCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={o.status === 'published' ? 'sage' : 'muted'}>
                {STATUS_LABEL[o.status] ?? o.status}
              </Badge>
              <Link to={`/pro/offres/${o.id}/modifier`} className="btn btn-outline py-2 text-[13px]">
                Modifier
              </Link>
              {o.status === 'published' ? (
                <Button variant="outline" onClick={() => unpub.mutate(o.id)}>
                  Dépublier
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {offers.length === 0 && !q.isLoading ? (
          <li className="surface-card px-4 py-8 text-center">
            <p className="text-[14px] text-muted">
              Vous n'avez pas encore d'offre.{' '}
              <Link to="/pro/offres/nouvelle" className="link-forest">
                Publiez votre première offre
              </Link>
            </p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
