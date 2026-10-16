import Link from "next/link";

import ContactForm from "@/components/contact-form";
import { MailIcon, ShieldIcon, TrashIcon } from "@/components/icons";
import { AuthNav } from "@/components/ui/auth-nav";

export const metadata = {
  title: "Contact — Hubly",
  description: "Ask a question, report a bug or make a request about your data.",
};

const REASONS = [
  {
    icon: <ShieldIcon className="size-4" />,
    title: "Privacy and your data",
    text: (
      <>
        Ask what we store about you or request a correction. See the{" "}
        <Link href="/privacy" className="text-foreground underline underline-offset-4 hover:no-underline">
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    icon: <TrashIcon className="size-4" />,
    title: "Deleting your account",
    text: (
      <>
        You can do it yourself at any time from your{" "}
        <Link href="/profile" className="text-foreground underline underline-offset-4 hover:no-underline">
          Profile
        </Link>
        , under &ldquo;Delete account&rdquo;.
      </>
    ),
  },
  {
    icon: <MailIcon className="size-4" />,
    title: "Questions and bugs",
    text: <>Something doesn&apos;t work or isn&apos;t clear? Tell us what happened and on which page.</>,
  },
];

export default function ContactPage() {
  return (
    <>
      <AuthNav ctaHref="/login" ctaLabel="Sign in" />
      <main className="mx-auto grid w-full max-w-[1400px] gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-10 lg:py-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Contact</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Get in touch</h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            A question, a bug or a request about your data? Send us a message and the Hubly team will get back to you
            by email.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            {REASONS.map((reason) => (
              <li key={reason.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-inset ring-white/10"
                  aria-hidden="true"
                >
                  {reason.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold">{reason.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{reason.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ContactForm />
      </main>
    </>
  );
}
