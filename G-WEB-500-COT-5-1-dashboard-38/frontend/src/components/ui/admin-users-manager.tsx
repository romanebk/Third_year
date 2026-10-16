"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  disabled: boolean;
  emailVerified: string | null;
  createdAt: string;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

// admin/page.tsx garde la route côté serveur (requireAdmin(), cf.
// frontend/src/lib/auth-guard.ts) — ce composant ne rend donc jamais pour un
// compte non-admin. Il ne fait que récupérer son propre id (pour désactiver
// "self-delete" dans la table) et la liste ; /api/users reste le vrai
// garde-fou indépendant côté backend (requireAdminSession()).
export default function AdminUsersManager() {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  // Id de la ligne dont l'action (PATCH/DELETE) est en cours — désactive juste
  // ses boutons, pas toute la table, pour rester utilisable pendant l'attente.
  const [pendingId, setPendingId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/auth/session", { credentials: "include" }).then(
        (response) => response.json() as Promise<{ user?: { id: string } }>,
      ),
      fetch("/api/users", { credentials: "include" }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ users: AdminUser[] }>;
      }),
    ])
      .then(([session, data]) => {
        if (cancelled) return;
        setCurrentUserId(session.user?.id);
        setUsers(data.users ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the user list.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleDisabled(user: AdminUser) {
    const nextDisabled = !user.disabled;
    if (
      nextDisabled &&
      !window.confirm(`Disable ${user.email}? They will be signed out and unable to log in.`)
    ) {
      return;
    }

    setPendingId(user.id);
    setError(undefined);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: nextDisabled }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, disabled: nextDisabled } : entry)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this account.");
    } finally {
      setPendingId(undefined);
    }
  }

  async function toggleRole(user: AdminUser) {
    const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    const question =
      nextRole === "ADMIN"
        ? `Promote ${user.email} to admin? They will get full access to this page.`
        : `Remove admin rights from ${user.email}?`;
    if (!window.confirm(question)) return;

    setPendingId(user.id);
    setError(undefined);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      setUsers((current) =>
        current.map((entry) => (entry.id === user.id ? { ...entry, role: nextRole } : entry)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this account.");
    } finally {
      setPendingId(undefined);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return;

    setPendingId(user.id);
    setError(undefined);
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this account.");
    } finally {
      setPendingId(undefined);
    }
  }

  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const disabledCount = users.filter((user) => user.disabled).length;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage registered accounts. Disabling an account signs it out and blocks new logins.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total users" value={users.length} />
        <Stat label="Admins" value={adminCount} />
        <Stat label="Disabled" value={disabledCount} />
        <Stat label="Active" value={users.length - disabledCount} />
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <SpinnerIcon className="size-4 animate-spin" />
          Loading users…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">User</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isPending = pendingId === user.id;
                return (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{user.name ?? user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {user.role === "ADMIN" ? <CheckIcon className="size-3" /> : null}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          user.disabled
                            ? "bg-destructive/10 text-destructive"
                            : "bg-foreground text-background"
                        }`}
                      >
                        {user.disabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          disabled={isSelf || isPending}
                          title={isSelf ? "You cannot modify your own account" : undefined}
                          onClick={() => toggleRole(user)}
                        >
                          {isPending ? (
                            <SpinnerIcon className="size-3.5 animate-spin" />
                          ) : user.role === "ADMIN" ? (
                            "Demote"
                          ) : (
                            "Promote"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          disabled={isSelf || isPending}
                          title={isSelf ? "You cannot modify your own account" : undefined}
                          onClick={() => toggleDisabled(user)}
                        >
                          {isPending ? (
                            <SpinnerIcon className="size-3.5 animate-spin" />
                          ) : user.disabled ? (
                            "Enable"
                          ) : (
                            "Disable"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="cursor-pointer size-10"
                          disabled={isSelf || isPending}
                          title={isSelf ? "You cannot delete your own account" : "Delete account"}
                          aria-label={`Delete ${user.email}`}
                          onClick={() => deleteUser(user)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
