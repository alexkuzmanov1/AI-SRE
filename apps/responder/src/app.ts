import Fastify, { type FastifyInstance } from 'fastify';
import { incidentsRoutes } from './ingest/incidents.controller.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(incidentsRoutes);

  return app;
}
