export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Non authentifié') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Données invalides') {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflit avec les données existantes') {
    super(409, message, 'CONFLICT');
  }
}
