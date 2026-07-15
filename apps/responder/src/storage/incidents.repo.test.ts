import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { ErrorEvent } from '@sre/shared';
import { createIncident, getErrorEvent, getIncident, appendStep, listSteps } from './incidents.repo.js';

const event: ErrorEvent = {
  service: 'demo-app',
  message: "Cannot read properties of undefined (reading 'id')",
  stack:
    "TypeError: Cannot read properties of undefined (reading 'id')\n" +
    '    at getUser (/srv/app/src/users.service.ts:42:18)\n' +
    '    at UsersController.findOne (/srv/app/src/users.controller.ts:20:29)',
  route: 'GET /users/:id',
  timestamp: '2026-07-15T09:00:05.000Z',
};

test('createIncident persists the full ErrorEvent; getErrorEvent round-trips stack + route', () => {
  const id = randomUUID();
  createIncident({
    id,
    fingerprint: randomUUID(),
    title: event.message.slice(0, 120),
    firstSeen: event.timestamp,
    event,
  });

  const stored = getErrorEvent(id);
  assert.deepEqual(stored, event);
  assert.match(stored!.stack, /users\.service\.ts:42:18/);
  assert.equal(stored!.route, 'GET /users/:id');
});

test('getErrorEvent: unknown incident -> undefined', () => {
  assert.equal(getErrorEvent(randomUUID()), undefined);
});

test('listSteps: returns steps newest-index-last, round-trips multi-line text and structured input/output', () => {
  const incidentId = randomUUID();
  createIncident({
    id: incidentId,
    fingerprint: randomUUID(),
    title: 'test incident',
    firstSeen: event.timestamp,
    event,
  });

  // `index` is assigned server-side by appendStep; any placeholder satisfies the type.
  appendStep({ incidentId, index: -1, type: 'thinking', text: 'line one\nline two' });
  appendStep({ incidentId, index: -1, type: 'tool_call', tool: 'get_diff', input: { sha: 'b376c07' } });
  appendStep({
    incidentId,
    index: -1,
    type: 'tool_result',
    tool: 'get_diff',
    output: 'diff --git a/x b/x\n+line',
  });

  const steps = listSteps(incidentId);
  assert.equal(steps.length, 3);
  assert.deepEqual(
    steps.map((s) => s.index),
    [0, 1, 2],
  );
  assert.equal(steps[0].text, 'line one\nline two');
  assert.deepEqual(steps[1].input, { sha: 'b376c07' });
  assert.equal(steps[2].output, 'diff --git a/x b/x\n+line');
});

test('listSteps: unknown incident -> empty array', () => {
  assert.deepEqual(listSteps(randomUUID()), []);
});

test('getIncident: unaffected by new column (rca still undefined until set)', () => {
  const id = randomUUID();
  createIncident({
    id,
    fingerprint: randomUUID(),
    title: 'x',
    firstSeen: event.timestamp,
    event,
  });
  const incident = getIncident(id);
  assert.equal(incident?.status, 'investigating');
  assert.equal(incident?.rca, undefined);
});
