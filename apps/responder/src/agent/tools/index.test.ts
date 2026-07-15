import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolSchemas, runTool } from './index.js';

const EXPECTED_NAMES = [
  'submit_rca',
  'get_logs',
  'get_recent_commits',
  'get_diff',
  'read_file',
  'search_code',
  'get_deploy_history',
];

test('toolSchemas: 7 entries, exact names, no duplicates', () => {
  assert.equal(toolSchemas.length, 7);
  const names = toolSchemas.map((s) => s.name);
  assert.deepEqual([...names].sort(), [...EXPECTED_NAMES].sort());
  assert.equal(new Set(names).size, names.length);
});

test('toolSchemas: each schema has name, description, object input_schema', () => {
  for (const s of toolSchemas) {
    assert.ok(s.name.length > 0);
    assert.ok(s.description && s.description.length > 0);
    assert.equal(s.input_schema.type, 'object');
  }
});

test('runTool: unknown name -> structured error, no throw', async () => {
  const res = await runTool('does_not_exist', {});
  assert.equal(res.ok, false);
  assert.match((res as { ok: false; error: string }).error, /Unknown tool/);
});

test('runTool: dispatch smoke test through get_deploy_history', async () => {
  const res = await runTool('get_deploy_history', {});
  assert.equal(res.ok, true);
});
