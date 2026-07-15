import Anthropic from '@anthropic-ai/sdk';
import type { AgentStep, RCA } from '@sre/shared';
import { env } from '../config/env.js';
import { toolSchemas, runTool, TERMINAL_TOOL } from './tools/index.js';
import {
  appendStep,
  setRca,
  setStatus,
  getIncident,
  getErrorEvent,
} from '../storage/incidents.repo.js';
import { publish } from '../events/incident-bus.js';
import { INVESTIGATOR_SYSTEM_PROMPT, buildIncidentBriefing } from './prompts/investigator.js';

const MAX_STEPS = 12;
const TIMEOUT_MS = 90_000;
const MAX_TOKENS_BUDGET = 200_000; // cumulative input+output ceiling; hard stop
const MAX_TOKENS_PER_TURN = 4096;

/** The narrow slice of the SDK client the loop actually calls — lets tests pass a plain mock. */
export interface MessagesClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export interface RunOptions {
  client?: MessagesClient;
  maxSteps?: number;
  timeoutMs?: number;
  tokenBudget?: number;
}

/**
 * Fire-and-forget entry point. Signature must stay sync `void` — the ingest
 * controller calls this inside a synchronous try/catch, which cannot catch a
 * rejected promise. Any failure from the async runner is contained here.
 */
export function startInvestigation(incidentId: string): void {
  void runInvestigation(incidentId).catch((err) => {
    console.error(`[loop] investigation crashed for ${incidentId}`, err);
    try {
      setStatus(incidentId, 'failed');
      publish(incidentId, { kind: 'failed', reason: String(err) });
      publish(incidentId, { kind: 'done' });
    } catch {
      // swallow — process must stay up
    }
  });
}

function record(step: Omit<AgentStep, 'index'>): AgentStep {
  const index = appendStep(step as AgentStep); // DB assigns the monotonic idx
  const full: AgentStep = { ...step, index };
  publish(step.incidentId, { kind: 'step', step: full });
  return full;
}

function giveUp(incidentId: string, reason: string): void {
  setStatus(incidentId, 'failed');
  publish(incidentId, { kind: 'failed', reason });
  publish(incidentId, { kind: 'done' });
}

export async function runInvestigation(incidentId: string, opts: RunOptions = {}): Promise<void> {
  const incident = getIncident(incidentId);
  if (!incident) return;

  const client: MessagesClient = opts.client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY() });
  const model = env.ANTHROPIC_MODEL();
  const maxSteps = opts.maxSteps ?? MAX_STEPS;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const tokenBudget = opts.tokenBudget ?? MAX_TOKENS_BUDGET;

  const event = getErrorEvent(incidentId);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: buildIncidentBriefing(incident, event) },
  ];

  let tokensUsed = 0;
  const deadline = Date.now() + timeoutMs;

  for (let step = 0; step < maxSteps; step++) {
    if (Date.now() > deadline) return giveUp(incidentId, 'timeout');
    if (tokensUsed > tokenBudget) return giveUp(incidentId, 'token budget exceeded');

    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS_PER_TURN,
      system: INVESTIGATOR_SYSTEM_PROMPT,
      tools: toolSchemas,
      messages,
    });
    tokensUsed += response.usage.input_tokens + response.usage.output_tokens;

    // Record any assistant thinking text as a distinct 'thinking' step.
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        record({ incidentId, type: 'thinking', text: block.text });
      }
    }

    // Keep the running transcript so the model sees its own prior turns.
    messages.push({ role: 'assistant', content: response.content });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUses.length === 0) {
      if (response.stop_reason === 'end_turn') {
        // Model talked but took no action — nudge it to act or finish.
        messages.push({
          role: 'user',
          content: 'Continue: use a tool, or call submit_rca to finish.',
        });
      }
      continue;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      record({ incidentId, type: 'tool_call', tool: use.name, input: use.input });

      const result = await runTool(use.name, use.input); // never throws

      const outputStr = result.ok
        ? typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data)
        : result.error;

      record({ incidentId, type: 'tool_result', tool: use.name, output: outputStr });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: outputStr,
        is_error: !result.ok,
      });

      if (use.name === TERMINAL_TOOL && result.ok) {
        const rca = result.data as RCA;
        setRca(incidentId, rca);
        setStatus(incidentId, 'resolved');
        publish(incidentId, { kind: 'rca', rca });
        publish(incidentId, { kind: 'done' });
        return;
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return giveUp(incidentId, 'max steps reached');
}
