import { DashboardShell } from "@/components/dashboard-shell";
import DashboardOverview from "@/components/dashboard-overview";
import { requireLogin } from "@/lib/auth-guard";

export default async function DashboardPage() {
  const session = await requireLogin();
  return (
    <DashboardShell isAdmin={session.user?.role === "ADMIN"}>
      <DashboardOverview />
    </DashboardShell>
  );
}