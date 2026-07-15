import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVESTIGATOR_SYSTEM_PROMPT, buildIncidentBriefing } from './investigator.js';

test('system prompt is non-empty and orders timing before code reading', () => {
  assert.ok(INVESTIGATOR_SYSTEM_PROMPT.length > 0);
  const deployIdx = INVESTIGATOR_SYSTEM_PROMPT.indexOf('get_deploy_history');
  const readIdx = INVESTIGATOR_SYSTEM_PROMPT.indexOf('read_file');
  assert.ok(deployIdx >= 0 && readIdx >= 0);
  assert.ok(deployIdx < readIdx, 'deploy correlation must be instructed before reading source');
  assert.match(INVESTIGATOR_SYSTEM_PROMPT, /submit_rca/);
});

test('buildIncidentBriefing: includes title, firstSeen, count', () => {
  const briefing = buildIncidentBriefing({
    title: 'TypeError: x',
    firstSeen: '2026-07-15T09:00:05.000Z',
    count: 3,
  });
  assert.match(briefing, /TypeError: x/);
  assert.match(briefing, /2026-07-15T09:00:05\.000Z/);
  assert.match(briefing, /3/);
});

test('buildIncidentBriefing: includes stack + route when event provided', () => {
  const briefing = buildIncidentBriefing(
    { title: 'x', firstSeen: 't', count: 1 },
    {
      service: 'demo-app',
      message: 'x',
      stack: 'TypeError: x\n    at getUser (users.service.ts:42:18)',
      route: 'GET /users/:id',
      timestamp: 't',
    },
  );
  assert.match(briefing, /GET \/users\/:id/);
  assert.match(briefing, /users\.service\.ts:42:18/);
});

test('buildIncidentBriefing: omits stack/route lines when event is absent', () => {
  const briefing = buildIncidentBriefing({ title: 'x', firstSeen: 't', count: 1 });
  assert.doesNotMatch(briefing, /Route:/);
  assert.doesNotMatch(briefing, /Stack:/);
});
