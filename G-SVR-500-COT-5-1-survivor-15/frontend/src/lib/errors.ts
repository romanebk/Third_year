import type { ApiErrorBody } from '@/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: { field: string; message: string }[];

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = body.status;
    this.code = body.code;
    this.fields = body.fields;
  }
}

export function messageForStatus(status: number, fallback?: string): string {
  switch (status) {
    case 401:
      return 'Identifiants incorrects. Vérifiez votre email et votre mot de passe.';
    case 403:
      return 'Vous n’avez pas les droits pour effectuer cette action.';
    case 404:
      return 'On n’a pas trouvé ce que vous cherchez. Réessayez ?';
    case 422:
      return fallback ?? 'Certains champs sont incomplets. Corrigez-les pour continuer.';
    case 500:
      return 'Un problème est survenu de notre côté. Réessayez dans un instant.';
    default:
      return fallback ?? 'La requête n’a pas abouti. Réessayez ?';
  }
}
