import type { FastifyInstance } from 'fastify';
import type { AgentStep } from '@sre/shared';
import { getIncident, listSteps } from '../storage/incidents.repo.js';
import { subscribe, type BusMessage } from '../events/incident-bus.js';

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/incidents/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!getIncident(id)) {
      return reply.code(404).send({ error: 'no such incident' });
    }

    // Tell Fastify we're taking the response over — otherwise it tries to
    // send its own reply on top of what we write to reply.raw below.
    reply.hijack();

    // Hijacking discards headers set on `reply` by hooks — carry them over,
    // or the browser's EventSource dies on a missing CORS allow-origin.
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // writeHead alone only queues the status line; without a write() following
    // it soon, Node won't put it on the wire. A client connecting before the
    // first step exists (nothing to write yet) would otherwise hang with no
    // response at all. Flush immediately so the connection opens right away.
    reply.raw.flushHeaders();

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Subscribe FIRST, buffering live messages until replay finishes — closes
    // the race where a step published between "read stored steps" and
    // "subscribe" would otherwise be lost forever.
    let replayed = false;
    let lastSentIdx = -1;
    const buffer: BusMessage[] = [];

    const dispatch = (msg: BusMessage): void => {
      switch (msg.kind) {
        case 'step':
          if (msg.step.index <= lastSentIdx) return; // de-dup vs replay
          lastSentIdx = msg.step.index;
          send('step', msg.step);
          break;
        case 'rca':
          send('rca', msg.rca);
          break;
        case 'failed':
          send('failed', { reason: msg.reason });
          break;
        case 'done':
          send('done', {});
          cleanup();
          reply.raw.end();
          break;
      }
    };

    const forward = (msg: BusMessage): void => {
      if (!replayed) {
        buffer.push(msg);
        return;
      }
      dispatch(msg);
    };

    const unsubscribe = subscribe(id, forward);
    const cleanup = (): void => unsubscribe();

    request.raw.on('close', cleanup);

    const stored: AgentStep[] = listSteps(id);
    for (const step of stored) {
      lastSentIdx = step.index;
      send('step', step);
    }

    const incident = getIncident(id)!;
    if (incident.status !== 'investigating') {
      if (incident.rca) send('rca', incident.rca);
      send('done', {});
      cleanup();
      reply.raw.end();
      return;
    }

    replayed = true;
    for (const msg of buffer) dispatch(msg);
  });
}
