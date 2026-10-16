"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getProviders, signIn } from "next-auth/react";

import { AuthAlert, AuthShell, AuthTopLink, FieldError } from "@/components/ui/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { EyeIcon, EyeOffIcon, GithubIcon, SpinnerIcon } from "@/components/icons";
import { USERNAME_MAX_LENGTH } from "@/lib/validation";
import {
  termsError,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateUsername,
  type RegisterErrors,
} from "@/components/ui/register-validation";
import { RegisterSuccess } from "@/components/ui/register-success";

const googleLogo =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjYyIj48cGF0aCBmaWxsPSIjNDI4NWY0IiBkPSJNMjU1Ljg3OCAxMzMuNDUxYzAtMTAuNzM0LS44NzEtMTguNTY3LTIuNzU2LTI2LjY5SDEzMC41NXY0OC40NDhoNzEuOTQ3Yy0xLjQ1IDEyLjA0LTkuMjgzIDMwLjE3Mi0yNi42OSA0Mi4zNTZsLS4yNDQgMS42MjJsMzguNzU1IDMwLjAyM2wyLjY4NS4yNjhjMjQuNjU5LTIyLjc3NCAzOC44NzUtNTYuMjgyIDM4Ljg3NS05Ni4wMjciLz48cGF0aCBmaWxsPSIjMzRhODUzIiBkPSJNMTMwLjU1IDI2MS4xYzM1LjI0OCAwIDY0LjgzOS0xMS42MDUgODYuNDUzLTMxLjYyMmwtNDEuMTk2LTMxLjkxM2MtMTEuMDI0IDcuNjg4LTI1LjgyIDEzLjA1NS00NS4yNTcgMTMuMDU1Yy0zNC41MjMgMC02My44MjQtMjIuNzczLTc0LjI2OS01NC4yNWwtMS41MzEuMTNsLTQwLjI5OCAzMS4xODdsLS41MjcgMS40NjVDMzUuMzkzIDIzMS43OTggNzkuNDkgMjYxLjEgMTMwLjU1IDI2MS4xIi8+PHBhdGggZmlsbD0iI2ZiYmMwNSIgZD0iTTU2LjI4MSAxNTYuMzdjLTIuNzU2LTguMTIzLTQuMzUxLTE2LjgyNy00LjM1MS0yNS44MmMwLTguOTk0IDEuNTk1LTE3LjY5NyA0LjIwNi0yNS44MmwtLjA3My0xLjczTDE1LjI2IDcxLjMxMmwtMS4zMzUuNjM1QzUuMDc3IDg5LjY0NCAwIDEwOS41MTcgMCAxMzAuNTVzNS4wNzcgNDAuOTA1IDEzLjkyNSA1OC42MDJ6Ii8+PHBhdGggZmlsbD0iI2ViNDMzNSIgZD0iTTEzMC41NSA1MC40NzljMjQuNTE0IDAgNDEuMDUgMTAuNTg5IDUwLjQ3OSAxOS40MzhsMzYuODQ0LTM1Ljk3NEMxOTUuMjQ1IDEyLjkxIDE2NS43OTggMCAxMzAuNTUgMEM3OS40OSAwIDM1LjM5MyAyOS4zMDEgMTMuOTI1IDcxLjk0N2w0Mi4yMTEgMzIuNzgzYzEwLjU5LTMxLjQ3NyAzOS44OTEtNTQuMjUxIDc0LjQxNC01NC4yNTEiLz48L3N2Zz4=";

const socialProviders = [
  { id: "github", label: "Sign up with GitHub" },
  { id: "google", label: "Sign up with Google" },
] as const;

// Génériques : partagées par GitHub et Google, qui passent par le même flow
// NextAuth et les mêmes codes d'erreur — un message spécifique à un seul
// provider serait trompeur pour l'autre.
const OAUTH_ERRORS: Record<string, string> = {
  OAuthSignin: "Failed to connect. Please try again.",
  OAuthCallback: "The provider did not return a valid response.",
  OAuthCreateAccount: "Could not create an account from this provider.",
  Callback: "Sign-up was interrupted.",
  AccessDenied: "Access was denied. Try again or use email/password.",
  Configuration: "Authentication is not configured on the server.",
  Default: "Sign-up failed. Please try again.",
};

