import { DashboardShell } from "@/components/dashboard-shell";
import ServicesManager from "@/components/ui/services-manager";
import { requireLogin } from "@/lib/auth-guard";

export const metadata = {
  title: "Services — Hubly",
};

export default async function ServicesPage() {
  const session = await requireLogin();
  return (
    <DashboardShell isAdmin={session.user?.role === "ADMIN"}>
      <ServicesManager />
    </DashboardShell>
  );
}