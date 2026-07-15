import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { getRecentCommits, getDiff } from './git-read.js';

// pnpm --filter runs with cwd = apps/responder; the git repo root is two up.
const cwd = resolve(process.cwd(), '../..');

test('getRecentCommits: newest-first, well-formed shas', async () => {
  const res = await getRecentCommits(3, cwd);
  assert.equal(res.ok, true);
  const commits = (res as { ok: true; data: { sha: string; subject: string }[] }).data;
  assert.ok(commits.length > 0 && commits.length <= 3);
  for (const c of commits) {
    assert.match(c.sha, /^[0-9a-f]{40}$/);
    assert.ok(c.subject.length > 0);
  }
});

test('getDiff: valid sha -> unified diff', async () => {
  const commitsRes = await getRecentCommits(1, cwd);
  const [{ sha }] = (commitsRes as { ok: true; data: { sha: string }[] }).data;
  const res = await getDiff(sha, cwd);
  assert.equal(res.ok, true);
  assert.match(String((res as { ok: true; data: unknown }).data), /diff --git/);
});

test('getDiff: bad sha -> ok:false, error mentions git', async () => {
  const res = await getDiff('deadbeef-not-a-sha', cwd);
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /git/);
});
