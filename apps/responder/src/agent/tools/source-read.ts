import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { type Tool, type ToolResult, ok, err } from './types.js';

const execFileAsync = promisify(execFile);

/** Resolve userPath under repoRoot; reject anything that escapes it. */
function safeResolve(repoRoot: string, userPath: string): string | null {
  const root = resolve(repoRoot);
  const target = resolve(root, userPath);
  if (target !== root && !target.startsWith(root + sep)) return null; // traversal
  return target;
}

const readInput = z.object({
  path: z.string().min(1),
  start: z.number().int().min(1).optional(),
  end: z.number().int().min(1).optional(),
});

export async function readFileTool(
  path: string,
  range?: { start?: number; end?: number },
  repoRoot: string = env.TARGET_REPO_PATH(),
): Promise<ToolResult> {
  const target = safeResolve(repoRoot, path);
  if (!target) return err(`Path escapes repo root, rejected: ${path}`);
  let content: string;
  try {
    content = await readFile(target, 'utf8');
  } catch {
    return err(`File not found: ${path}`); // structured, not a throw
  }
  if (range?.start || range?.end) {
    const lines = content.split('\n');
    content = lines.slice((range.start ?? 1) - 1, range.end ?? lines.length).join('\n');
  }
  return ok(content);
}

const searchInput = z.object({ query: z.string().min(1) });

export async function searchCode(
  query: string,
  repoRoot: string = env.TARGET_REPO_PATH(),
): Promise<ToolResult> {
  try {
    // git grep: fast, repo-scoped, line numbers. -F = fixed string (no regex
    // injection). -e <query> forces query to be treated as a pattern, not a
    // git-grep option — without it a query starting with "-" (e.g.
    // "--open-files-in-pager=...") is parsed as an option, and the error
    // text agents investigate can be attacker-influenced.
    const { stdout } = await execFileAsync('git', ['grep', '-n', '-F', '-e', query], {
      cwd: resolve(repoRoot),
      maxBuffer: 5 * 1024 * 1024,
    });
    return ok(stdout.split('\n').filter(Boolean));
  } catch (e) {
    // git grep exits 1 when there are NO matches — that's a valid empty result.
    if ((e as { code?: number }).code === 1) return ok([]);
    return err(`search_code failed: ${(e as Error).message}`);
  }
}

export const readFileSchema: Anthropic.Tool = {
  name: 'read_file',
  description:
    'Read a source file from the target repo, optionally a line range. Use to ' +
    'confirm a suspected bug in the actual code.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'repo-relative path' },
      start: { type: 'number', description: '1-based start line (optional)' },
      end: { type: 'number', description: '1-based end line (optional)' },
    },
    required: ['path'],
  },
};

export const searchCodeSchema: Anthropic.Tool = {
  name: 'search_code',
  description: 'Grep the target repo for a fixed string. Returns file:line:match rows.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
};

export const read: Tool = {
  schema: readFileSchema,
  async execute(input) {
    const p = readInput.safeParse(input);
    if (!p.success) return err('Invalid read_file input: ' + p.error.message);
    return readFileTool(p.data.path, { start: p.data.start, end: p.data.end });
  },
};

export const search: Tool = {
  schema: searchCodeSchema,
  async execute(input) {
    const p = searchInput.safeParse(input);
    if (!p.success) return err('Invalid search_code input: ' + p.error.message);
    return searchCode(p.data.query);
  },
};
