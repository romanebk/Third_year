"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { AlertIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

// Doit correspondre à DELETE_CONFIRMATION_WORD côté backend (api/profile).
const CONFIRMATION_WORD = "DELETE";

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 hover:border-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/10 min-h-[44px]";

// Zone de suppression du compte (page Profile). Deux étapes : le bouton ouvre
// un panneau qui explique ce qui sera supprimé et demande le mot de passe —
// ou, pour un compte GitHub/Google sans mot de passe, de taper DELETE. Après
// suppression : déconnexion puis retour sur /login avec un message.
export default function DeleteAccountSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ready = hasPassword ? value.length > 0 : value === CONFIRMATION_WORD;

  function close() {
    setOpen(false);
    setValue("");
    setError(null);
  }

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasPassword ? { password: value } : { confirmation: value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not delete your account. Please try again.");
      }
      await signOut({ callbackUrl: "/login?deleted=1" });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete your account.");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-[20px] border border-red-500/25 bg-[#0c0c10]/90">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Delete account</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Permanently delete your account and everything linked to it. This cannot be undone.
          </p>
        </div>
        {open ? null : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 min-h-[44px]"
          >
            <TrashIcon className="size-3.5" aria-hidden="true" />
            Delete account
          </button>
        )}
      </div>

      {open ? (
        <form
          onSubmit={handleDelete}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !deleting) close();
          }}
          className="flex flex-col gap-4 border-t border-white/[0.06] p-5"
        >
          <div className="rounded-xl bg-red-500/[0.06] p-4 text-sm leading-6 text-foreground/90">
            <p className="font-medium">This will delete:</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              <li>your profile, username and settings;</li>
              <li>all your dashboard widgets;</li>
              <li>your connected services and their access tokens.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-account-confirm" className="text-xs font-medium text-foreground/90">
              {hasPassword ? "Enter your password to confirm" : `Type ${CONFIRMATION_WORD} to confirm`}
            </label>
            <input
              ref={inputRef}
              id="delete-account-confirm"
              type={hasPassword ? "password" : "text"}
              autoComplete={hasPassword ? "current-password" : "off"}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder={hasPassword ? "Your password" : CONFIRMATION_WORD}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "delete-account-error" : undefined}
              className={`${inputClass} sm:max-w-sm`}
            />
            {error ? (
              <p id="delete-account-error" role="alert" className="flex items-center gap-1.5 text-xs text-foreground/90">
                <AlertIcon className="size-3 shrink-0 text-red-400" aria-hidden="true" />
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!ready || deleting}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-red-500 px-5 py-2 text-sm font-semibold text-white transition-[opacity,background-color] hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 min-h-[44px]"
            >
              {deleting ? <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={deleting}
              className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
