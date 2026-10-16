import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError } from '../utils/errors';

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Authentification requise'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Rôle insuffisant'));
      return;
    }

    next();
  };
}

export const requireJobseeker = requireRoles(Role.JOBSEEKER);
export const requireEmployer = requireRoles(Role.EMPLOYER);
export const requireAdmin = requireRoles(Role.ADMIN);
