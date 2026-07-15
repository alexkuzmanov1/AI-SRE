import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint } from './fingerprint.js';
import type { ErrorEvent } from '@sre/shared';

const base: ErrorEvent = {
  service: 'demo-app',
  message: "Cannot read properties of undefined (reading 'id')",
  stack:
    "TypeError: Cannot read properties of undefined (reading 'id')\n" +
    '    at getUser (/srv/app/src/users.service.ts:42:18)\n' +
    '    at UsersController.findOne (/srv/app/src/users.controller.ts:20:29)',
  route: 'GET /users/:id',
  timestamp: '2026-07-15T09:00:00.000Z',
};

test('same error 20x → exactly one fingerprint', () => {
  const hashes = new Set<string>();
  for (let i = 0; i < 20; i++) hashes.add(fingerprint(base));
  assert.equal(hashes.size, 1);
});

test('two different errors → two fingerprints', () => {
  const other: ErrorEvent = { ...base, message: 'Database connection timeout' };
  assert.notEqual(fingerprint(base), fingerprint(other));
});

test('same crash, different line numbers / paths / uuids → same fingerprint', () => {
  const noisy: ErrorEvent = {
    ...base,
    stack:
      "TypeError: Cannot read properties of undefined (reading 'id')\n" +
      '    at getUser (/home/ci/build-3f2504e0/users.service.ts:99:2)\n' +
      '    at UsersController.findOne (/home/ci/build-3f2504e0/users.controller.ts:7:41)',
  };
  assert.equal(fingerprint(base), fingerprint(noisy));
});

test('deterministic across calls', () => {
  assert.equal(fingerprint(base), fingerprint(base));
});
