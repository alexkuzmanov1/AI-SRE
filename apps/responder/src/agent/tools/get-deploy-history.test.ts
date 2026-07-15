import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDeploys } from './get-deploy-history.js';
import { fixturesDir } from './fixtures.js';

test('readDeploys: newest-first', async () => {
  const res = await readDeploys();
  assert.equal(res.ok, true);
  const deploys = (res as { ok: true; data: { timestamp: string }[] }).data;
  assert.ok(deploys.length > 1);
  for (let i = 1; i < deploys.length; i++) {
    assert.ok(Date.parse(deploys[i - 1].timestamp) >= Date.parse(deploys[i].timestamp));
  }
});

test('readDeploys: missing file -> ok:true, data:[]', async () => {
  const res = await readDeploys(new URL('nope.json', fixturesDir));
  assert.equal(res.ok, true);
  assert.deepEqual((res as { ok: true; data: unknown }).data, []);
});
