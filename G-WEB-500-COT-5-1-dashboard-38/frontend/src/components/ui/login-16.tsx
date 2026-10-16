"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";

import { AuthAlert, AuthShell, AuthTopLink, FieldError } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { CheckIcon, EyeIcon, EyeOffIcon, GithubIcon, SpinnerIcon } from "@/components/icons";
import { isValidEmail } from "@/lib/validation";

const googleLogo =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjYyIj48cGF0aCBmaWxsPSIjNDI4NWY0IiBkPSJNMjU1Ljg3OCAxMzMuNDUxYzAtMTAuNzM0LS44NzEtMTguNTY3LTIuNzU2LTI2LjY5SDEzMC41NXY0OC40NDhoNzEuOTQ3Yy0xLjQ1IDEyLjA0LTkuMjgzIDMwLjE3Mi0yNi42OSA0Mi4zNTZsLS4yNDQgMS42MjJsMzguNzU1IDMwLjAyM2wyLjY4NS4yNjhjMjQuNjU5LTIyLjc3NCAzOC44NzUtNTYuMjgyIDM4Ljg3NS05Ni4wMjciLz48cGF0aCBmaWxsPSIjMzRhODUzIiBkPSJNMTMwLjU1IDI2MS4xYzM1LjI0OCAwIDY0LjgzOS0xMS42MDUgODYuNDUzLTMxLjYyMmwtNDEuMTk2LTMxLjkxM2MtMTEuMDI0IDcuNjg4LTI1LjgyIDEzLjA1NS00NS4yNTcgMTMuMDU1Yy0zNC41MjMgMC02My44MjQtMjIuNzczLTc0LjI2OS01NC4yNWwtMS41MzEuMTNsLTQwLjI5OCAzMS4xODdsLS41MjcgMS40NjVDMzUuMzkzIDIzMS43OTggNzkuNDkgMjYxLjEgMTMwLjU1IDI2MS4xIi8+PHBhdGggZmlsbD0iI2ZiYmMwNSIgZD0iTTU2LjI4MSAxNTYuMzdjLTIuNzU2LTguMTIzLTQuMzUxLTE2LjgyNy00LjM1MS0yNS44MmMwLTguOTk0IDEuNTk1LTE3LjY5NyA0LjIwNi0yNS44MmwtLjA3My0xLjczTDE1LjI2IDcxLjMxMmwtMS4zMzUuNjM1QzUuMDc3IDg5LjY0NCAwIDEwOS41MTcgMCAxMzAuNTVzNS4wNzcgNDAuOTA1IDEzLjkyNSA1OC42MDJ6Ii8+PHBhdGggZmlsbD0iI2ViNDMzNSIgZD0iTTEzMC41NSA1MC40NzljMjQuNTE0IDAgNDEuMDUgMTAuNTg5IDUwLjQ3OSAxOS40MzhsMzYuODQ0LTM1Ljk3NEMxOTUuMjQ1IDEyLjkxIDE2NS43OTggMCAxMzAuNTUgMEM3OS40OSAwIDM1LjM5MyAyOS4zMDEgMTMuOTI1IDcxLjk0N2w0Mi4yMTEgMzIuNzgzYzEwLjU5LTMxLjQ3NyAzOS44OTEtNTQuMjUxIDc0LjQxNC01NC4yNTEiLz48L3N2Zz4=";

const socialProviders = [
  { id: "github", label: "Continue with GitHub" },
  { id: "google", label: "Continue with Google" },
] as const;

// Couvre à la fois les codes d'erreur OAuth (GitHub) et Credentials (email/mdp) :
// les deux passent par le même flow NextAuth -> redirection vers /login?error=...
// -> lu par le useEffect ci-dessous. InvalidCredentials/EmailNotVerified viennent
// de authorize() dans src/server/auth/auth.ts.
const AUTH_ERRORS: Record<string, string> = {
  // Génériques : partagées par GitHub et Google, qui passent par le même flow
  // NextAuth et les mêmes codes d'erreur — un message spécifique à un seul
  // provider serait trompeur pour l'autre.
  OAuthSignin: "Failed to connect. Please try again.",
  OAuthCallback: "The provider did not return a valid response.",
  OAuthCreateAccount: "Could not create an account from this provider.",
  Callback: "Sign-in was interrupted.",
  AccessDenied: "Access was denied. Try again or use email/password.",
  Configuration: "Authentication is not configured on the server.",
  InvalidCredentials: "Incorrect email or password.",
  EmailNotVerified: "Please confirm your email before signing in — check the confirmation link sent at sign-up.",
  AccountDisabled: "This account has been disabled. Contact an administrator for details.",
  Default: "Sign-in failed. Please try again.",
};

type LoginErrors = Partial<Record<"email" | "password", string | undefined>>;
type Feedback = { type: "success" | "error"; message: string } | undefined;

function validateEmail(value: string): string | undefined {
  if (!value.trim()) return "Email is required.";
  if (!isValidEmail(value)) return "Enter a valid email address.";
  return undefined;
}

function validatePassword(value: string): string | undefined {
  if (!value) return "Password is required.";
  return undefined;
}

