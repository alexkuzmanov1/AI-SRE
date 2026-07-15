import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ErrorEvent } from '@sre/shared';
import { fingerprint } from './fingerprint.js';
import { createIncident, findByFingerprint, bumpCount } from '../storage/incidents.repo.js';
import { startInvestigation } from '../agent/loop.js';

function validateErrorEvent(body: unknown): ErrorEvent | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const fields = ['service', 'message', 'stack', 'route', 'timestamp'] as const;
  for (const f of fields) {
    if (typeof b[f] !== 'string' || (b[f] as string).length === 0) return null;
  }
  return {
    service: b.service as string,
    message: b.message as string,
    stack: b.stack as string,
    route: b.route as string,
    timestamp: b.timestamp as string,
  };
}

export async function incidentsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/incidents', async (request, reply) => {
    const event = validateErrorEvent(request.body);
    if (!event) {
      return reply.code(400).send({ error: 'invalid ErrorEvent' });
    }

    const fp = fingerprint(event);

    const existing = findByFingerprint(fp);
    if (existing) {
      bumpCount(existing.id);
      return reply.code(202).send({ incidentId: existing.id });
    }

    const id = randomUUID();
    createIncident({
      id,
      fingerprint: fp,
      title: event.message.slice(0, 120),
      firstSeen: event.timestamp,
    });

    setImmediate(() => {
      try {
        startInvestigation(id);
      } catch (err) {
        app.log.error(err, `investigation failed to start for incident ${id}`);
      }
    });
    return reply.code(202).send({ incidentId: id });
  });
}
