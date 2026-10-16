import { DashboardShell } from "@/components/dashboard-shell";
import SettingsView from "@/components/settings-view";
import { requireLogin } from "@/lib/auth-guard";

export const metadata = {
  title: "Settings — Hubly",
};

export default async function SettingsPage() {
  const session = await requireLogin();
  return (
    <DashboardShell isAdmin={session.user?.role === "ADMIN"}>
      <SettingsView />
    </DashboardShell>
  );
}