export default function Login16() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [loading, setLoading] = useState(false);
  // Id du provider OAuth en cours de connexion (ou null) — un seul état pour
  // GitHub et Google plutôt qu'un booléen par provider, puisqu'un seul bouton
  // peut être en chargement à la fois.
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Retour après suppression du compte depuis Profile (DeleteAccountSection).
    if (params.get("deleted") === "1") {
      setFeedback({ type: "success", message: "Your account and all its data have been deleted." });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    // Retour après un changement de mot de passe (ResetPasswordForm).
    if (params.get("reset") === "1") {
      setFeedback({ type: "success", message: "Your password has been changed. Sign in with the new one." });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    const error = params.get("error");
    if (error) {
      setFeedback({
        type: "error",
        message: AUTH_ERRORS[error] ?? AUTH_ERRORS.Default,
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: LoginErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setLoading(true);
    setFeedback(undefined);
    try {
      // Pas de redirect: false ici, volontairement : même pattern que le bouton
      // GitHub juste en dessous — NextAuth gère la redirection complète (succès ->
      // callbackUrl, échec -> /login?error=... relu par le useEffect ci-dessus).
      // Pas de setLoading(false) après un appel réussi : la navigation démonte ce
      // composant avant que ça ait de l'importance.
      await signIn("credentials", { email, password, callbackUrl: "/dashboard" });
    } catch {
      setFeedback({ type: "error", message: "Unable to reach the server. Please try again." });
      setLoading(false);
    }
  }

  async function handleOAuth(providerId: "github" | "google", label: string) {
    if (oauthLoading) return;
    setOauthLoading(providerId);
    setFeedback(undefined);
    try {
      const providers = await getProviders();
      if (!providers) {
        // getProviders() avale les erreurs réseau et renvoie null au lieu de
        // rejeter (ex: backend en train de redémarrer) — à distinguer d'un
        // provider réellement absent de la config, sinon un simple hoquet
        // réseau s'affiche comme "il manque GOOGLE_CLIENT_ID/SECRET", trompeur
        // et inexploitable par l'utilisateur.
        setFeedback({
          type: "error",
          message: "Unable to reach the server. Please try again in a moment.",
        });
        return;
      }
      if (!providers[providerId]) {
        const envVar =
          providerId === "github" ? "GITHUB_CLIENT_ID/SECRET" : "GOOGLE_CLIENT_ID/SECRET";
        setFeedback({
          type: "error",
          message: `${label} is not configured yet. Add ${envVar} to .env to enable it.`,
        });
        return;
      }
      await signIn(providerId, { callbackUrl: "/dashboard" });
    } catch {
      setFeedback({
        type: "error",
        message: `Unable to start ${label.replace("Continue with ", "")} sign-in. Please try again.`,
      });
    } finally {
      setOauthLoading(null);
    }
  }

  return (
    <AuthShell
      headline="Your day, on one screen."
      description="Weather, news, GitHub, YouTube and more — live widgets you arrange the way you like."
      topAction={<AuthTopLink href="/register" prompt="New to Hubly?" label="Create account" />}
    >
      {feedback?.type === "success" ? (
        <p
          role="status"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-3 text-sm text-foreground"
        >
          <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {feedback.message}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sign in to your dashboard.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {socialProviders.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => void handleOAuth(provider.id, provider.label)}
            disabled={oauthLoading !== null}
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border border-white/15 bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            {oauthLoading === provider.id ? (
              <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : provider.id === "github" ? (
              <GithubIcon className="size-4" aria-hidden="true" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- logo Google en data URI, rien à optimiser
              <img src={googleLogo} alt="" className="size-4" aria-hidden="true" />
            )}
            {provider.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        By continuing with GitHub or Google, you agree to the{" "}
        <Link href="/terms" className="text-foreground underline underline-offset-4 hover:no-underline">
          Terms of Service
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="text-foreground underline underline-offset-4 hover:no-underline">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="my-7 flex items-center gap-3" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          or with email
        </span>
        <Separator className="flex-1" />
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="l16-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="l16-email"
            type="email"
            placeholder="you@company.com"
            className="h-12"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setErrors((current) => ({ ...current, email: validateEmail(email) }))}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "l16-email-error" : undefined}
          />
          {errors.email && <FieldError id="l16-email-error">{errors.email}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="l16-pw" className="text-sm font-medium text-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="flex min-h-[44px] items-center rounded-full px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="l16-pw"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className="h-12 pr-12"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={() =>
                setErrors((current) => ({ ...current, password: validatePassword(password) }))
              }
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "l16-pw-error" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
          {errors.password && <FieldError id="l16-pw-error">{errors.password}</FieldError>}
        </div>

        {feedback?.type === "error" ? <AuthAlert>{feedback.message}</AuthAlert> : null}

        <Button
          type="submit"
          size="lg"
          className="mt-1 h-12 w-full cursor-pointer rounded-full"
          disabled={loading}
        >
          {loading ? <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
        New here?{" "}
        <Link
          href="/register"
          className="rounded px-1 font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