export default function Register16() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [loading, setLoading] = useState(false);
  // Id du provider OAuth en cours de connexion (ou null) — un seul état pour
  // GitHub et Google plutôt qu'un booléen par provider, puisqu'un seul bouton
  // peut être en chargement à la fois.
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<string | undefined>(undefined);
  const [confirmationToken, setConfirmationToken] = useState<string | undefined>(undefined);
  // Conditions d'utilisation + Politique de confidentialité : obligatoires pour
  // créer un compte, par email comme via GitHub/Google (revérifié côté serveur).
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const termsRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setFeedback(OAUTH_ERRORS[error] ?? OAUTH_ERRORS.Default);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: RegisterErrors = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(confirmPassword, password),
      terms: acceptedTerms ? undefined : termsError,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    setFeedback(undefined);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email, password, acceptTerms: acceptedTerms }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setFeedback("An account with this email already exists. Try signing in.");
        } else if (response.status === 400) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setFeedback(
            body?.error === "Invalid username"
              ? "Invalid username."
              : body?.error?.includes("Terms")
                ? termsError
                : "Invalid email or password.",
          );
        } else {
          setFeedback("Unable to create the account. Please try again.");
        }
        return;
      }

      const data = (await response.json()) as {
        id: string;
        email: string;
        devConfirmationToken?: string;
      };

      const token = data.devConfirmationToken;
      setConfirmationToken(token);
      if (token) {
        try {
          window.sessionStorage.setItem("hubly.auth.confirmationToken", token);
        } catch {
          // Navigation privée : le lien reste affiché à l'écran de succès.
        }
      }
      setDone(true);
    } catch {
      setFeedback("Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(providerId: "github" | "google", label: string) {
    if (oauthLoading) return;
    if (!acceptedTerms) {
      setErrors((current) => ({ ...current, terms: termsError }));
      termsRef.current?.focus();
      return;
    }
    setOauthLoading(providerId);
    setFeedback(undefined);
    try {
      const providers = await getProviders();
      if (!providers) {
        // Cf. login-16.tsx : getProviders() renvoie null sur un échec réseau
        // (backend en train de redémarrer) sans distinction avec un provider
        // réellement absent de la config — à ne pas confondre avec un .env
        // incomplet.
        setFeedback("Unable to reach the server. Please try again in a moment.");
        return;
      }
      if (!providers[providerId]) {
        const envVar =
          providerId === "github" ? "GITHUB_CLIENT_ID/SECRET" : "GOOGLE_CLIENT_ID/SECRET";
        setFeedback(`${label} is not configured yet. Add ${envVar} to .env to enable it.`);
        return;
      }
      await signIn(providerId, { callbackUrl: "/dashboard" });
    } catch {
      setFeedback(`Unable to start ${label.replace("Sign up with ", "")} sign-up. Please try again.`);
    } finally {
      setOauthLoading(null);
    }
  }

  if (done) {
    return <RegisterSuccess email={email} confirmationToken={confirmationToken} />;
  }

  return (
    <AuthShell
      headline="Build your dashboard."
      description="Connect the services you use and add live widgets — weather, news, GitHub, YouTube, crypto and more."
      topAction={<AuthTopLink href="/login" prompt="Already have an account?" label="Sign in" />}
    >
      <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">It&apos;s free and takes less than a minute.</p>

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

      <div className="my-7 flex items-center gap-3" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          or with email
        </span>
        <Separator className="flex-1" />
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r16-username" className="text-sm font-medium text-foreground">
            Username
          </label>
          <Input
            id="r16-username"
            type="text"
            placeholder="e.g. rayann"
            className="h-12"
            autoComplete="username"
            maxLength={USERNAME_MAX_LENGTH}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onBlur={() => setErrors((current) => ({ ...current, username: validateUsername(username) }))}
            aria-invalid={errors.username ? true : undefined}
            aria-describedby={errors.username ? "r16-username-error" : "r16-username-hint"}
          />
          {errors.username ? (
            <FieldError id="r16-username-error">{errors.username}</FieldError>
          ) : (
            <p id="r16-username-hint" className="text-xs text-muted-foreground">
              Shown at the top of your dashboard.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="r16-email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="r16-email"
            type="email"
            placeholder="you@company.com"
            className="h-12"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setErrors((current) => ({ ...current, email: validateEmail(email) }))}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "r16-email-error" : undefined}
          />
          {errors.email && <FieldError id="r16-email-error">{errors.email}</FieldError>}
        </div>

        {/* Mot de passe et confirmation côte à côte dès que la largeur le permet. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="r16-pw" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                id="r16-pw"
                type={showPassword ? "text" : "password"}
                placeholder="8+ characters"
                className="h-12 pr-12"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() =>
                  setErrors((current) => ({ ...current, password: validatePassword(password) }))
                }
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "r16-pw-error" : undefined}
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
            {errors.password && <FieldError id="r16-pw-error">{errors.password}</FieldError>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="r16-confirm" className="text-sm font-medium text-foreground">
              Confirm password
            </label>
            <div className="relative">
              <Input
                id="r16-confirm"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat it"
                className="h-12 pr-12"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                onBlur={() =>
                  setErrors((current) => ({
                    ...current,
                    confirmPassword: validateConfirmPassword(confirmPassword, password),
                  }))
                }
                aria-invalid={errors.confirmPassword ? true : undefined}
                aria-describedby={errors.confirmPassword ? "r16-confirm-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((visible) => !visible)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                aria-pressed={showConfirmPassword}
                className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showConfirmPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <FieldError id="r16-confirm-error">{errors.confirmPassword}</FieldError>
            )}
          </div>
        </div>

        {/* Consentement obligatoire : un interrupteur (role="switch") plutôt
            qu'une case, activable aussi en cliquant le texte (label). Les liens
            s'ouvrent dans un nouvel onglet pour ne pas perdre la saisie. */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
            errors.terms ? "border-white/40" : "border-white/10",
          )}
        >
          <button
            ref={termsRef}
            id="r16-terms"
            type="button"
            role="switch"
            aria-checked={acceptedTerms}
            aria-describedby={errors.terms ? "r16-terms-error" : undefined}
            onClick={() => {
              const next = !acceptedTerms;
              setAcceptedTerms(next);
              setErrors((current) => ({ ...current, terms: next ? undefined : current.terms }));
            }}
            className={cn(
              "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              acceptedTerms ? "border-white bg-white" : "border-white/25 bg-white/10",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block size-4 rounded-full shadow transition-transform duration-200",
                acceptedTerms ? "translate-x-[22px] bg-black" : "translate-x-[3px] bg-white",
              )}
            />
          </button>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="r16-terms" className="cursor-pointer text-sm leading-6 text-muted-foreground">
              I have read and accept the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                Privacy Policy
              </Link>
              , including how my data is used.
            </label>
            {errors.terms ? <FieldError id="r16-terms-error">{errors.terms}</FieldError> : null}
          </div>
        </div>

        {feedback ? <AuthAlert>{feedback}</AuthAlert> : null}

        <Button
          type="submit"
          size="lg"
          className="mt-1 h-12 w-full cursor-pointer rounded-full"
          disabled={loading}
        >
          {loading ? <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground lg:text-left">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded px-1 font-medium text-foreground underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
