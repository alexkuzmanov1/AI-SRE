import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileTool, searchCode } from './source-read.js';

// pnpm --filter runs with cwd = apps/responder; the git repo root is two up.
const cwd = resolve(process.cwd(), '../..');

test('readFileTool: valid path -> exact contents', async () => {
  const res = await readFileTool('CLAUDE.md', undefined, cwd);
  assert.equal(res.ok, true);
  assert.match(String((res as { ok: true; data: unknown }).data), /AI Incident/);
});

test('readFileTool: line range -> single line', async () => {
  const res = await readFileTool('package.json', { start: 1, end: 1 }, cwd);
  assert.equal(res.ok, true);
  const data = String((res as { ok: true; data: unknown }).data);
  assert.equal(data.split('\n').length, 1);
});

test('readFileTool: path traversal -> rejected', async () => {
  const res = await readFileTool('../../../etc/passwd', undefined, cwd);
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /escapes/);
});

test('readFileTool: missing file -> structured not found', async () => {
  const res = await readFileTool('does/not/exist.ts', undefined, cwd);
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /not found/);
});

test('searchCode: query with matches -> non-empty rows', async () => {
  const res = await searchCode('AI Incident Responder', cwd);
  assert.equal(res.ok, true);
  assert.ok((res as { ok: true; data: unknown[] }).data.length > 0);
});

test('searchCode: query with no matches -> ok:true, data:[]', async () => {
  const res = await searchCode('zzz-no-such-string-zzz', cwd);
  assert.equal(res.ok, true);
  assert.deepEqual((res as { ok: true; data: unknown }).data, []);
});
