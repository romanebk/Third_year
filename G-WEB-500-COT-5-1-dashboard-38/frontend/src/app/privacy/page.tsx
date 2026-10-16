import { EyeOffIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document";

export const metadata = {
  title: "Privacy Policy — Hubly",
  description: "What data Hubly collects, why, who it is shared with and how to control it.",
};

// Contenu aligné sur ce que l'application fait réellement (schéma Prisma,
// services externes appelés, stockage navigateur) : à mettre à jour avec eux.
const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    content: (
      <p>
        Hubly is a personal dashboard built as a student project at Epitech. It lets you create an account, connect
        external services and arrange widgets that show their data. This policy explains which personal data Hubly
        handles, why, and the choices you have. The administrator of the Hubly instance you are using is responsible
        for that data. For any question, use the <a href="/contact?topic=privacy">contact form</a>.
      </p>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    content: (
      <>
        <p>We only store what the features you use need:</p>
        <ul>
          <li>
            <strong>Account:</strong> your email address, your username, your password (stored only as a bcrypt hash,
            never in clear text), your role, the date your account was created and the date you accepted these
            documents.
          </li>
          <li>
            <strong>Sign-in with GitHub or Google:</strong> the provider account identifier, your name and avatar URL,
            and the access and refresh tokens the provider gives us. Tokens are encrypted (AES-256-GCM) before being
            stored.
          </li>
          <li>
            <strong>Dashboard:</strong> the widgets you add and what you type into them — for example city names,
            addresses, GitHub repositories, YouTube channels, Steam IDs, coin names or RSS feed links — plus their
            refresh rate and the services you connected.
          </li>
          <li>
            <strong>Settings:</strong> your weather city and unit, default GitHub repository, RSS feed and news topics.
          </li>
          <li>
            <strong>Location (optional):</strong> when you click &ldquo;Use my location&rdquo;, your browser shares
            your coordinates with our server, which only uses them to find the nearest city. The coordinates are not
            stored; only the city name is saved in your settings.
          </li>
          <li>
            <strong>Email confirmation:</strong> a one-time token, valid for 24 hours, sent to your address to confirm
            it.
          </li>
          <li>
            <strong>Password reset:</strong> when you ask for it, a one-time link valid for 1 hour is sent to your
            address. Only a fingerprint of that link is stored, and it is deleted once used or expired.
          </li>
          <li>
            <strong>Contact form:</strong> the name, email address and message you send are forwarded by email to the
            Hubly team so we can reply. They are not stored in the Hubly database.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "browser-storage",
    title: "Cookies and browser storage",
    content: (
      <>
        <p>Hubly uses no advertising or analytics cookies. It only stores:</p>
        <ul>
          <li>
            <strong>A session cookie</strong> that keeps you signed in. It cannot be read by page scripts and is
            removed when you sign out.
          </li>
          <li>
            <strong>Local storage</strong> in your browser for display preferences: your dashboard layout and the
            state of the timer. It never leaves your device.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use your data",
    content: (
      <ul>
        <li>To create your account, sign you in and keep your session secure.</li>
        <li>To fetch and display the data of the widgets you chose.</li>
        <li>To send the email that confirms your address.</li>
        <li>To let an administrator manage accounts (for example, disable an account that is being misused).</li>
      </ul>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: (
      <>
        <p>
          We never sell your data or use it for advertising. To display a widget, our server sends the information it
          needs to the matching provider:
        </p>
        <ul>
          <li>
            <strong>Weather:</strong> Open-Meteo receives the city name and its coordinates.
          </li>
          <li>
            <strong>Maps and location:</strong> OpenStreetMap Nominatim receives addresses, city names or coordinates;
            OSRM receives the coordinates of a route. The map itself is loaded by your browser from OpenStreetMap.
          </li>
          <li>
            <strong>GitHub:</strong> the GitHub API receives your requests, with your access token when you linked your
            account (needed for private repositories and security alerts).
          </li>
          <li>
            <strong>YouTube:</strong> the YouTube Data API receives channel names and countries. By using the YouTube
            widgets you also agree to the <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and
            Google processes that data under the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
          </li>
          <li>
            <strong>Google sign-in:</strong> Google only confirms your identity; we do not access your Google data.
          </li>
          <li>
            <strong>Steam, CoinGecko and RSS feeds:</strong> receive the Steam ID, coin or feed you entered.
          </li>
        </ul>
        <p>
          Images shown in widgets (news pictures, video thumbnails, avatars, map tiles) are loaded directly by your
          browser from those providers, which can see your IP address. Each provider applies its own privacy policy.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <ul>
        <li>Your account data is kept as long as your account exists.</li>
        <li>
          When you disconnect GitHub or Google from the Services page, the stored tokens for that provider are
          deleted.
        </li>
        <li>Confirmation tokens expire after 24 hours.</li>
        <li>
          When you delete your account, its settings, widgets, connected services and tokens are deleted with it,
          immediately and permanently.
        </li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    content: (
      <p>
        Passwords are hashed with bcrypt, third-party tokens are encrypted, sessions are signed, and every request to
        your data checks that you are signed in and that the data belongs to you. No system is perfectly secure, but
        we limit what we store to what Hubly needs.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    content: (
      <>
        <p>
          Depending on where you live (for example under the GDPR in the European Union), you can access, correct or
          delete your data, and withdraw a consent you gave. In Hubly:
        </p>
        <ul>
          <li>
            <strong>Access and correct:</strong> your profile, username, settings and widgets are visible and editable
            in the app.
          </li>
          <li>
            <strong>Withdraw access:</strong> disconnect a service from the Services page, and revoke Hubly in your
            GitHub or Google account settings.
          </li>
          <li>
            <strong>Delete:</strong> delete your account and all its data yourself from your Profile, under
            &ldquo;Delete account&rdquo;.
          </li>
          <li>
            <strong>Anything else:</strong> send a request through the <a href="/contact?topic=privacy">contact form</a>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        If this policy changes, the new version is published on this page with a new &ldquo;last updated&rdquo;
        date. Continuing to use Hubly after a change means you accept the updated policy.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      intro="How Hubly handles your personal data: what we collect, why we need it, who we share it with, and how you stay in control."
      updated="September 30, 2026"
      highlights={[
        {
          icon: <EyeOffIcon className="size-4" />,
          title: "No ads, no selling",
          text: "Your data is only used to run your dashboard. No tracking or advertising cookies.",
        },
        {
          icon: <ShieldIcon className="size-4" />,
          title: "Protected by default",
          text: "Passwords are hashed and connected-service tokens are encrypted.",
        },
        {
          icon: <UserIcon className="size-4" />,
          title: "You stay in control",
          text: "Edit your data in the app, disconnect services, or delete your account.",
        },
      ]}
      sections={sections}
      other={{ href: "/terms", label: "Read the Terms of Service" }}
    />
  );
}
