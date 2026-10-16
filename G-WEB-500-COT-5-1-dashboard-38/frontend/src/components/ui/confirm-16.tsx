"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthNav } from "@/components/ui/auth-nav";
import { CheckIcon, SpinnerIcon } from "@/components/icons";

type ConfirmStatus = "idle" | "loading" | "success";

export default function Confirm16({ initialToken = "" }: { initialToken?: string }) {
  const router = useRouter();
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ConfirmStatus>("idle");
  const [resending, setResending] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  // Un token de confirmation est à usage unique (supprimé en base dès qu'il est
  // consommé, cf. POST /api/auth/confirm) — en dev, React StrictMode monte cet
  // effet deux fois : sans ce garde, le deuxième appel retombait sur "Invalid
  // token" (déjà consommé par le premier) et écrasait l'état de succès à
  // l'écran, alors que le compte (et la session, cf. l'effet de redirection
  // ci-dessous) était en réalité bien confirmé/ouverte.
  const autoVerifiedRef = useRef(false);

  async function verify(value: string) {
    if (!value.trim()) {
      setError("Confirmation token is required.");
      return;
    }
    setError(undefined);
    setStatus("loading");
    try {
      const response = await fetch("/api/auth/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value.trim() }),
      });

      if (!response.ok) {
        let message = "Unable to confirm the account. Please try again.";
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (body?.error === "Invalid token" || body?.error === "Token expired") {
          message = body.error === "Token expired"
            ? "This token has expired. Register again to receive a new one."
            : "This token is not valid. Check the value you pasted.";
        }
        setStatus("idle");
        setError(message);
        return;
      }

      setStatus("success");
    } catch {
      setStatus("idle");
      setError("Unable to reach the server. Please try again.");
    }
  }

  useEffect(() => {
    if (initialToken && !autoVerifiedRef.current) {
      autoVerifiedRef.current = true;
      void verify(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToken]);

  // Confirmation réussie => session ouverte côté serveur : redirection directe vers le
  // dashboard, sans repasser par le login. Petit délai pour laisser voir le succès.
  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => {
      void router.replace("/dashboard");
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [status, router]);

  if (status === "success") {
    return (
      <section className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckIcon className="size-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Account confirmed</h1>
            <p className="text-sm text-muted-foreground">
              Your account is active. Your session has been started — redirecting you to your
              dashboard…
            </p>
            <Button asChild size="lg" className="mt-2 w-full cursor-pointer rounded-full">
              <Link href="/dashboard">Go to my dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <AuthNav ctaHref="/login" ctaLabel="Sign in" />
      <section className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/logos/icon-48.png"
            alt="Hubly"
            width={64}
            height={64}
            unoptimized
            className="size-16"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Confirm your account</h1>
          <p className="text-sm text-muted-foreground">
            Paste the token sent to your email to activate your account.
          </p>
        </div>

        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void verify(token);
          }}
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="c16-token" className="text-xs font-medium text-foreground">
              Confirmation token
            </label>
            <Input
              id="c16-token"
              type="text"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="h-11 font-mono"
              autoComplete="one-time-code"
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                if (error) setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "c16-token-error" : "c16-token-hint"}
            />
            {error ? (
              <p id="c16-token-error" role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : (
              <p id="c16-token-hint" className="text-xs text-muted-foreground">
                Enter the token you received by email after signing up.
              </p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-1 h-11 w-full cursor-pointer rounded-full"
            disabled={status === "loading"}
          >
            {status === "loading" ? <SpinnerIcon className="size-4 animate-spin" /> : null}
            {status === "loading" ? "Confirming…" : "Confirm account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          No token received?{" "}
          <button
            type="button"
            onClick={() => {
              if (resending) return;
              setResending(true);
              setNotice(undefined);
              window.setTimeout(() => setResending(false), 400);
              // Pas de vrai fournisseur d'email branché : "renvoyer" ré-affiche le
              // token obtenu à l'inscription (même onglet) ou renvoie vers la console
              // serveur où le mailer logge le lien de confirmation.
              let stored = "";
              try {
                stored = window.sessionStorage.getItem("hubly.auth.confirmationToken") ?? "";
              } catch {
                // sessionStorage indisponible : on reste sur le message générique.
              }
              setNotice(
                stored
                  ? `Your confirmation token: ${stored}`
                  : "No token found in this browser. The confirmation link is printed in the server console (npm run dev) after sign-up.",
              );
            }}
            disabled={resending}
            className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend the email"}
          </button>
        </p>
        {notice ? (
          <p className="mt-3 break-all text-center font-mono text-xs text-muted-foreground">
            {notice}
          </p>
        ) : null}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </section>
    </>
  );
}