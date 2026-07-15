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
  // Built by concatenation so the literal string doesn't appear anywhere in
  // this tracked file — git grep would otherwise match this very line.
  const noSuchQuery = ['zzz', 'no-such-string', 'zzz'].join('-');
  const res = await searchCode(noSuchQuery, cwd);
  assert.equal(res.ok, true);
  assert.deepEqual((res as { ok: true; data: unknown }).data, []);
});

test('searchCode: query starting with "-" is treated as a pattern, not a git-grep option', async () => {
  // Without `-e`, git parses a leading "-" as an option (e.g.
  // --open-files-in-pager, which runs a command). Built by concatenation
  // for the same self-match reason as above — plus it proves the literal
  // "-"-prefixed string isn't sitting anywhere else in the repo to match.
  const optionLikeQuery = '--open-files-in-pager=' + 'touch';
  const res = await searchCode(optionLikeQuery, cwd);
  assert.equal(res.ok, true);
  assert.deepEqual((res as { ok: true; data: unknown }).data, []);
});
