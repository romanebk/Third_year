import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, messageForStatus } from '@/lib/errors';
import { getStoredRefreshToken, useSessionStore } from '@/store/session';
import type { ApiErrorBody, AuthResponse, Role, User } from '@/types';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Convertit un rôle backend (JOBSEEKER/EMPLOYER/ADMIN) en rôle frontend (candidate/employer/admin).
 * Insensible à la casse : selon le chemin d'appel (intercepteur de réponse vs refreshAccessToken
 * en axios brut plus bas dans ce fichier), le rôle peut déjà arriver pré-normalisé en minuscule
 * ("employer") ou brut du backend en majuscule ("EMPLOYER"). Sans ça, un rôle déjà en minuscule
 * ne matche aucun case et retombe toujours sur candidate, quel que soit le vrai rôle.
 */
export function mapBackendRole(role: string): Role {
  switch (role.toUpperCase()) {
    case 'EMPLOYER':
      return 'employer';
    case 'ADMIN':
      return 'admin';
    default:
      return 'candidate';
  }
}

/** Convertit un rôle frontend (candidate/employer/admin) en rôle backend (JOBSEEKER/EMPLOYER/ADMIN). */
export function toBackendRole(role: Role | string): string {
  switch (role) {
    case 'employer':
      return 'EMPLOYER';
    case 'admin':
      return 'ADMIN';
    default:
      return 'JOBSEEKER';
  }
}

/** Normalise le user backend vers le modèle User du frontend ChomageGo. */
function normalizeUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id ?? ''),
    email: String(raw.email ?? ''),
    role: mapBackendRole(String(raw.role ?? 'candidate')),
    status: 'active',
    firstName: raw.firstName as string | undefined,
    lastName: raw.lastName as string | undefined,
    phone: raw.phone as string | undefined,
    companyName: raw.companyName as string | undefined,
    geoConsent: raw.geoConsent as boolean | undefined,
  } as User;
}

/** Normalise une réponse AuthResponse backend (tokens + user) pour le frontend. */
function normalizeAuthResponse(data: unknown): AuthResponse {
  const d = (data ?? {}) as Partial<AuthResponse> & Record<string, unknown>;
  const rawUser = (d.user ?? {}) as Record<string, unknown>;
  return {
    accessToken: String(d.accessToken ?? ''),
    refreshToken: String(d.refreshToken ?? ''),
    user: normalizeUser(rawUser),
  };
}

export const api = axios.create({
  baseURL: '/api',
  timeout: 12_000,
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('no-refresh');
  const { data } = await axios.post<AuthResponse>('/api/auth/refresh', { refreshToken });
  useSessionStore.getState().setTokens(data.accessToken, data.refreshToken);
  if (data.user) useSessionStore.getState().setUser(data.user);
  return data.accessToken;
}

api.interceptors.request.use((config) => {
  const token = useSessionStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const url = response.config.url ?? '';
    if (url.includes('/auth/') && response.data && typeof response.data === 'object') {
      response.data = normalizeAuthResponse(response.data);
    }
    return response;
  },
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0;
    const original = error.config as RetryConfig | undefined;

    if (status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const token = await refreshPromise;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        useSessionStore.getState().clear();
      }
    }

    const rawBody = error.response?.data as unknown;
    const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<
      string,
      unknown
    >;
    const nested: Partial<ApiErrorBody> = body.error
      ? (body.error as Record<string, unknown>)
      : body;
    const message = nested.message || messageForStatus(status, error.message);
    throw new ApiError({
      status: status || 500,
      code: nested.code ?? `http_${status || 500}`,
      message,
      fields: nested.fields as ApiErrorBody['fields'],
    });
  },
);
