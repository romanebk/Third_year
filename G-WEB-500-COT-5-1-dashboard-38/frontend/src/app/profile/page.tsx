import { DashboardShell } from "@/components/dashboard-shell";
import ProfileView from "@/components/profile-view";
import { requireLogin } from "@/lib/auth-guard";

export const metadata = {
  title: "Profile — Hubly",
};

export default async function ProfilePage() {
  const session = await requireLogin();
  return (
    <DashboardShell isAdmin={session.user?.role === "ADMIN"}>
      <ProfileView />
    </DashboardShell>
  );
}