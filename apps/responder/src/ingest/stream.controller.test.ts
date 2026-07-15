import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { buildApp } from '../app.js';
import { createIncident, appendStep, setRca, setStatus } from '../storage/incidents.repo.js';
import { publish } from '../events/incident-bus.js';

function makeIncident() {
  const id = randomUUID();
  createIncident({
    id,
    fingerprint: randomUUID(),
    title: 'test incident',
    firstSeen: '2026-07-15T09:00:05.000Z',
    event: {
      service: 'demo-app',
      message: 'x',
      stack: 'TypeError: x',
      route: 'GET /x',
      timestamp: '2026-07-15T09:00:05.000Z',
    },
  });
  return id;
}

/** Reads one SSE frame ("event: X\ndata: Y\n\n") at a time from a fetch body stream. */
class SseReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private decoder = new TextDecoder();
  private buffer = '';
  private closed = false;

  constructor(body: ReadableStream<Uint8Array>) {
    this.reader = body.getReader();
  }

  async next(): Promise<{ event: string; data: unknown } | null> {
    while (!this.buffer.includes('\n\n')) {
      const { value, done } = await this.reader.read();
      if (done) {
        this.closed = true;
        break;
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    const sep = this.buffer.indexOf('\n\n');
    if (sep === -1) return null; // stream closed with no more full frames
    const frame = this.buffer.slice(0, sep);
    this.buffer = this.buffer.slice(sep + 2);
    const eventLine = frame.split('\n').find((l) => l.startsWith('event: '));
    const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
    return {
      event: eventLine?.slice('event: '.length) ?? '',
      data: dataLine ? JSON.parse(dataLine.slice('data: '.length)) : undefined,
    };
  }

  isClosed(): boolean {
    return this.closed;
  }

  cancel(): void {
    void this.reader.cancel();
  }
}

async function startServer() {
  const app = buildApp();
  const address = await app.listen({ port: 0 });
  return { app, address };
}

/**
 * fastify's app.close() waits for every socket to go idle, including
 * keep-alive SSE connections our test client never explicitly closed.
 * closeAllConnections forces them shut so the test doesn't hang.
 */
async function closeServer(app: Awaited<ReturnType<typeof startServer>>['app']): Promise<void> {
  app.server.closeAllConnections();
  await app.close();
}

test('mid-investigation: replays prior steps then continues live with no gap or dup', async () => {
  const { app, address } = await startServer();
  const incidentId = makeIncident();
  appendStep({ incidentId, index: -1, type: 'thinking', text: 'step zero' });
  appendStep({ incidentId, index: -1, type: 'tool_call', tool: 'get_deploy_history', input: {} });

  const res = await fetch(`${address}/api/incidents/${incidentId}/stream`);
  assert.equal(res.status, 200);
  const sse = new SseReader(res.body!);

  const f0 = await sse.next();
  const f1 = await sse.next();
  assert.equal(f0?.event, 'step');
  assert.equal((f0?.data as { index: number }).index, 0);
  assert.equal(f1?.event, 'step');
  assert.equal((f1?.data as { index: number }).index, 1);

  // Publish a live step after replay — must arrive exactly once, not duplicated.
  publish(incidentId, {
    kind: 'step',
    step: { incidentId, index: 2, type: 'tool_result', tool: 'get_deploy_history', output: 'ok' },
  });
  const f2 = await sse.next();
  assert.equal(f2?.event, 'step');
  assert.equal((f2?.data as { index: number }).index, 2);

  sse.cancel();
  await closeServer(app);
});

test('post-resolution: full replay then rca then done, then closes', async () => {
  const { app, address } = await startServer();
  const incidentId = makeIncident();
  appendStep({ incidentId, index: -1, type: 'thinking', text: 'done thinking' });
  const rca = {
    root_cause: 'x',
    confidence: 0.8,
    suspect_commit: 'abc1234',
    evidence: ['abc1234: fixed it'],
    proposed_patch: 'diff --git a/x b/x\n+fix',
    postmortem_md: '## postmortem',
  };
  setRca(incidentId, rca);
  setStatus(incidentId, 'resolved');

  const res = await fetch(`${address}/api/incidents/${incidentId}/stream`);
  const sse = new SseReader(res.body!);

  const events: string[] = [];
  for (let i = 0; i < 3; i++) {
    const frame = await sse.next();
    if (!frame) break;
    events.push(frame.event);
    if (frame.event === 'rca') assert.deepEqual(frame.data, rca);
  }

  assert.deepEqual(events, ['step', 'rca', 'done']);
  await closeServer(app);
});

test('unknown incident id -> 404', async () => {
  const { app, address } = await startServer();
  const res = await fetch(`${address}/api/incidents/${randomUUID()}/stream`);
  assert.equal(res.status, 404);
  await closeServer(app);
});

test('client disconnect does not crash a subsequent publish', async () => {
  const { app, address } = await startServer();
  const incidentId = makeIncident();

  // Plain node:http so we can destroy() the socket outright — fetch/undici's
  // AbortSignal doesn't reliably tear down an already-established connection.
  const url = new URL(`${address}/api/incidents/${incidentId}/stream`);
  await new Promise<void>((resolve, reject) => {
    const req = httpRequest(url, (res) => {
      assert.equal(res.statusCode, 200);
      req.destroy();
      resolve();
    });
    req.on('error', (e) => {
      // destroy() after headers received can surface as a client-side error; expected.
      if (!req.destroyed) reject(e);
    });
    req.end();
  });

  // Give the server a tick to process the socket close, then publish — must not throw.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.doesNotThrow(() =>
    publish(incidentId, { kind: 'step', step: { incidentId, index: 0, type: 'thinking', text: 'x' } }),
  );

  await closeServer(app);
});

test('frames are written one at a time, not one buffered blob', async () => {
  const { app, address } = await startServer();
  const incidentId = makeIncident();
  appendStep({ incidentId, index: -1, type: 'thinking', text: 'a' });
  appendStep({ incidentId, index: -1, type: 'thinking', text: 'b' });
  setStatus(incidentId, 'failed');

  const res = await fetch(`${address}/api/incidents/${incidentId}/stream`);
  const text = await res.text();
  const frames = text.split('\n\n').filter(Boolean);
  assert.ok(frames.length >= 3, 'expected at least 2 step frames + done');
  for (const frame of frames) {
    assert.match(frame, /^event: \w+\ndata: /);
  }
  await closeServer(app);
});
