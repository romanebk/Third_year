import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { loadEnv } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { apiRoutes } from './modules';
import { prisma } from './config/database';
import { NotFoundError } from './utils/errors';
import pkg from '../package.json';

export function createApp(): Express {
  const env = loadEnv();
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json());

  /**
   * GET /api/health
   * @openapi
   * /health:
   *   get:
   *     summary: État du service et de la base de données
   *     tags: [Système]
   *     responses:
   *       200:
   *         description: Service en ligne (status ok si BDD joignable, degraded sinon)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *                properties:
   *                  status: { type: string, example: ok }
   *                  version: { type: string, example: 0.1.0 }
   *                  service: { type: string, example: geoemploi-api }
   *                  database: { type: string, example: up | down }
   *                  uptime: { type: number, description: secondes depuis le démarrage }
   *       503:
   *         description: Service en ligne mais BDD injoignable
   */
  app.get('/api/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        version: pkg.version,
        service: 'geoemploi-api',
        database: 'up',
        uptime: process.uptime(),
      });
    } catch (err) {
      res.status(503).json({
        status: 'degraded',
        version: pkg.version,
        service: 'geoemploi-api',
        database: 'down',
        uptime: process.uptime(),
      });
    }
  });

  for (const route of apiRoutes) {
    app.use(route.path, route.router);
  }

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Route API inconnue : JSON propre (pas la page HTML par défaut d'Express).
  app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route introuvable : ${req.method} ${req.originalUrl}`));
  });

  const frontendPath = path.join(__dirname, '../../frontend');
  app.use(express.static(frontendPath));

  app.use(errorHandler);

  return app;
}
