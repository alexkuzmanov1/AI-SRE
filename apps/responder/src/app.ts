import Fastify, { type FastifyInstance } from 'fastify';
import { incidentsRoutes } from './ingest/incidents.controller.js';
import { streamRoutes } from './ingest/stream.controller.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(incidentsRoutes);
  app.register(streamRoutes);

  return app;
}
