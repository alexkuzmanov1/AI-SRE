import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { incidentsRoutes } from './ingest/incidents.controller.js';
import { streamRoutes } from './ingest/stream.controller.js';
import { prRoutes } from './git/pr.controller.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  // The dashboard (localhost:3002) calls us cross-origin, including EventSource.
  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(incidentsRoutes);
  app.register(streamRoutes);
  app.register(prRoutes);

  return app;
}
