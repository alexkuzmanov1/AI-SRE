# responder

Node/TS backend for the AI Incident Responder: webhook ingest, fingerprinting, the Claude agent loop, tool execution, SSE streaming, and the GitHub PR service. Fastify + `@anthropic-ai/sdk` + `better-sqlite3` (SQLite, no DB server) + Octokit.

## Run

```bash
pnpm install
cp .env.example .env   # fill in secrets as needed
pnpm dev                # tsx watch src/main.ts, boots on PORT (default 3001)
curl localhost:3001/health   # -> {"status":"ok"}
```

`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `TARGET_REPO`, `TARGET_REPO_PATH` are only required once the agent loop / PR features are exercised — the server + storage boot without them. `PORT` and `DATABASE_URL` are required at boot; a missing one fails loudly.

```bash
pnpm build   # tsc -> dist/, copies schema.sql alongside it
pnpm start   # runs the compiled build (node dist/main.js)
pnpm test    # node --test over src/**/*.test.ts
```

## Env vars (`.env.example`)

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key for the agent loop |
| `ANTHROPIC_MODEL` | defaults to `claude-sonnet-4-6` |
| `GITHUB_TOKEN` | repo-scope token for opening PRs |
| `TARGET_REPO` | `owner/repo` of the monitored app (separate repo, cloned at runtime) |
| `TARGET_REPO_PATH` | local clone path, e.g. `../demo-app` |
| `DATABASE_URL` | SQLite file path, e.g. `./data.db` |
| `PORT` | HTTP port, default `3001` |

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | liveness |
| `GET` | `/api/incidents` | list incidents |
| `GET` | `/api/incidents/:id` | fetch one incident |
| `POST` | `/api/incidents` | ingest an `ErrorEvent` (demo-app → responder); dedups by fingerprint, spawns the agent loop, returns `202` with `incidentId` |
| `GET` | `/api/incidents/:id/stream` | **SSE** — replays persisted steps then streams live: `step`* → (`rca` \| `failed`) → `done` |
| `POST` | `/api/incidents/:id/pr` | human-triggered (not an agent tool) — applies `proposed_patch` and opens a GitHub PR; requires an `rca` to already exist on the incident |

## Agent loop

`POST /api/incidents` kicks off `startInvestigation` (`src/agent/loop.ts`), a Claude tool-use loop (system prompt in `src/agent/prompts/investigator.ts`) capped at **12 steps / 90s**. Every step is persisted to SQLite and published to an in-process per-incident event bus (`src/events/incident-bus.ts`) in the same call, so the SSE endpoint can replay history for a late-joining viewer and then continue live with no gap or duplicate.

## Agent tools (`src/agent/tools/`)

| Tool | Purpose |
| --- | --- |
| `read_file`, `search_code` | inspect source in the cloned target repo |
| `get_recent_commits`, `get_diff` | correlate the error with recent changes |
| `get_logs(service, window)` | fetch logs around incident time (mocked JSON fixtures) |
| `get_deploy_history` | deploy timeline for correlation |
| `submit_rca` | terminal tool — forces structured `{ root_cause, confidence, suspect_commit, evidence[], proposed_patch, postmortem_md }` output |

Registry, schemas, and dispatch live in `src/agent/tools/index.ts`.

## Deployment

`Dockerfile` builds from the repo root (pnpm workspace: builds `@sre/shared` then `responder`), `node:22-slim`, `EXPOSE 3001`. `scripts/render-start.sh` is the hosted (Render) boot entrypoint — clones/refreshes `TARGET_REPO` into `TARGET_REPO_PATH`, sets a git identity, then execs `node dist/main.js`. See `render.yaml` at the repo root; the free plan's filesystem is ephemeral, so the SQLite DB and the clone reset on every deploy.

## More detail

See [ARCHITECTURE.md](ARCHITECTURE.md) for fingerprinting, the `record()` invariant, event bus design, and the PR service's patch contract.
