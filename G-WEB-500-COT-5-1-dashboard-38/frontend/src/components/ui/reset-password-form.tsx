"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthAlert, AuthShell, AuthTopLink, FieldError } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon, SpinnerIcon } from "@/components/icons";
import { isValidPassword } from "@/lib/validation";

type Errors = Partial<Record<"password" | "confirm", string>>;

// Choix du nouveau mot de passe depuis le lien reçu par email
// (/reset-password?token=…, POST /api/auth/reset-password). Après succès :
// retour sur /login avec un message, le jeton ne pouvant servir qu'une fois.
export default function ResetPasswordForm() {
  // undefined = pas encore lu (premier rendu, identique côté serveur) ;
  // "" = lien sans jeton.
  const [token, setToken] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [feedback, setFeedback] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    setToken(url.searchParams.get("token") ?? "");
    // Le jeton ne reste pas dans la barre d'adresse ni dans l'historique.
    url.searchParams.delete("token");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Errors = {
      password: isValidPassword(password) ? undefined : "Password must be at least 8 characters.",
      confirm: confirm === password ? undefined : "Passwords do not match.",
    };
    setErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirm) return;

    setSaving(true);
    setFeedback(undefined);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not reset your password. Please try again.");
      }
      window.location.assign("/login?reset=1");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not reset your password.");
      setSaving(false);
    }
  }

  return (
    <AuthShell
      headline="A fresh start for your password."
      description="Choose a new password and sign back in. Your dashboard and widgets stay exactly as you left them."
      topAction={<AuthTopLink href="/login" prompt="Remembered it?" label="Sign in" />}
    >
      {token === "" ? (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">This link is incomplete</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Open the link from the email again, or request a new one. Reset links are valid for 1 hour.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 cursor-pointer rounded-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use at least 8 characters.</p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rp-password" className="text-sm font-medium text-foreground">
                New password
              </label>
              <div className="relative">
                <Input
                  id="rp-password"
                  type={visible ? "text" : "password"}
                  placeholder="8+ characters"
                  className="h-12 pr-12"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "rp-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setVisible((current) => !current)}
                  aria-label={visible ? "Hide passwords" : "Show passwords"}
                  aria-pressed={visible}
                  className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
              {errors.password ? <FieldError id="rp-password-error">{errors.password}</FieldError> : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="rp-confirm" className="text-sm font-medium text-foreground">
                Confirm new password
              </label>
              <Input
                id="rp-confirm"
                type={visible ? "text" : "password"}
                placeholder="Repeat it"
                className="h-12"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                aria-invalid={errors.confirm ? true : undefined}
                aria-describedby={errors.confirm ? "rp-confirm-error" : undefined}
              />
              {errors.confirm ? <FieldError id="rp-confirm-error">{errors.confirm}</FieldError> : null}
            </div>

            {feedback ? (
              <AuthAlert>
                {feedback}{" "}
                <Link href="/forgot-password" className="font-medium underline underline-offset-4 hover:no-underline">
                  Request a new link
                </Link>
              </AuthAlert>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="mt-1 h-12 w-full cursor-pointer rounded-full"
              disabled={saving || token === undefined}
            >
              {saving ? <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {saving ? "Saving…" : "Save new password"}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
