import type { FastifyInstance } from 'fastify';
import { getIncident } from '../storage/incidents.repo.js';
import { openPullRequest, NoRcaError, PatchApplyError } from './pr.service.js';

export async function prRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/incidents/:id/pr', async (request, reply) => {
    const { id } = request.params as { id: string };

    const incident = getIncident(id);
    if (!incident) {
      return reply.code(404).send({ error: 'incident not found' });
    }

    try {
      const result = await openPullRequest(incident);
      return reply.code(201).send(result);
    } catch (e) {
      if (e instanceof NoRcaError) {
        return reply.code(400).send({ error: 'incident has no RCA yet' });
      }
      if (e instanceof PatchApplyError) {
        return reply.code(409).send({ error: 'patch failed to apply', git: e.message });
      }
      app.log.error(e, `PR creation failed for incident ${id}`);
      return reply.code(502).send({ error: 'PR creation failed', detail: (e as Error).message });
    }
  });
}
