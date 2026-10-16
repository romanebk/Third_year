import { create } from 'zustand';
import type { PendingAction, User } from '@/types';

/**
 * Seul le refresh token est persisté.
 * « Rester connecté » → localStorage (`cg_refresh`) pour survivre à la fermeture du navigateur.
 * Sinon → sessionStorage, vidé à la fermeture de l’onglet.
 * L’access token reste en mémoire : plus courte durée de vie, surface XSS réduite.
 */
export const REFRESH_STORAGE_KEY = 'cg_refresh';
const GUEST_VIEWS_KEY = 'cg_guest_views';

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* quota / mode privé */
  }
}

interface SessionState {
  user: User | null;
  accessToken: string | null;
  guestViews: number;
  pendingAction: PendingAction | null;
  hydrated: boolean;
  setSession: (user: User, accessToken: string, refreshToken: string, remember: boolean) => void;
  setTokens: (accessToken: string, refreshToken?: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
  bumpGuestView: () => number;
  setPendingAction: (action: PendingAction | null) => void;
  markHydrated: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  user: null,
  accessToken: null,
  guestViews: Number(readStorage(sessionStorage, GUEST_VIEWS_KEY) ?? '0'),
  pendingAction: null,
  hydrated: false,
  setSession: (user, accessToken, refreshToken, remember) => {
    writeStorage(remember ? localStorage : sessionStorage, REFRESH_STORAGE_KEY, refreshToken);
    if (!remember) writeStorage(localStorage, REFRESH_STORAGE_KEY, null);
    set({ user, accessToken });
  },
  setTokens: (accessToken, refreshToken) => {
    if (refreshToken) writeStorage(localStorage, REFRESH_STORAGE_KEY, refreshToken);
    set({ accessToken });
  },
  setUser: (user) => set({ user }),
  clear: () => {
    writeStorage(localStorage, REFRESH_STORAGE_KEY, null);
    writeStorage(sessionStorage, REFRESH_STORAGE_KEY, null);
    set({ user: null, accessToken: null, pendingAction: null });
  },
  bumpGuestView: () => {
    const next = get().guestViews + 1;
    writeStorage(sessionStorage, GUEST_VIEWS_KEY, String(next));
    set({ guestViews: next });
    return next;
  },
  setPendingAction: (pendingAction) => set({ pendingAction }),
  markHydrated: () => set({ hydrated: true }),
}));

export function getStoredRefreshToken(): string | null {
  return readStorage(localStorage, REFRESH_STORAGE_KEY) ?? readStorage(sessionStorage, REFRESH_STORAGE_KEY);
}
