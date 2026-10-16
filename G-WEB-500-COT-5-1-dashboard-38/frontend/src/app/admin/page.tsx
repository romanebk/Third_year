import { DashboardShell } from "@/components/dashboard-shell";
import AdminUsersManager from "@/components/ui/admin-users-manager";
import { requireAdmin } from "@/lib/auth-guard";

export const metadata = {
  title: "Admin — Hubly",
};

// Garde côté serveur via /api/auth/session (backend interne) : admin uniquement.
// AdminUsersManager reste la couche UX (boutons désactivés) et /api/users le
// vrai garde-fou (403 indépendant côté backend), inchangé par ce split.
export default async function AdminPage() {
  await requireAdmin();
  return (
    <DashboardShell isAdmin>
      <AdminUsersManager />
    </DashboardShell>
  );
}
