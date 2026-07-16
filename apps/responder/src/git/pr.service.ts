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
/** Target clone has local changes already — refuse rather than sweep them into the AI's commit. */
export class DirtyRepoError extends Error {}

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

// TARGET_REPO_PATH is the same working tree every read-only agent tool
// (read_file, get_recent_commits, search_code) investigates AND the running
// patient app. Two requests racing on it — a double-click, or two incidents
// — must not interleave checkout/apply/commit. Serialize per repoPath with a
// tiny promise-chain mutex: `fn` only runs once every previously-chained
// call has settled, and a rejection never breaks the chain for the next
// caller (the `.catch(() => {})` tail is discarded, not returned).
const repoLocks = new Map<string, Promise<unknown>>();

function withRepoLock<T>(repoPath: string, fn: () => Promise<T>): Promise<T> {
  const prior = repoLocks.get(repoPath) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  repoLocks.set(repoPath, run.catch(() => {}));
  return run;
}

async function requireCleanTree(repoPath: string): Promise<void> {
  const status = await git(['status', '--porcelain'], repoPath);
  if (status.trim().length > 0) {
    throw new DirtyRepoError(
      `${repoPath} has uncommitted changes — refusing to touch it:\n${status}`,
    );
  }
}

/** Runs the branch → apply → commit → push sequence, always restoring `base` after. */
async function applyAndPush(
  incident: Incident,
  rca: NonNullable<Incident['rca']>,
  repoPath: string,
  base: string,
  branch: string,
): Promise<void> {
  await requireCleanTree(repoPath);
  await git(['fetch', 'origin', base], repoPath);

  try {
    // -B resets the branch if a previous attempt left one behind, so re-runs are safe.
    await git(['checkout', '-B', branch, `origin/${base}`], repoPath);

    const dir = await mkdtemp(join(tmpdir(), 'sre-patch-'));
    const patchFile = join(dir, 'patch.diff');
    await writeFile(patchFile, ensureTrailingNewline(rca.proposed_patch));
    try {
      await git(['apply', '--check', patchFile], repoPath);
      // --index stages the patched files directly, the same set `apply
      // --check` just validated — no `add -A`, so a stray untracked file
      // already sitting in the tree never rides along in the AI's commit.
      await git(['apply', '--index', patchFile], repoPath);
    } catch (e) {
      throw new PatchApplyError((e as Error).message);
    }

    await git(['commit', '-m', commitMessage(incident, rca)], repoPath);
    await git(['push', '-u', 'origin', branch, '--force-with-lease'], repoPath);
  } finally {
    // Always leave the shared clone back on base — it's also what every
    // read-only agent tool investigates and the running patient app serves
    // from. Best-effort: a failure here shouldn't mask the real error.
    await git(['checkout', base], repoPath).catch(() => {});
  }
}

function isDuplicatePrError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { status?: number }).status === 422;
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

  await withRepoLock(repoPath, () => applyAndPush(incident, rca, repoPath, base, branch));

  const octokit = deps.octokit ?? new Octokit({ auth: env.GITHUB_TOKEN() });
  const [owner, repo] = (deps.targetRepo ?? env.TARGET_REPO()).split('/');

  try {
    const pr = await octokit.rest.pulls.create({
      owner,
      repo,
      base,
      head: branch,
      title: prTitle(incident),
      body: rca.postmortem_md,
    });
    return { url: pr.data.html_url, branch, number: pr.data.number };
  } catch (e) {
    // A second in-flight request (double-click) already pushed the same
    // branch and opened the PR; GitHub rejects the duplicate with 422. Look
    // up the PR that already exists instead of surfacing that as a failure.
    if (!isDuplicatePrError(e)) throw e;
    const existing = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${branch}`,
      state: 'all',
    });
    const found = existing.data[0];
    if (!found) throw e;
    return { url: found.html_url, branch, number: found.number };
  }
}
