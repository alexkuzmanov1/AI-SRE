import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../app.js';
import { createIncident, setPr } from '../storage/incidents.repo.js';

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

test('POST /api/incidents/:id/pr -> 404 when incident unknown', async () => {
  const app = buildApp();
  const res = await app.inject({ method: 'POST', url: `/api/incidents/${randomUUID()}/pr` });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test('POST /api/incidents/:id/pr -> 400 when incident has no RCA yet', async () => {
  const app = buildApp();
  const id = makeIncident(); // status: investigating, rca undefined
  const res = await app.inject({ method: 'POST', url: `/api/incidents/${id}/pr` });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /no RCA/);
  await app.close();
});

test('POST /api/incidents/:id/pr -> 200 with the stored PR when one already exists, no git/GitHub work', async () => {
  const app = buildApp();
  const id = makeIncident();
  setPr(id, { url: 'https://github.com/you/demo-app/pull/3', number: 3 });

  const res = await app.inject({ method: 'POST', url: `/api/incidents/${id}/pr` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().url, 'https://github.com/you/demo-app/pull/3');
  assert.equal(res.json().number, 3);
  await app.close();
});
