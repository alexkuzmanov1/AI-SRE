import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLogs, execute } from './get-logs.js';
import { fixturesDir } from './fixtures.js';

test('window covering the error burst -> 3 ERROR lines, no INFO/other-svc', async () => {
  const res = await readLogs('demo-app', {
    start: '2026-07-15T09:00:01.000Z',
    end: '2026-07-15T09:00:15.000Z',
  });
  assert.equal(res.ok, true);
  const data = (res as { ok: true; data: { level: string; service: string }[] }).data;
  assert.equal(data.length, 3);
  assert.ok(data.every((l) => l.level === 'ERROR' && l.service === 'demo-app'));
});

test('missing file -> ok:true, data:[]', async () => {
  const res = await readLogs(
    'demo-app',
    { start: '2026-07-15T09:00:00.000Z', end: '2026-07-15T09:00:15.000Z' },
    new URL('nope.json', fixturesDir),
  );
  assert.equal(res.ok, true);
  assert.deepEqual((res as { ok: true; data: unknown }).data, []);
});

test('bad input (no window) -> ok:false', async () => {
  const res = await execute({ service: 'demo-app' });
  assert.equal(res.ok, false);
});
