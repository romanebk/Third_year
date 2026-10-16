import http from 'http';
import { createApp } from './app';
import { loadEnv } from './config/env';
//Archivage des offres > 30j
import { startArchiveJob } from './modules/offers/offers.service';
import { initSocket } from './realtime/socket';
const env = loadEnv();
const app = createApp();
const httpServer = http.createServer(app);
initSocket(httpServer, env.CORS_ORIGIN);

httpServer.listen(env.PORT, () => {
  console.log(`GéoEmploi API, http://localhost:${env.PORT}`);
  console.log(`Documentation Swagger, http://localhost:${env.PORT}/api/docs`);
  console.log(`WebSocket (Socket.IO) sur le même port, CORS ${env.CORS_ORIGIN}`);
  startArchiveJob();
});
