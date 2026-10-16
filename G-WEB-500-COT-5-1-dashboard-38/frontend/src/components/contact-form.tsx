"use client";

import { useEffect, useState } from "react";

import { AuthAlert, FieldError } from "@/components/ui/auth-shell";
import { CheckIcon, SpinnerIcon } from "@/components/icons";
import { isValidEmail } from "@/lib/validation";
import { cn } from "@/lib/utils";

// Mêmes clés que TOPICS côté backend (api/contact).
const TOPICS = [
  { key: "general", label: "General question" },
  { key: "privacy", label: "Privacy and my data" },
  { key: "account", label: "My account" },
  { key: "bug", label: "Bug report" },
] as const;
type TopicKey = (typeof TOPICS)[number]["key"];

const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;

const inputClass =
  "w-full rounded-xl border border-white/15 bg-black px-3.5 py-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 hover:border-white/25 focus:border-white/50 focus:ring-2 focus:ring-white/10";

type Errors = Partial<Record<"name" | "email" | "message", string>>;

function validate(name: string, email: string, message: string): Errors {
  return {
    name: name.trim() ? undefined : "Enter your name.",
    email: isValidEmail(email) ? undefined : "Enter a valid email address.",
    message:
      message.trim().length < MESSAGE_MIN_LENGTH
        ? `Write at least ${MESSAGE_MIN_LENGTH} characters.`
        : undefined,
  };
}

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<TopicKey>("general");
  const [message, setMessage] = useState("");
  // Champ piège invisible (robots) : doit rester vide.
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // /contact?topic=privacy (liens des pages légales) présélectionne le sujet.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("topic");
    const match = TOPICS.find((item) => item.key === requested);
    if (match) setTopic(match.key);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(name, email, message);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), topic, message: message.trim(), website }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not send your message. Please try again.");
      }
      setSentTo(email.trim());
      setMessage("");
    } catch (sendError) {
      setFeedback(sendError instanceof Error ? sendError.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8" role="status">
        <span className="flex size-11 items-center justify-center rounded-full bg-white text-black">
          <CheckIcon className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Message sent</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Thanks for reaching out. We will reply to <span className="text-foreground">{sentTo}</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-white/15 px-5 text-sm font-medium transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            className={cn(inputClass, "min-h-[48px]")}
          />
          {errors.name ? <FieldError id="contact-name-error">{errors.name}</FieldError> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="contact-email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            className={cn(inputClass, "min-h-[48px]")}
          />
          {errors.email ? <FieldError id="contact-email-error">{errors.email}</FieldError> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span id="contact-topic-label" className="text-sm font-medium">
          Topic
        </span>
        <div role="radiogroup" aria-labelledby="contact-topic-label" className="flex flex-wrap gap-2">
          {TOPICS.map((item) => {
            const active = topic === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTopic(item.key)}
                className={cn(
                  "inline-flex min-h-[40px] cursor-pointer items-center rounded-full border px-4 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-white bg-white font-medium text-black"
                    : "border-white/15 text-muted-foreground hover:border-white/30 hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="contact-message" className="text-sm font-medium">
            Message
          </label>
          <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {message.length}/{MESSAGE_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="contact-message"
          rows={7}
          maxLength={MESSAGE_MAX_LENGTH}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="How can we help?"
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          className={cn(inputClass, "resize-y leading-6")}
        />
        {errors.message ? <FieldError id="contact-message-error">{errors.message}</FieldError> : null}
      </div>

      {/* Champ piège : hors écran et hors tabulation, ignoré par les humains. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      {feedback ? <AuthAlert>{feedback}</AuthAlert> : null}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-start"
      >
        {sending ? <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {sending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
