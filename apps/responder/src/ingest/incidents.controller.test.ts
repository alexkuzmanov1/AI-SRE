import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../app.js';
import { createIncident, setStatus } from '../storage/incidents.repo.js';
import type { Incident } from '@sre/shared';

function makeIncident(): string {
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

test('GET /api/incidents lists incidents, newest first', async () => {
  const app = buildApp();
  const id = makeIncident();

  const res = await app.inject({ method: 'GET', url: '/api/incidents' });
  assert.equal(res.statusCode, 200);
  const incidents = res.json() as Incident[];
  assert.ok(incidents.some((i) => i.id === id));
  assert.equal(incidents[0]!.id, id);

  await app.close();
});

test('GET /api/incidents?filter= splits open vs resolved', async () => {
  const app = buildApp();
  const openId = makeIncident();
  const resolvedId = makeIncident();
  setStatus(resolvedId, 'resolved');

  const open = (await app.inject({ method: 'GET', url: '/api/incidents?filter=open' })).json() as Incident[];
  assert.ok(open.some((i) => i.id === openId));
  assert.ok(!open.some((i) => i.id === resolvedId));

  const resolved = (await app.inject({ method: 'GET', url: '/api/incidents?filter=resolved' })).json() as Incident[];
  assert.ok(resolved.some((i) => i.id === resolvedId));
  assert.ok(!resolved.some((i) => i.id === openId));

  await app.close();
});

test('GET /api/incidents/:id returns the incident or 404', async () => {
  const app = buildApp();
  const id = makeIncident();

  const found = await app.inject({ method: 'GET', url: `/api/incidents/${id}` });
  assert.equal(found.statusCode, 200);
  assert.equal((found.json() as Incident).id, id);
  assert.equal((found.json() as Incident).status, 'investigating');

  const missing = await app.inject({ method: 'GET', url: `/api/incidents/${randomUUID()}` });
  assert.equal(missing.statusCode, 404);

  await app.close();
});

test('cross-origin requests from the dashboard are allowed', async () => {
  const app = buildApp();

  const preflight = await app.inject({
    method: 'OPTIONS',
    url: '/api/incidents',
    headers: {
      origin: 'http://localhost:3002',
      'access-control-request-method': 'GET',
    },
  });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers['access-control-allow-origin'], 'http://localhost:3002');

  const res = await app.inject({
    method: 'GET',
    url: '/api/incidents',
    headers: { origin: 'http://localhost:3002' },
  });
  assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3002');

  // The SSE route hijacks the reply and writes raw headers; make sure the
  // CORS header survives that path too. A resolved incident ends the stream
  // immediately, so inject() completes.
  const streamId = makeIncident();
  setStatus(streamId, 'resolved');
  const stream = await app.inject({
    method: 'GET',
    url: `/api/incidents/${streamId}/stream`,
    headers: { origin: 'http://localhost:3002' },
  });
  assert.equal(stream.statusCode, 200);
  assert.equal(stream.headers['access-control-allow-origin'], 'http://localhost:3002');

  await app.close();
});
