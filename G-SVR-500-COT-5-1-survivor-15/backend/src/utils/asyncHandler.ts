import { Request, Response, NextFunction } from 'express';

/**
 * Enveloppe les handlers async pour router les rejets vers errorHandler.
*/
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };