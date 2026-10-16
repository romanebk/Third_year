import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { Modal } from '@/components/ui/Modal';
import { TextArea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/store/session';
import { useCaughtStore } from '@/store/caught';
import { useToastStore } from '@/store/toast';
import type { Offer } from '@/types';
import { useState } from 'react';

const schema = z.object({
  message: z.string().max(500, '500 caractères maximum').optional(),
});

export function ApplicationModal({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  const user = useSessionStore((s) => s.user);
  const markApplied = useCaughtStore((s) => s.catchOffer);
  const push = useToastStore((s) => s.push);
  const qc = useQueryClient();
  const [done, setDone] = useState(false);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { message: '' } });
  const mut = useMutation({
    mutationFn: async (message?: string) => {
      const { data } = await api.post('/applications', {
        offerId: offer.id,
        message,
        cvId: user?.cv?.id,
      });
      return data as { id: string };
    },
    onSuccess: () => {
      markApplied(offer.id);
      qc.invalidateQueries({ queryKey: ['applications'] });
      setDone(true);
      push("Candidature envoyée. L'employeur l'a reçue.", 'success');
      window.setTimeout(onClose, 900);
    },
    onError: (e) => {
      push(
        e instanceof ApiError
          ? e.message
          : "On n'a pas pu envoyer votre candidature. Réessayez ?",
        'danger',
      );
    },
  });

  return (
    <Modal open title={`Postuler : ${offer.title}`} onClose={onClose}>
      {done ? (
        <p className="py-8 text-center text-[17px] font-extrabold tracking-[-0.02em] text-ink">
          Candidature envoyée.
          <span className="mt-2 block text-[14px] font-medium text-muted">
            L&apos;employeur l&apos;a reçue.
          </span>
        </p>
      ) : (
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => mut.mutate(v.message))}>
          <p className="text-[14px] text-muted">
            Profil envoyé : {user?.firstName} {user?.lastName} · {user?.jobTitle} · CV{' '}
            {user?.cv?.name ?? 'non fourni'}
          </p>
          <TextArea
            id="message"
            label="Message (optionnel, 500 caractères)"
            maxLength={500}
            error={form.formState.errors.message?.message}
            {...form.register('message')}
          />
          <Button variant="lime" type="submit" className="w-full" disabled={mut.isPending}>
            {mut.isPending ? 'Envoi…' : 'Postuler'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
