import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);

// C3 contract guard: the committed worked-patch example must stay something
// `git apply` accepts, since it's the reference for what submit_rca emits
// and this PR service consumes.
test('fixtures/example-patch.diff applies cleanly', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'sre-example-patch-'));
  await run('git', ['init', '-b', 'main', repo]);
  await run('git', ['-C', repo, 'config', 'user.email', 't@t.dev']);
  await run('git', ['-C', repo, 'config', 'user.name', 'Test']);
  await writeFile(join(repo, 'README.md'), '# demo\n');
  await run('git', ['-C', repo, 'add', '-A']);
  await run('git', ['-C', repo, 'commit', '-m', 'init']);

  const patchPath = resolve(import.meta.dirname, '../../fixtures/example-patch.diff');
  const patch = await readFile(patchPath, 'utf8');
  assert.match(patch, /^diff --git/);

  const patchFile = join(repo, '..', 'example-patch.diff');
  await writeFile(patchFile, patch);
  await run('git', ['-C', repo, 'apply', '--check', patchFile]);
});
