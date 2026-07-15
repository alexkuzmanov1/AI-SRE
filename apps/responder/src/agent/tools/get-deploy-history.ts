import { readFile } from 'node:fs/promises';
import type Anthropic from '@anthropic-ai/sdk';
import { type Tool, type ToolResult, ok, err } from './types.js';
import { fixtureUrl } from './fixtures.js';

type Deploy = { sha: string; timestamp: string };

export async function readDeploys(file: URL = fixtureUrl('deploys.json')): Promise<ToolResult> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return ok([]); // missing/empty file → empty list, per AC
  }
  let deploys: Deploy[];
  try {
    deploys = JSON.parse(raw) as Deploy[];
  } catch {
    return err('deploys.json is not valid JSON');
  }
  deploys.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)); // newest first
  return ok(deploys);
}

export const schema: Anthropic.Tool = {
  name: 'get_deploy_history',
  description:
    'List deploys newest-first ({ sha, timestamp }). Correlate the incident ' +
    'timestamp with the most recent prior deploy to find the suspect commit.',
  input_schema: { type: 'object', properties: {}, required: [] },
};

export async function execute(_input: unknown): Promise<ToolResult> {
  return readDeploys();
}

export default { schema, execute } satisfies Tool;
