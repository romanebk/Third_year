import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { api } from '@/lib/api';
import { getStoredRefreshToken, useSessionStore } from '@/store/session';
import type { AuthResponse } from '@/types';

async function restoreSession(): Promise<void> {
  const refresh = getStoredRefreshToken();
  if (!refresh) {
    useSessionStore.getState().markHydrated();
    return;
  }
  try {
    const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken: refresh });
    useSessionStore.getState().setSession(data.user, data.accessToken, data.refreshToken, true);
  } catch {
    useSessionStore.getState().clear();
  } finally {
    useSessionStore.getState().markHydrated();
  }
}

async function boot(): Promise<void> {
  // MSW desactive par defaut : on veut parler au vrai backend en local.
  // Repasser a true (ou VITE_USE_MOCKS=1) pour retrouver les mocks.
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === '1') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  } else if ('serviceWorker' in navigator) {
    // Nettoyage : un Service Worker MSW enregistré lors d'une session
    // précédente (avant ce gate, ou avec VITE_USE_MOCKS=1) reste actif dans
    // le navigateur indéfiniment et continue d'intercepter les requêtes
    // réseau avec des données mockées, même une fois les mocks désactivés
    // ici. Sans ce nettoyage, l'appli peut sembler "revenir" sur un compte
    // figé (mocké) quel que soit le vrai compte utilisé.
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }
  // Ne bloque plus le premier rendu : sur une connexion lente, attendre ici
  // laissait #root vide (page blanche) pendant tout l'appel /auth/refresh,
  // uniquement pour les utilisateurs déjà connectés (refresh token présent).
  // Le rendu part immédiatement ; ProtectedRoute affiche un état de
  // chargement tant que `hydrated` est faux, voir store/session.ts.
  void restoreSession();
}

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');

void boot();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
