import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { ErrorEvent } from '@sre/shared';
import { fingerprint } from './fingerprint.js';
import {
  createIncident,
  findByFingerprint,
  bumpCount,
  getIncident,
  listIncidents,
} from '../storage/incidents.repo.js';
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
  // Filter semantics mirror the dashboard's IncidentFilter: "open" is anything
  // not yet resolved; unknown/absent filters fall back to "all".
  app.get('/api/incidents', async (request) => {
    const { filter } = request.query as { filter?: string };
    const incidents = listIncidents();
    switch (filter) {
      case 'open':
        return incidents.filter((i) => i.status !== 'resolved');
      case 'resolved':
        return incidents.filter((i) => i.status === 'resolved');
      default:
        return incidents;
    }
  });

  app.get('/api/incidents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const incident = getIncident(id);
    if (!incident) {
      return reply.code(404).send({ error: 'incident not found' });
    }
    return incident;
  });

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
      event,
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
