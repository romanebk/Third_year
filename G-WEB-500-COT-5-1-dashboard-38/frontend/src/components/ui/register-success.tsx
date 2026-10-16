import Link from "next/link";

import { AuthShell, AuthTopLink } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/icons";

interface RegisterSuccessProps {
  email: string;
  confirmationToken: string | undefined;
}

// Écran affiché après la création du compte : guide la confirmation de
// l'email (lien réel ou lien de secours quand l'envoi n'est pas configuré).
export function RegisterSuccess({ email, confirmationToken }: RegisterSuccessProps) {
  return (
    <AuthShell
      headline="Almost there."
      description="Confirm your email and your dashboard is ready, with weather and news already set up."
      topAction={<AuthTopLink href="/login" prompt="Already confirmed?" label="Sign in" />}
    >
      <div className="w-full text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10 text-foreground">
            <CheckIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Account created</h1>
          <p className="text-sm text-muted-foreground">
            One last step: confirm your email. We sent the confirmation link to{" "}
            <strong>{email}</strong>.
          </p>

          <ol className="mt-6 w-full space-y-4 text-left">
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Check your inbox</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {confirmationToken ? (
                    <>
                      No email delivery is configured on this server — the confirmation link is
                      shown below instead. (When email delivery is configured, e.g. via the
                      built-in Mailpit inbox for local development, the real message is sent to{" "}
                      {email} and this fallback link is not shown.)
                    </>
                  ) : (
                    <>
                      We sent it to {email} — don&apos;t forget to check your spam/promotions
                      folder if it doesn&apos;t show up in a minute.
                    </>
                  )}
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Open the confirmation link</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Click the link inside the email — or use the shortcut below if you received the
                  token directly.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">You are connected, no login</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Confirming also starts your session: you land directly on the dashboard, no
                  second sign-in needed.
                </p>
              </div>
            </li>
          </ol>

          <Button asChild variant="outline" size="lg" className="mt-6 w-full cursor-pointer rounded-full">
            <Link href="/confirm">I have a confirmation token</Link>
          </Button>
          {confirmationToken ? (
            <div className="mt-2 w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-left">
              <p className="text-xs font-medium text-foreground">
                Confirmation link (only shown when email delivery is not configured)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                /confirm?token={confirmationToken}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <Link href={`/confirm?token=${confirmationToken}`}>Open the confirmation page</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}
