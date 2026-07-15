import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import type { BusMessage } from '../events/incident-bus.js';
import { subscribe } from '../events/incident-bus.js';
import { createIncident, getIncident, listSteps } from '../storage/incidents.repo.js';
import { runInvestigation, type MessagesClient } from './loop.js';

function usage(overrides: Partial<Anthropic.Usage> = {}): Anthropic.Usage {
  return {
    cache_creation: null,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    inference_geo: null,
    input_tokens: 100,
    output_tokens: 50,
    output_tokens_details: null,
    server_tool_use: null,
    service_tier: null,
    ...overrides,
  };
}

function textBlock(text: string): Anthropic.TextBlock {
  return { type: 'text', text, citations: null };
}

function toolUseBlock(name: string, input: unknown, id: string): Anthropic.ToolUseBlock {
  return { type: 'tool_use', id, name, input, caller: { type: 'direct' } };
}

function mockMessage(
  content: Anthropic.ContentBlock[],
  stop_reason: Anthropic.StopReason,
): Anthropic.Message {
  return {
    id: `msg_${randomUUID()}`,
    container: null,
    content,
    model: 'claude-test',
    role: 'assistant',
    stop_details: null,
    stop_reason,
    stop_sequence: null,
    type: 'message',
    usage: usage(),
  };
}

/** Client that returns each scripted response once, then repeats the last one. */
function scriptedClient(responses: Anthropic.Message[]): MessagesClient {
  let i = 0;
  return {
    messages: {
      async create() {
        const r = responses[Math.min(i, responses.length - 1)];
        i++;
        return r;
      },
    },
  };
}

const VALID_RCA = {
  root_cause: 'Null check missing after deploy b376c07',
  confidence: 0.9,
  suspect_commit: 'b376c07',
  evidence: ['b376c07 removed the null guard', 'users.service.ts:42 dereferences user.id'],
  proposed_patch:
    'diff --git a/src/users.service.ts b/src/users.service.ts\n' +
    '--- a/src/users.service.ts\n+++ b/src/users.service.ts\n' +
    '@@ -40,3 +40,4 @@\n' +
    '+  if (!user) return null;\n',
  postmortem_md: '## Postmortem\nMissing null check shipped in b376c07.',
};

function makeIncident() {
  const id = randomUUID();
  createIncident({
    id,
    fingerprint: randomUUID(),
    title: "Cannot read properties of undefined (reading 'id')",
    firstSeen: '2026-07-15T09:00:05.000Z',
    event: {
      service: 'demo-app',
      message: "Cannot read properties of undefined (reading 'id')",
      stack: 'TypeError: ...\n    at getUser (users.service.ts:42:18)',
      route: 'GET /users/:id',
      timestamp: '2026-07-15T09:00:05.000Z',
    },
  });
  return id;
}

test('happy path: valid RCA resolves the incident and records all three step types', async () => {
  const incidentId = makeIncident();
  const stepMsgs: BusMessage[] = [];
  const unsub = subscribe(incidentId, (m) => stepMsgs.push(m));

  const client = scriptedClient([
    mockMessage(
      [
        textBlock('Correlating deploy timing first.'),
        toolUseBlock('get_deploy_history', {}, 'tu1'),
      ],
      'tool_use',
    ),
    mockMessage([toolUseBlock('submit_rca', VALID_RCA, 'tu2')], 'tool_use'),
  ]);

  await runInvestigation(incidentId, { client });
  unsub();

  const incident = getIncident(incidentId);
  assert.equal(incident?.status, 'resolved');
  assert.deepEqual(incident?.rca, VALID_RCA);

  const persisted = listSteps(incidentId);
  const types = persisted.map((s) => s.type);
  assert.ok(types.includes('thinking'));
  assert.ok(types.includes('tool_call'));
  assert.ok(types.includes('tool_result'));

  // record() invariant: every persisted step was also published, index-for-index.
  const publishedSteps = stepMsgs.filter((m) => m.kind === 'step').map((m) => m.step);
  assert.deepEqual(
    publishedSteps.map((s) => s.index),
    persisted.map((s) => s.index),
  );
  assert.equal(stepMsgs.some((m) => m.kind === 'rca'), true);
  assert.equal(stepMsgs.some((m) => m.kind === 'done'), true);
});

test('error tool result does not crash the loop; model recovers and resolves', async () => {
  const incidentId = makeIncident();

  const client = scriptedClient([
    mockMessage([toolUseBlock('get_diff', { sha: 'not-a-sha' }, 'tu1')], 'tool_use'),
    mockMessage([toolUseBlock('submit_rca', VALID_RCA, 'tu2')], 'tool_use'),
  ]);

  await runInvestigation(incidentId, { client });

  const incident = getIncident(incidentId);
  assert.equal(incident?.status, 'resolved');

  const persisted = listSteps(incidentId);
  const errorResult = persisted.find((s) => s.type === 'tool_result' && s.tool === 'get_diff');
  assert.ok(errorResult, 'expected a tool_result step for the failed get_diff call');
  assert.match(errorResult!.output ?? '', /Invalid get_diff input|sha/i);
});

test('invalid RCA is rejected as a structured error and the model can retry', async () => {
  const incidentId = makeIncident();

  const invalidRca = { ...VALID_RCA, confidence: 5 };
  const client = scriptedClient([
    mockMessage([toolUseBlock('submit_rca', invalidRca, 'tu1')], 'tool_use'),
    mockMessage([toolUseBlock('submit_rca', VALID_RCA, 'tu2')], 'tool_use'),
  ]);

  await runInvestigation(incidentId, { client });

  const incident = getIncident(incidentId);
  assert.equal(incident?.status, 'resolved');
  assert.deepEqual(incident?.rca, VALID_RCA);

  const persisted = listSteps(incidentId);
  const rejected = persisted.find(
    (s) => s.type === 'tool_result' && s.tool === 'submit_rca' && /Invalid RCA/.test(s.output ?? ''),
  );
  assert.ok(rejected, 'expected the first invalid submit_rca to come back as a structured error');
});

test('hits the step cap gracefully: incident becomes failed, no infinite loop', async () => {
  const incidentId = makeIncident();

  // Every turn calls a non-terminal tool; never submits an RCA.
  const client: MessagesClient = {
    messages: {
      async create() {
        return mockMessage([toolUseBlock('get_deploy_history', {}, `tu_${randomUUID()}`)], 'tool_use');
      },
    },
  };

  await runInvestigation(incidentId, { client, maxSteps: 3 });

  const incident = getIncident(incidentId);
  assert.equal(incident?.status, 'failed');
  assert.equal(incident?.rca, undefined);
});

test('timeout: a stalled turn still ends in failed status, promise resolves', async () => {
  const incidentId = makeIncident();

  const client: MessagesClient = {
    messages: {
      async create() {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return mockMessage([toolUseBlock('get_deploy_history', {}, `tu_${randomUUID()}`)], 'tool_use');
      },
    },
  };

  await runInvestigation(incidentId, { client, timeoutMs: 10, maxSteps: 50 });

  const incident = getIncident(incidentId);
  assert.equal(incident?.status, 'failed');
});

test('unknown incident id: returns without throwing', async () => {
  await assert.doesNotReject(() => runInvestigation(randomUUID(), { client: scriptedClient([]) }));
});
