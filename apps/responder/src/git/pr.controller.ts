import type { FastifyInstance } from 'fastify';
import { getIncident, setPr } from '../storage/incidents.repo.js';
import { openPullRequest, NoRcaError, PatchApplyError, DirtyRepoError } from './pr.service.js';

export async function prRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/incidents/:id/pr', async (request, reply) => {
    const { id } = request.params as { id: string };

    const incident = getIncident(id);
    if (!incident) {
      return reply.code(404).send({ error: 'incident not found' });
    }

    // Already opened (a prior call, or a losing double-click that lands
    // after the winner persisted) — return the existing PR, no git/GitHub work.
    if (incident.prUrl && incident.prNumber !== undefined) {
      return reply.code(200).send({
        url: incident.prUrl,
        number: incident.prNumber,
        branch: `sre/incident-${incident.id.slice(0, 8)}`,
      });
    }

    try {
      const result = await openPullRequest(incident);
      setPr(id, { url: result.url, number: result.number });
      return reply.code(201).send(result);
    } catch (e) {
      if (e instanceof NoRcaError) {
        return reply.code(400).send({ error: 'incident has no RCA yet' });
      }
      if (e instanceof PatchApplyError) {
        return reply.code(409).send({ error: 'patch failed to apply', git: e.message });
      }
      if (e instanceof DirtyRepoError) {
        return reply.code(409).send({ error: 'target repo has uncommitted changes', git: e.message });
      }
      app.log.error(e, `PR creation failed for incident ${id}`);
      return reply.code(502).send({ error: 'PR creation failed', detail: (e as Error).message });
    }
  });
}
