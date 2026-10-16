import ResetPasswordForm from "@/components/ui/reset-password-form";

export const metadata = {
  title: "Reset password — Hubly",
  // Le lien contient un jeton : ne pas l'indexer ni le transmettre en Referer.
  robots: { index: false },
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
