import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { type Tool, type ToolResult, ok, err } from './types.js';

const execFileAsync = promisify(execFile);

/** cwd override lets tests run against THIS repo instead of ../demo-app. */
function repoCwd(cwd?: string): string {
  return cwd ?? env.TARGET_REPO_PATH();
}

async function git(args: string[], cwd?: string): Promise<ToolResult> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoCwd(cwd),
      maxBuffer: 10 * 1024 * 1024,
    });
    return ok(stdout);
  } catch (e) {
    return err(`git ${args.join(' ')} failed: ${(e as Error).message}`);
  }
}

// ---- get_recent_commits ----
const commitsInput = z.object({ limit: z.number().int().min(1).max(50).default(10) });

export async function getRecentCommits(limit = 10, cwd?: string): Promise<ToolResult> {
  // %x1e record separator prefixes every commit — a merge commit emits no
  // file list and no blank line after its header, so splitting on "\n\n"
  // (the old approach) glued the next commit's header onto the merge
  // commit's file list and silently dropped it. \x1e can't appear in any of
  // these fields, so splitting on it is unambiguous regardless of shape.
  const fmt = '%x1e%H%x1f%an%x1f%aI%x1f%s';
  const res = await git(['log', `-n${limit}`, `--pretty=format:${fmt}`, '--name-only'], cwd);
  if (!res.ok) return res;
  const commits = String(res.data)
    .split('\x1e')
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const [header, ...files] = block.trim().split('\n');
      const [sha, author, date, subject] = header.split('\x1f');
      return { sha, author, date, subject, files: files.filter(Boolean) };
    });
  return ok(commits);
}

// ---- get_diff ----
// Restrict to a real sha shape so a value like "--output=/some/path" is
// rejected before it ever reaches execFile as a git option (option
// injection — execFile's array form blocks shell injection, not this).
const shaPattern = /^[0-9a-f]{7,40}$/i;
const diffInput = z.object({ sha: z.string().regex(shaPattern, 'must be a git commit sha') });

export async function getDiff(sha: string, cwd?: string): Promise<ToolResult> {
  if (!shaPattern.test(sha)) return err(`Invalid sha: ${sha}`);
  return git(['show', sha, '--patch', '--no-color'], cwd);
}

export const recentCommitsSchema: Anthropic.Tool = {
  name: 'get_recent_commits',
  description:
    'List recent commits (newest first) with sha, author, date, subject, and ' +
    'changed files. Use to find what shipped right before the incident.',
  input_schema: {
    type: 'object',
    properties: { limit: { type: 'number', minimum: 1, maximum: 50 } },
    required: [],
  },
};

export const diffSchema: Anthropic.Tool = {
  name: 'get_diff',
  description: 'Show the full unified diff for one commit sha. Use to see exactly what changed.',
  input_schema: {
    type: 'object',
    properties: { sha: { type: 'string' } },
    required: ['sha'],
  },
};

export const recentCommits: Tool = {
  schema: recentCommitsSchema,
  async execute(input) {
    const p = commitsInput.safeParse(input);
    if (!p.success) return err('Invalid get_recent_commits input: ' + p.error.message);
    return getRecentCommits(p.data.limit);
  },
};

export const diff: Tool = {
  schema: diffSchema,
  async execute(input) {
    const p = diffInput.safeParse(input);
    if (!p.success) return err('Invalid get_diff input: ' + p.error.message);
    return getDiff(p.data.sha);
  },
};
