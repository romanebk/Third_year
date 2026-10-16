import { redirect } from "next/navigation";

import Login16 from "@/components/ui/login-16";
import { getBackendSession } from "@/lib/auth-guard";

// NextAuth renvoie toute erreur OAuth vers pages.error (/login), y compris
// quand un utilisateur DÉJÀ connecté liait un compte tiers depuis /services
// (consentement refusé chez GitHub, callback invalide...). Dans ce
// cas, la page de connexion n'a aucun sens : on le ramène sur /services, qui
// affiche l'erreur de liaison.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (error) {
    const session = await getBackendSession();
    if (session.user?.id) redirect(`/services?link_error=${encodeURIComponent(error)}`);
  }
  return <Login16 />;
}
