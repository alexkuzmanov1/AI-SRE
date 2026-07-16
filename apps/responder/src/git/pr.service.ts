import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Octokit } from '@octokit/rest';
import type { Incident } from '@sre/shared';
import { env } from '../config/env.js';

const execFileAsync = promisify(execFile);

/** No RCA on the incident yet — controller maps this to 400. */
export class NoRcaError extends Error {}
/** `git apply` rejected the patch — controller maps this to 409, nothing pushed. */
export class PatchApplyError extends Error {}

export interface OpenPrDeps {
  repoPath?: string;
  octokit?: Pick<Octokit, 'rest'>;
  targetRepo?: string;
  baseBranch?: string;
}

export interface PrResult {
  url: string;
  branch: string;
  number: number;
}

// Throws on non-zero exit (unlike the ToolResult-returning `git` helper in
// git-read.ts) — we want exceptions here so the try/catch below can turn an
// apply failure into a typed PatchApplyError.
async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

function ensureTrailingNewline(patch: string): string {
  return patch.endsWith('\n') ? patch : patch + '\n';
}

function prTitle(incident: Incident): string {
  return `[AI-SRE] Fix: ${incident.title}`.slice(0, 120);
}

function commitMessage(incident: Incident, rca: NonNullable<Incident['rca']>): string {
  return (
    `fix: ${incident.title}\n\n` +
    `Automated fix proposed by AI-SRE for incident ${incident.id}.\n` +
    `Suspect commit: ${rca.suspect_commit}\n` +
    `Confidence: ${rca.confidence}\n`
  );
}

export async function openPullRequest(
  incident: Incident,
  deps: OpenPrDeps = {},
): Promise<PrResult> {
  const rca = incident.rca;
  if (!rca) throw new NoRcaError('incident has no RCA yet'); // 400, before any git runs

  const repoPath = deps.repoPath ?? env.TARGET_REPO_PATH();
  const base = deps.baseBranch ?? 'main';
  const branch = `sre/incident-${incident.id.slice(0, 8)}`;

  // 1. Start from a clean, up-to-date copy of base. -B resets the branch if a
  //    previous attempt left one behind, so re-runs are safe.
  await git(['fetch', 'origin', base], repoPath);
  await git(['checkout', '-B', branch, `origin/${base}`], repoPath);

  // 2. Write the patch to a temp file, dry-run it (--check), then apply.
  //    A failure here (dry-run or real apply) restores base and raises
  //    PatchApplyError before any commit or push happens.
  const dir = await mkdtemp(join(tmpdir(), 'sre-patch-'));
  const patchFile = join(dir, 'patch.diff');
  await writeFile(patchFile, ensureTrailingNewline(rca.proposed_patch));
  try {
    await git(['apply', '--check', patchFile], repoPath);
    await git(['apply', patchFile], repoPath);
  } catch (e) {
    await git(['checkout', base], repoPath).catch(() => {});
    throw new PatchApplyError((e as Error).message);
  }

  // 3. Commit, referencing the incident (C3 traceability).
  await git(['add', '-A'], repoPath);
  await git(['commit', '-m', commitMessage(incident, rca)], repoPath);

  // 4. Push the branch. --force-with-lease keeps re-runs idempotent without
  //    clobbering someone else's push to the same branch.
  await git(['push', '-u', 'origin', branch, '--force-with-lease'], repoPath);

  // 5. Open the PR — postmortem_md is the body. This is the only GitHub API call.
  const octokit = deps.octokit ?? new Octokit({ auth: env.GITHUB_TOKEN() });
  const [owner, repo] = (deps.targetRepo ?? env.TARGET_REPO()).split('/');
  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    base,
    head: branch,
    title: prTitle(incident),
    body: rca.postmortem_md,
  });

  return { url: pr.data.html_url, branch, number: pr.data.number };
}
