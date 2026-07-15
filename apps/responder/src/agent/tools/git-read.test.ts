import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getRecentCommits, getDiff } from './git-read.js';

const execFileAsync = promisify(execFile);

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

test('getDiff: malformed sha -> ok:false, rejected before reaching git', async () => {
  const res = await getDiff('deadbeef-not-a-sha', cwd);
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /Invalid sha/);
});

test('getDiff: option-injection sha -> rejected before reaching git', async () => {
  const res = await getDiff('--output=/tmp/pwned', cwd);
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /Invalid sha/);
});

test('getRecentCommits: no commit swallowed across a merge commit', async () => {
  // This repo's history has real merges (e.g. "Merge pull request #3...").
  // Get the ground-truth sha list straight from git, independent of our
  // parser, and require getRecentCommits to return exactly the same shas
  // in the same order — the old "\n\n" split silently dropped the commit
  // right after a merge because merge commits emit no --name-only lines
  // and no blank-line separator.
  const n = 10;
  const { stdout } = await execFileAsync('git', ['log', `-n${n}`, '--pretty=format:%H'], { cwd });
  const expectedShas = stdout.split('\n').filter(Boolean);
  assert.ok(expectedShas.length >= 4, 'need enough history for this test to be meaningful');

  const res = await getRecentCommits(n, cwd);
  assert.equal(res.ok, true);
  const commits = (res as { ok: true; data: { sha: string }[] }).data;
  assert.deepEqual(
    commits.map((c) => c.sha),
    expectedShas,
  );
});
