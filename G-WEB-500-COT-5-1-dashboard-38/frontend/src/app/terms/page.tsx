import { CheckIcon, CloudIcon, UserIcon } from "@/components/icons";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";

export const metadata = {
  title: "Terms of Service — Hubly",
  description: "The rules for using Hubly and its connected services.",
};

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Accepting these terms",
    content: (
      <p>
        By creating an account or signing in with GitHub or Google, you agree to these Terms of Service and to the{" "}
        <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use Hubly.
      </p>
    ),
  },
  {
    id: "the-service",
    title: "The service",
    content: (
      <p>
        Hubly is a personal dashboard, built as a student project at Epitech, that shows data from external services
        (weather, news, GitHub, YouTube, Steam, crypto prices, maps) in widgets you choose. It is free and provided
        &ldquo;as is&rdquo;, without any guarantee of availability or of results.
      </p>
    ),
  },
  {
    id: "your-account",
    title: "Your account",
    content: (
      <ul>
        <li>Give a valid email address and keep your password to yourself; you are responsible for your account.</li>
        <li>An account is personal: do not share it or create accounts for other people without their consent.</li>
        <li>Your username is visible on your dashboard; do not choose one that is offensive or impersonates someone.</li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <p>When using Hubly, you agree not to:</p>
        <ul>
          <li>try to access another user&apos;s account or data, or bypass security measures;</li>
          <li>overload the service or the providers behind it, for example with automated requests;</li>
          <li>use Hubly for anything illegal or to harm other people;</li>
          <li>
            break the rules of the services you connect — including the{" "}
            <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, GitHub&apos;s and Google&apos;s
            terms, and the OpenStreetMap usage policies.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "third-party-content",
    title: "Third-party data",
    content: (
      <p>
        Widget content comes from external providers. Hubly does not control it and cannot guarantee that it is
        accurate, complete or up to date. Weather forecasts are estimates, and crypto prices are shown for information
        only — they are <strong>not financial advice</strong>. Links and images in widgets belong to their owners.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    content: (
      <p>
        Features, services and widgets may change, be interrupted or be removed at any time — for example when a
        provider changes its rules or stops responding. We try to show a clear error with a way to retry when that
        happens.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Suspension and deletion",
    content: (
      <p>
        You can stop using Hubly at any time and delete your account yourself from your Profile. An administrator may
        disable an account that breaks these terms; a disabled account can no longer sign in.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    content: (
      <p>
        To the extent permitted by law, Hubly and its authors are not liable for any damage resulting from the use of
        the service, from unavailable features, or from inaccurate third-party data.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    content: (
      <p>
        These terms may be updated. The new version is published on this page with a new &ldquo;last updated&rdquo;
        date. Continuing to use Hubly after a change means you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        Questions about these terms? Write to us through the <a href="/contact">contact form</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      intro="The rules for using Hubly: what the service offers, what we expect from you, and the limits of our responsibility."
      updated="September 30, 2026"
      highlights={[
        {
          icon: <CheckIcon className="size-4" />,
          title: "Free, provided as is",
          text: "A student project with no guarantee of availability.",
        },
        {
          icon: <UserIcon className="size-4" />,
          title: "Use it fairly",
          text: "One personal account, no abuse, and respect for the connected services.",
        },
        {
          icon: <CloudIcon className="size-4" />,
          title: "Third-party data",
          text: "Widget data comes from external providers — informational only.",
        },
      ]}
      sections={sections}
      other={{ href: "/privacy", label: "Read the Privacy Policy" }}
    />
  );
}
