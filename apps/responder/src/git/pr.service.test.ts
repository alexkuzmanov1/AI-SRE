import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openPullRequest, NoRcaError, PatchApplyError, type OpenPrDeps } from './pr.service.js';
import type { Incident } from '@sre/shared';

const run = promisify(execFile);

// Creates a bare "origin" + a working clone with one commit on main, so
// `git push` has somewhere real to land without touching GitHub.
async function makeRepoPair(): Promise<{ origin: string; work: string }> {
  const root = await mkdtemp(join(tmpdir(), 'sre-test-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  await run('git', ['init', '--bare', '-b', 'main', origin]);
  await run('git', ['clone', origin, work]);
  await run('git', ['-C', work, 'config', 'user.email', 't@t.dev']);
  await run('git', ['-C', work, 'config', 'user.name', 'Test']);
  await writeFile(join(work, 'README.md'), '# demo\n');
  await run('git', ['-C', work, 'add', '-A']);
  await run('git', ['-C', work, 'commit', '-m', 'init']);
  await run('git', ['-C', work, 'push', 'origin', 'main']);
  return { origin, work };
}

function incidentWith(patch: string | undefined): Incident {
  return {
    id: 'abcd1234-0000',
    fingerprint: 'fp',
    status: 'resolved',
    title: 'Null deref in /pay',
    firstSeen: '2026-07-16T00:00:00Z',
    count: 1,
    rca:
      patch === undefined
        ? undefined
        : {
            root_cause: 'x',
            confidence: 0.9,
            suspect_commit: 'deadbeef',
            evidence: ['e'],
            proposed_patch: patch,
            postmortem_md: '## Postmortem\nbody',
          },
  };
}

// Fake Octokit that records the pulls.create call instead of hitting GitHub.
function fakeOctokit(calls: unknown[]): NonNullable<OpenPrDeps['octokit']> {
  return {
    rest: {
      pulls: {
        create: async (args: unknown) => {
          calls.push(args);
          return { data: { html_url: 'https://github.com/you/demo-app/pull/1', number: 1 } };
        },
      },
    },
  } as unknown as NonNullable<OpenPrDeps['octokit']>;
}

test('opens a PR: applies patch, commits, pushes, calls pulls.create with postmortem body', async () => {
  const { origin, work } = await makeRepoPair();
  const patch =
    'diff --git a/fix.txt b/fix.txt\nnew file mode 100644\nindex 0000000..e69de29\n' +
    '--- /dev/null\n+++ b/fix.txt\n@@ -0,0 +1 @@\n+fixed\n';
  const calls: Record<string, unknown>[] = [];
  const res = await openPullRequest(incidentWith(patch), {
    repoPath: work,
    octokit: fakeOctokit(calls),
    targetRepo: 'you/demo-app',
    baseBranch: 'main',
  });

  assert.equal(res.number, 1);
  assert.match(res.branch, /^sre\/incident-abcd1234$/);
  assert.equal(calls[0]!.body, '## Postmortem\nbody');

  const { stdout } = await run('git', ['-C', origin, 'branch', '--list', res.branch]);
  assert.match(stdout, /sre\/incident-abcd1234/);
});

test('bad patch -> PatchApplyError, nothing pushed', async () => {
  const { origin, work } = await makeRepoPair();
  const bad =
    'diff --git a/missing.txt b/missing.txt\n--- a/missing.txt\n+++ b/missing.txt\n' +
    '@@ -1 +1 @@\n-old\n+new\n';
  const calls: unknown[] = [];
  await assert.rejects(
    openPullRequest(incidentWith(bad), {
      repoPath: work,
      octokit: fakeOctokit(calls),
      targetRepo: 'you/demo-app',
    }),
    PatchApplyError,
  );
  assert.equal(calls.length, 0);

  const { stdout } = await run('git', ['-C', origin, 'for-each-ref', 'refs/heads/']);
  assert.doesNotMatch(stdout, /sre\/incident/);
});

test('no RCA -> NoRcaError, before any git runs', async () => {
  await assert.rejects(
    openPullRequest(incidentWith(undefined), { repoPath: '/nonexistent' }),
    NoRcaError,
  );
});
