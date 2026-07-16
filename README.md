# AI SRE — AI Incident Responder

> When production breaks at 3am, the agent does the first 30 minutes of debugging before a human opens their laptop.

An autonomous agent that receives production error events, investigates them (logs, git history, source, deploy timing), and produces a root-cause analysis with a proposed fix as a GitHub pull request. **The agent proposes, never merges** — a human reviews the RCA and approves the PR.

## Monorepo layout

```
apps/
  responder/     Node/TS backend — webhook ingest, agent loop, tools, SSE, PR service
  dashboard/     Next.js UI — incident feed, live investigation stream, RCA report
packages/
  shared/        @sre/shared — frozen wire types (ErrorEvent, Incident, AgentStep, RCA)
```

The monitored "patient" application (the demo app that throws errors) lives in a **separate repo**, cloned by the responder at runtime via the `TARGET_REPO` / `TARGET_REPO_PATH` env vars — see [apps/responder/README.md](apps/responder/README.md).

## How it works

1. An endpoint in the monitored repo throws. Its error handler POSTs an `ErrorEvent` to the responder's webhook (`POST /api/incidents`).
2. The responder fingerprints the error (hash of normalized top stack frames) and dedupes — repeat errors attach to the existing incident.
3. An incident is created (status `investigating`) and the agent loop spawns.
4. The agent (Claude with tool use) investigates iteratively — typical trajectory: `get_logs` → `get_deploy_history` → `get_recent_commits` → `get_diff` → `read_file`. Capped at 12 steps / 90s.
5. Every step is persisted to SQLite and pushed to the dashboard over SSE, so the investigation streams live.
6. The agent finishes by calling the terminal `submit_rca` tool: `{ root_cause, confidence, suspect_commit, evidence[], proposed_patch, postmortem_md }`.
7. The dashboard renders the RCA. A human clicks **Open PR** → `POST /api/incidents/:id/pr` applies `proposed_patch` on a branch and opens a GitHub PR with the postmortem as the description.

## Quickstart

```bash
pnpm install

# terminal 1 — responder (:3001)
cp apps/responder/.env.example apps/responder/.env   # fill in secrets as needed
pnpm --filter responder dev
curl localhost:3001/health   # -> {"status":"ok"}

# terminal 2 — dashboard (:3002, mock data by default, no backend required)
pnpm --filter dashboard dev
```

There is no root `pnpm dev` that boots everything at once yet (planned) — run each app via its own `pnpm --filter <app> dev`, as above.

To point the dashboard at the real responder instead of mock fixtures, set `NEXT_PUBLIC_DATA_SOURCE=api` and `NEXT_PUBLIC_RESPONDER_URL` in `apps/dashboard/.env.local` — see [apps/dashboard/README.md](apps/dashboard/README.md).

`pnpm -r build` builds every workspace package (the root's only script today).

## Wire contracts (frozen)

`@sre/shared` (see [packages/shared/README.md](packages/shared/README.md)) defines `ErrorEvent`, `Incident`, `AgentStep`, and `RCA`. Both apps import these — never redefine them locally. Changing a field needs a heads-up to whoever owns the other side of the contract.

## Deployment

- **responder**: `render.yaml` deploys it as a Docker web service on Render (free plan — filesystem is ephemeral, so the SQLite DB and the cloned target repo reset on every deploy). Health check: `/health`.
- **dashboard**: deploys separately (`apps/dashboard/vercel.json`), pointed at the responder's public URL via `NEXT_PUBLIC_RESPONDER_URL`.

## Further reading

- [apps/responder/README.md](apps/responder/README.md) — endpoints, agent tools, env vars, SSE contract
- [apps/responder/ARCHITECTURE.md](apps/responder/ARCHITECTURE.md) — fingerprinting, agent loop, event bus internals
- [apps/dashboard/README.md](apps/dashboard/README.md) — data-source seam, structure
- [packages/shared/README.md](packages/shared/README.md) — the frozen types
- [CLAUDE.md](CLAUDE.md) — project conventions and design decisions for anyone (human or agent) working in this repo
