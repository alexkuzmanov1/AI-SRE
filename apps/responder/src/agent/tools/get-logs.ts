import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { type Tool, type ToolResult, ok, err } from './types.js';
import { fixtureUrl } from './fixtures.js';

const inputSchema = z.object({
  service: z.string().min(1),
  window: z.object({ start: z.string().min(1), end: z.string().min(1) }),
});

type LogLine = { timestamp: string; service: string; level: string; message: string };

/** Testable seam: reads any file URL, filters by service + window.
 *  Missing / unreadable file → ok([]) — an empty list, NOT a throw (AC). */
export async function readLogs(
  service: string,
  window: { start: string; end: string },
  file: URL = fixtureUrl('logs.json'),
): Promise<ToolResult> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return ok([]); // missing file → empty, per AC
  }
  let lines: LogLine[];
  try {
    lines = JSON.parse(raw) as LogLine[];
  } catch {
    return err('logs.json is not valid JSON');
  }
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const hit = lines.filter((l) => {
    const t = Date.parse(l.timestamp);
    return l.service === service && t >= start && t <= end;
  });
  return ok(hit);
}

export const schema: Anthropic.Tool = {
  name: 'get_logs',
  description:
    'Fetch log lines for a service within a time window. Use to see what ' +
    'errors fired and exactly when, so you can correlate them with a deploy.',
  input_schema: {
    type: 'object',
    properties: {
      service: { type: 'string' },
      window: {
        type: 'object',
        properties: { start: { type: 'string' }, end: { type: 'string' } },
        required: ['start', 'end'],
        description: 'ISO-8601 start/end timestamps',
      },
    },
    required: ['service', 'window'],
  },
};

export async function execute(input: unknown): Promise<ToolResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return err('Invalid get_logs input: ' + parsed.error.message);
  return readLogs(parsed.data.service, parsed.data.window);
}

export default { schema, execute } satisfies Tool;
