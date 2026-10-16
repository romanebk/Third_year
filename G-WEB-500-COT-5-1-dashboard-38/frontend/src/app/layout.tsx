import type { Metadata } from "next";
import localFont from "next/font/local";

import "@fortawesome/fontawesome-svg-core/styles.css";

import "./globals.css";

// Fichiers auto-hébergés (sous-ensemble latin) plutôt que next/font/google : ce
// dernier télécharge les polices depuis fonts.googleapis.com AU MOMENT DU BUILD —
// sur ce projet, `docker-compose build` a échoué plusieurs fois de suite avec
// "NextFontError: Failed to fetch ... from Google Fonts" (réseau de build
// instable). next/font/local retire cette dépendance réseau du build entièrement
// (fichiers sous licence SIL OFL, libres de redistribution).
//
// Plus Jakarta Sans (variable, 200-800) remplace Inter comme police du site —
// pairing recommandé par la recherche design-system pour un dashboard SaaS.
const plusJakartaSans = localFont({
  src: [{ path: "./fonts/PlusJakartaSans-Variable.woff2", weight: "200 800", style: "normal" }],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [{ path: "./fonts/InstrumentSerif-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-instrument-serif",
  display: "swap",
});

const firaCode = localFont({
  // Police variable : un seul fichier couvre les poids 400-700 (cf. la CSS de
  // Google Fonts elle-même, qui sert la même URL pour ces 4 poids).
  src: [{ path: "./fonts/FiraCode-Variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Personal customizable dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${instrumentSerif.variable} ${firaCode.variable} bg-background font-sans text-foreground antialiased`}
      >
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}