import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { forgotSchema, resetSchema } from './schemas';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const form = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });
  return (
    <AuthShell
      title={
        <>
          Mot de passe <span className="text-forest">oublié</span>
        </>
      }
      subtitle="Indiquez votre email. Si un compte existe, un lien de réinitialisation sera envoyé."
      footer={
        <Link className="font-semibold text-forest" to="/connexion">
          Retour à la connexion
        </Link>
      }
      panelTitle="On vous remet sur la carte"
      panelStory={{
        title: 'Sécurité d’abord',
        body: 'Le lien de réinitialisation est envoyé par e-mail et expire rapidement.',
      }}
    >
      {done ? (
        <p className="rounded-2xl bg-grey px-4 py-3 text-[14px] text-muted">
          Si un compte existe, un lien de réinitialisation a été envoyé par e-mail.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            await api.post('/auth/forgot-password', v);
            setDone(true);
          })}
        >
          <Input
            id="email"
            label="Email*"
            type="email"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Button variant="dark" type="submit" className="w-full rounded-xl">
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const { token } = useParams();
  const [ok, setOk] = useState(false);
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });
  return (
    <AuthShell
      title={
        <>
          Nouveau <span className="text-forest">mot de passe</span>
        </>
      }
      subtitle="Choisissez un mot de passe d’au moins 10 caractères, avec une majuscule et un chiffre."
      footer={
        <Link className="font-semibold text-forest" to="/connexion">
          Retour à la connexion
        </Link>
      }
    >
      {ok ? (
        <p className="text-[14.5px]">
          Mot de passe mis à jour.{' '}
          <Link className="font-semibold text-forest" to="/connexion">
            Se connecter
          </Link>
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (v) => {
            await api.post('/auth/reset-password', { token, password: v.password });
            setOk(true);
          })}
        >
          <Input
            id="password"
            label="Mot de passe*"
            type="password"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <Input
            id="confirm"
            label="Confirmation*"
            type="password"
            error={form.formState.errors.confirm?.message}
            {...form.register('confirm')}
          />
          <Button variant="dark" type="submit" className="w-full rounded-xl">
            Réinitialiser
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
