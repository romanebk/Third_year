import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Badge, type BadgeTone } from '@/components/ui/Tag';
import { formatDate } from '@/lib/format';
import type { Application, ApplicationStatus } from '@/types';

const LABELS: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  sent: { label: 'Envoyée', tone: 'muted' },
  viewed: { label: 'Vue', tone: 'sage' },
  interview: { label: 'Entretien', tone: 'sage' },
  accepted: { label: 'Acceptée', tone: 'forest' },
  rejected: { label: 'Refusée', tone: 'danger' },
};

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'sent', label: 'Envoyée' },
  { value: 'viewed', label: 'Vue' },
  { value: 'interview', label: 'Entretien' },
  { value: 'accepted', label: 'Acceptée' },
  { value: 'rejected', label: 'Refusée' },
];

export function EmployerApplicationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['pro-applications'],
    queryFn: async () => (await api.get<Application[]>('/pro/applications')).data,
  });
  const mut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      api.patch(`/pro/applications/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pro-applications'] }),
  });

  const apps = q.data ?? [];

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-7 md:py-7">
      <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold tracking-[-0.03em]">
        Candidatures reçues
      </h1>
      <p className="mt-1.5 text-[13.5px] text-muted sm:text-[14px]">
        Gérez les candidatures reçues sur vos offres et modifiez leur statut.
      </p>

      <ul className="mt-5 space-y-2.5 sm:mt-8 sm:space-y-3">
        {apps.map((a) => {
          const st = LABELS[a.status];
          return (
            <li
              key={a.id}
              className="surface-card flex flex-col gap-3 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sageSoft text-[13px] font-extrabold text-forest">
                    {a.candidateName?.[0] ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate text-[15px] font-bold sm:text-[16px]">
                      {a.candidateName}
                    </b>
                    <p className="text-[12.5px] text-muted sm:text-[13px]">
                      {a.offerTitle} · {a.candidateEmail}
                      {a.createdAt ? ` · ${formatDate(a.createdAt)}` : ''}
                    </p>
                  </div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>

              {a.message ? (
                <p className="rounded-[12px] bg-grey/60 px-3.5 py-2.5 text-[13.5px] text-ink">
                  {a.message}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor={`st-${a.id}`}
                  className="text-[12px] font-semibold text-muted"
                >
                  Changer le statut :
                </label>
                <select
                  id={`st-${a.id}`}
                  value={a.status}
                  onChange={(e) =>
                    mut.mutate({ id: a.id, status: e.target.value as ApplicationStatus })
                  }
                  className="field-input max-w-[200px] py-2 text-[13px]"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
        {apps.length === 0 && !q.isLoading ? (
          <li className="surface-card px-4 py-8 text-center">
            <p className="text-[14px] text-muted">
              Aucune candidature reçue pour l'instant.{' '}
              <Link to="/pro/offres" className="link-forest">
                Vérifiez vos offres
              </Link>
            </p>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
