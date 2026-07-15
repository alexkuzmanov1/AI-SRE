import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from './submit-rca.js';
import type { RCA } from '@sre/shared';

const validRca: RCA = {
  root_cause: 'Null user lookup after schema migration dropped default id.',
  confidence: 0.9,
  suspect_commit: 'b376c07',
  evidence: ['users.service.ts:42 reads user.id without a null check'],
  proposed_patch:
    'diff --git a/src/users.service.ts b/src/users.service.ts\n' +
    '--- a/src/users.service.ts\n+++ b/src/users.service.ts\n' +
    '@@ -40,1 +40,1 @@\n-  return user.id;\n+  return user?.id;\n',
  postmortem_md: '# Postmortem\nRoot cause was...',
};

test('valid RCA -> ok:true, data equals input', async () => {
  const res = await execute(validRca);
  assert.equal(res.ok, true);
  assert.deepEqual((res as { ok: true; data: unknown }).data, validRca);
});

test('missing postmortem_md -> ok:false, error mentions it', async () => {
  const { postmortem_md, ...rest } = validRca;
  const res = await execute(rest);
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /postmortem_md/);
});

test('confidence out of range -> ok:false', async () => {
  const res = await execute({ ...validRca, confidence: 1.5 });
  assert.equal(res.ok, false);
});

test('empty proposed_patch -> ok:false', async () => {
  const res = await execute({ ...validRca, proposed_patch: '' });
  assert.equal(res.ok, false);
});

test('empty evidence -> ok:false', async () => {
  const res = await execute({ ...validRca, evidence: [] });
  assert.equal(res.ok, false);
});
