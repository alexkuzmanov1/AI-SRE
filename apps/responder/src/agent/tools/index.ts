import type Anthropic from '@anthropic-ai/sdk';
import { type Tool, type ToolResult, err } from './types.js';

import submitRca from './submit-rca.js';
import getLogs from './get-logs.js';
import { recentCommits, diff } from './git-read.js';
import { read, search } from './source-read.js';
import getDeployHistory from './get-deploy-history.js';

/** Terminal tool name — Phase-4 loop ends the investigation when this succeeds. */
export const TERMINAL_TOOL = 'submit_rca';

const all: Tool[] = [submitRca, getLogs, recentCommits, diff, read, search, getDeployHistory];

/** name → Tool, built from each tool's own schema.name (single source of truth). */
export const registry: Record<string, Tool> = Object.fromEntries(
  all.map((t) => [t.schema.name, t]),
);

/** What the loop passes to the Anthropic Messages API `tools` param. */
export const toolSchemas: Anthropic.Tool[] = all.map((t) => t.schema);

/** Single dispatch point. Unknown tool → structured error, loop survives (AC). */
export async function runTool(name: string, input: unknown): Promise<ToolResult> {
  const tool = registry[name];
  if (!tool) return err(`Unknown tool: ${name}`);
  return tool.execute(input);
}
