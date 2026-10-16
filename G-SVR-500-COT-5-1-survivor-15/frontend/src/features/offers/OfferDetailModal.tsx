import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOffer } from '@/hooks/useOffers';
import { AuthWall } from '@/components/ui/AuthWall';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select, TextArea } from '@/components/ui/Input';
import { useSessionStore } from '@/store/session';
import { formatSalary, formatDate } from '@/lib/format';
import { api } from '@/lib/api';
import { useToastStore } from '@/store/toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Offer } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';

const reportSchema = z.object({
  reason: z.string().min(1, 'Choisissez un motif'),
  comment: z.string().optional(),
});

export function OfferDetailModal({
  offerId,
  onClose,
  onCatch,
}: {
  offerId: string;
  onClose: () => void;
  onCatch?: (offer: Offer) => void;
}) {
  const q = useOffer(offerId);
  const user = useSessionStore((s) => s.user);
  const views = useSessionStore((s) => s.guestViews);
  const bump = useSessionStore((s) => s.bumpGuestView);
  const [walled, setWalled] = useState(false);
  const [report, setReport] = useState(false);
  const [counted, setCounted] = useState(false);

  useEffect(() => {
    if (!user && q.data && !counted) {
      const n = bump();
      if (n > 3) setWalled(true);
      setCounted(true);
    }
  }, [bump, counted, q.data, user]);

  const offer = q.data;
  const salary = offer
    ? formatSalary(offer.salaryMin, offer.salaryMax, offer.salaryKind)
    : null;
  const blur = !user && (walled || views >= 3);

  return (
    <>
      <Modal open title={offer ? offer.title : 'Offre'} onClose={onClose}>
        {q.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}
        {q.isError || (!q.isLoading && !offer) ? (
          <p className="text-[14.5px] text-muted">
            On n’a pas trouvé cette offre. Réessayez depuis la carte ?
          </p>
        ) : null}
        {offer ? (
          <div className="relative">
            <div className={blur ? 'select-none blur-sm' : ''}>
              <p className="text-[13px] font-bold text-muted">{offer.company}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {offer.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
                {salary ? <Tag>{salary}</Tag> : null}
                {offer.experienceLevel ? <Tag>{offer.experienceLevel}</Tag> : null}
              </div>
              {offer.requiredSkills?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {offer.requiredSkills.map((s) => (
                    <Tag key={s}>{s}</Tag>
                  ))}
                </div>
              ) : null}
              <p className="mt-5 text-[15px] leading-relaxed text-[#4A4F4B]">{offer.description}</p>
              <p className="mt-3 text-[14px] text-muted">{offer.address}</p>
              <p className="mt-1 text-[13px] text-muted">
                Publiée le {formatDate(offer.createdAt)} · Expire le {formatDate(offer.endsAt)}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {user?.role === 'candidate' ? (
                  <Button
                    variant="lime"
                    onClick={() => {
                      onCatch?.(offer);
                      onClose();
                    }}
                  >
                    Postuler
                  </Button>
                ) : (
                  <Link to="/inscription" className="btn btn-lime">
                    Créer un compte pour postuler
                  </Link>
                )}
                {user ? (
                  <Button variant="outline" onClick={() => setReport(true)}>
                    Signaler
                  </Button>
                ) : null}
              </div>
            </div>
            {blur ? (
              <div className="relative mt-4 min-h-[160px]">
                <AuthWall title="Trois fiches lues, inscrivez-vous pour continuer" />
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
      {offer ? (
        <ReportModal open={report} offerId={offer.id} onClose={() => setReport(false)} />
      ) : null}
    </>
  );
}

function ReportModal({
  open,
  offerId,
  onClose,
}: {
  open: boolean;
  offerId: string;
  onClose: () => void;
}) {
  const push = useToastStore((s) => s.push);
  const form = useForm({
    resolver: zodResolver(reportSchema),
    defaultValues: { reason: '', comment: '' },
  });
  return (
    <Modal open={open} title="Signaler cette offre" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(async (v) => {
          await api.post(`/offers/${offerId}/report`, v);
          push('Signalement envoyé. L’offre sort de la carte le temps du contrôle.', 'success');
          onClose();
        })}
      >
        <Select
          id="reason"
          label="Motif"
          error={form.formState.errors.reason?.message}
          {...form.register('reason')}
        >
          <option value="">Choisir…</option>
          <option>Offre trompeuse</option>
          <option>Discrimination</option>
          <option>Arnaque / frais demandés</option>
          <option>Poste inexistant</option>
          <option>Autre</option>
        </Select>
        <TextArea id="comment" label="Commentaire" {...form.register('comment')} />
        <Button variant="dark" type="submit" className="w-full">
          Envoyer
        </Button>
      </form>
    </Modal>
  );
}
