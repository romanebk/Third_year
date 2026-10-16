import { Router } from 'express';
import authRoutes from './auth/auth.routes';
import usersRoutes from './users/users.routes';
import offersRoutes from './offers/offers.routes';
import applicationsRoutes from './applications/applications.routes';
import proRoutes from './pro/pro.routes';
import notificationsRoutes from './notifications/notifications.routes';
import reportsRoutes from './reports/reports.routes';
import adminRoutes from './admin/admin.routes';
import tilesRoutes from './tiles/tiles.routes';

export interface ApiRoute {
  path: string;
  router: Router;
}

/**
 * Registre central des routes API.
 * Chaque branche feature/* modifie principalement son propre module.
 */
export const apiRoutes: ApiRoute[] = [
  { path: '/api/auth', router: authRoutes },
  { path: '/api/users', router: usersRoutes },
  { path: '/api/offers', router: offersRoutes },
  { path: '/api/applications', router: applicationsRoutes },
  { path: '/api/pro', router: proRoutes },
  { path: '/api/notifications', router: notificationsRoutes },
  { path: '/api/reports', router: reportsRoutes },
  { path: '/api/admin', router: adminRoutes },
  { path: '/api/tiles', router: tilesRoutes },
];
