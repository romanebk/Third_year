import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '@/types';
import { getStoredRefreshToken, useSessionStore } from '@/store/session';

/**
 * Pendant la restauration de session (appel /auth/refresh au chargement,
 * voir main.tsx), `hydrated` est faux et `user` est encore null même pour
 * un utilisateur déjà connecté. Sans cet état intermédiaire, un rechargement
 * de page sur une route protégée renvoyait systématiquement vers /connexion
 * avant que la session ait eu le temps de se restaurer.
 */
function HydratingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-paper">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-forest" />
    </div>
  );
}

export function ProtectedRoute({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const user = useSessionStore((s) => s.user);
  const hydrated = useSessionStore((s) => s.hydrated);
  const location = useLocation();

  if (!hydrated && getStoredRefreshToken()) {
    return <HydratingScreen />;
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/connexion?redirect=${redirect}`} replace />;
  }

  if (!roles.includes(user.role)) {
    const home =
      user.role === 'employer' ? '/pro/tableau-de-bord' : user.role === 'admin' ? '/admin/moderation' : '/app';
    return <Navigate to={home} replace />;
  }

  if (user.role === 'employer' && user.status === 'pending' && location.pathname.includes('/offres/nouvelle')) {
    return <Navigate to="/pro/tableau-de-bord" replace />;
  }

  return children;
}
