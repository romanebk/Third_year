"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthAlert, AuthShell, AuthTopLink, FieldError } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailIcon, SpinnerIcon } from "@/components/icons";
import { isValidEmail } from "@/lib/validation";

// Demande d'un lien de réinitialisation (POST /api/auth/forgot-password). Le
// message de succès est volontairement le même que le compte existe ou non :
// la page ne doit pas révéler quelles adresses sont inscrites.
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | undefined>(undefined);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!isValidEmail(address)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(undefined);
    setFeedback(undefined);
    setSending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not send the reset link. Please try again.");
      }
      setSentTo(address);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not send the reset link.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell
      headline="Locked out? It happens."
      description="Get a link by email and choose a new password. Your dashboard and widgets stay exactly as you left them."
      topAction={<AuthTopLink href="/login" prompt="Remembered it?" label="Sign in" />}
    >
      {sentTo ? (
        <div role="status">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-foreground">
            <MailIcon className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            If an account exists for <span className="text-foreground">{sentTo}</span>, we just sent a link to
            reset its password. It is valid for 1 hour and can be used once. Don&apos;t forget to check your spam
            folder.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 cursor-pointer rounded-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 cursor-pointer rounded-full"
              onClick={() => setSentTo(undefined)}
            >
              Use another email
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email of your account and we will send you a link to choose a new one.
          </p>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="fp-email"
                type="email"
                placeholder="you@company.com"
                className="h-12"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldError(undefined);
                }}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? "fp-email-error" : undefined}
              />
              {fieldError ? <FieldError id="fp-email-error">{fieldError}</FieldError> : null}
            </div>

            {feedback ? <AuthAlert>{feedback}</AuthAlert> : null}

            <Button type="submit" size="lg" className="mt-1 h-12 w-full cursor-pointer rounded-full" disabled={sending}>
              {sending ? <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {sending ? "Sending…" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
            Signed up with GitHub or Google?{" "}
            <Link
              href="/login"
              className="rounded px-1 font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in with that instead
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
