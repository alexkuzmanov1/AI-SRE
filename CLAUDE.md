# CLAUDE.md — AI Incident Responder

> When production breaks at 3am, the agent does the first 30 minutes of debugging before a human opens their laptop.

## What this project is

A hackathon project: an autonomous AI agent that receives production errors, investigates them (logs + git history + source code + deploy timing), and produces a root-cause analysis with a proposed fix as a GitHub pull request.

The agent **proposes, never merges** — a human reviews the RCA and approves the PR.

## Monorepo structure

```
apps/
  demo-app/     # NestJS "patient" app with intentionally plantable bugs
  responder/    # Node/TS backend: webhook ingest, orchestrator, agent loop, tools
  dashboard/    # Next.js UI: incident feed, live investigation stream, RCA report
packages/
  shared/       # Shared TypeScript types (ErrorEvent, Incident, RCA schema)
```

## How it works (one incident, end to end)

1. A bad commit ships → an endpoint in `demo-app` throws. A NestJS global exception filter catches it and POSTs an **error event** (message, stack, route, timestamp) to `responder`'s webhook (`POST /api/incidents`).
2. `responder` **fingerprints** the error (hash of normalized top stack frames) and dedupes — repeated errors attach to the existing incident.
3. The **orchestrator** creates an incident row (status `investigating`) and spawns the **agent loop**.
4. The agent (Claude with tool use) investigates iteratively — typical trajectory: `get_logs` → `get_deploy_history` → `get_recent_commits` → `get_diff` → `read_file`. Max **12 steps**.
5. Every step is persisted to `agent_steps` and pushed to the dashboard over **SSE** so the investigation streams live.
6. The agent finishes by calling the `submit_rca` tool with structured output: `{ root_cause, confidence, suspect_commit, evidence[], proposed_patch, postmortem_md }`.
7. Dashboard renders the RCA. A human clicks **Open PR** → `create_pull_request` applies the patch on a branch with the postmortem as the description.
8. *(Stretch)* Resolved incidents are compared by an in-JS cosine similarity search over SQLite rows; new incidents run this first ("this matches INC-14").

## Tech stack

- **demo-app:** NestJS (TypeScript)
- **responder:** Node.js + TypeScript, Anthropic SDK (`claude-sonnet-4-6` by default), Octokit for GitHub
- **dashboard:** Next.js (App Router), SSE for live streaming
- **storage:** SQLite (`better-sqlite3`) — `incidents`, `agent_steps` tables in a local `data.db` file; no DB server

## Agent tools

| Tool | Purpose |
|---|---|
| `read_file`, `search_code` | Inspect source in the monitored repo |
| `get_recent_commits`, `get_diff` | Correlate error with recent changes |
| `get_logs(service, window)` | Fetch logs around incident time (mocked JSON store) |
| `get_deploy_history` | Deploy timeline for correlation |
| `find_similar_incidents` | in-JS cosine similarity over SQLite rows (stretch) |
| `create_pull_request` | Open fix PR — only after human approval |
| `submit_rca` | Terminal tool; forces structured, parseable output |

## Key design decisions

- **Final answer is a tool call**, not free text — `submit_rca` guarantees a parseable RCA every time.
- **Propose-don't-merge:** the agent has no write access to `main`.
- **Fingerprinting before agent spawn** prevents incident spam and duplicate investigations.
- **Hard step cap (12) + token budget** so the loop can't run away.
- **Logs are mocked** as JSON files behind `get_logs` — real Kibana/Loki/New Relic integrations are roadmap, not hackathon scope.

## Development

```bash
pnpm install
pnpm dev                    # runs all three apps concurrently
pnpm demo:break             # merges a scripted bad commit into demo-app to trigger an incident
```

## Environment variables (`.env` in apps/responder)

```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
GITHUB_TOKEN=...            # repo scope, PR creation
TARGET_REPO=owner/demo-app
TARGET_REPO_PATH=../demo-app
DATABASE_URL=./data.db      # SQLite file path
PORT=3001
```

## Conventions

- TypeScript `strict` everywhere; shared types live in `packages/shared` — never redefine `ErrorEvent`/`Incident`/`RCA` locally.
- New agent tools go in `apps/responder/src/agent/tools/`, one file per tool: JSON schema + executor, registered in `tools/index.ts`.
- Agent prompts live in `apps/responder/src/agent/prompts/` — do not inline prompt strings in the loop.
- Every agent step must be persisted **and** emitted over SSE; never add silent steps.

## Out of scope (hackathon)

Multi-repo support, auth/teams, real log-store integrations, auto-merge, retries/queues. One repo, one demo app, one great live demo.
