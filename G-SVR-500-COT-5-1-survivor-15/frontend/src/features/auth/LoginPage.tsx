import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { Brand } from '@/components/layout/Brand';
import { AuthPanelCarousel } from '@/features/auth/AuthPanelCarousel';
import { useSessionStore } from '@/store/session';
import { useToastStore } from '@/store/toast';
import type { AuthResponse, Role } from '@/types';

const loginFormSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe obligatoire'),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'Vous devez accepter les CGU pour continuer.',
  }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

function homeFor(role: Role): string {
  if (role === 'employer') return '/pro/tableau-de-bord';
  if (role === 'admin') return '/admin/moderation';
  return '/app';
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M9.9 5.1A10.4 10.4 0 0 1 12 4.8c5.2 0 9.2 4.2 10.2 7.2a11.3 11.3 0 0 1-3.4 4.7M6.1 6.1C4 7.6 2.5 9.7 1.8 12c1 3 5 7.2 10.2 7.2 1.5 0 2.9-.3 4.2-.9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.6-7.2 10-7.2S22 12 22 12s-3.6 7.2-10 7.2S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setSession = useSessionStore((s) => s.setSession);
  const pending = useSessionStore((s) => s.pendingAction);
  const push = useToastStore((s) => s.push);
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '', acceptTerms: false },
  });

  useEffect(() => {
    const first = Object.keys(form.formState.errors)[0];
    if (first) document.getElementById(first)?.focus();
  }, [form.formState.errors]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { data } = await api.post<AuthResponse>('/auth/login', {
        email: values.email,
        password: values.password,
      });
      setSession(data.user, data.accessToken, data.refreshToken, true);
      const redirect = params.get('redirect');
      if (pending?.type === 'apply') {
        nav(`/app/carte?postuler=${pending.offerId}`, { replace: true });
        return;
      }
      nav(redirect || homeFor(data.user.role), { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Connexion impossible pour le moment.';
      push(msg, 'danger');
      form.setError('password', { message: msg });
    }
  });

  return (
    <div className="grid min-h-svh bg-paper lg:grid-cols-2">
      <section className="relative flex flex-col px-5 py-6 sm:px-12 lg:px-16">
        <Brand size="lg" />

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-8 sm:py-10">
          <h1 className="text-center text-[clamp(28px,3.4vw,36px)] font-extrabold tracking-[-0.03em] leading-[1.08] text-ink">
            Reprenez là où <span className="text-forest">GéoEmploi</span> vous attend
          </h1>
          <p className="mt-3 text-center text-[14px] text-muted">
            Entrez votre email et votre mot de passe pour continuer.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label className="field-label" htmlFor="email">
                Email*
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="exemple@domaine.fr"
                className="field-input"
                aria-invalid={form.formState.errors.email ? true : undefined}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="field-error" role="alert">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label className="field-label mb-0" htmlFor="password">
                  Mot de passe*
                </label>
                <Link
                  to="/mot-de-passe-oublie"
                  className="text-[12.5px] font-medium text-muted hover:text-ink"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="10 caractères min."
                  className="field-input pr-11"
                  aria-invalid={form.formState.errors.password ? true : undefined}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <EyeIcon open={showPwd} />
                </button>
              </div>
              {form.formState.errors.password ? (
                <p className="field-error" role="alert">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <label className="flex items-start gap-2.5 text-[13.5px] text-ink">
              <input
                id="acceptTerms"
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-line accent-forest"
                {...form.register('acceptTerms')}
              />
              <span>
                J’accepte les{' '}
                <Link to="/cgu" className="font-semibold underline underline-offset-2">
                  Conditions générales
                </Link>{' '}
                de GéoEmploi
              </span>
            </label>
            {form.formState.errors.acceptTerms ? (
              <p className="field-error" role="alert">
                {form.formState.errors.acceptTerms.message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex w-full items-center justify-center rounded-[14px] bg-forest px-6 py-3.5 text-[15px] font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-forestSoft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.formState.isSubmitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-6 text-center text-[13.5px] text-muted">
            Pas encore de compte ?{' '}
            <Link to="/inscription" className="link-forest">
              Créer un compte
            </Link>
          </p>
        </div>

        <p className="text-center text-[11.5px] text-muted">
          Démonstrateur technique, ne constitue pas un service public en exploitation.
        </p>
      </section>

      <AuthPanelCarousel />
    </div>
  );
}
