# AI-SRE

## Running the responder

```bash
pnpm install
cp apps/responder/.env.example apps/responder/.env   # fill in secrets as needed
pnpm --filter responder dev                          # boots on PORT (default 3001)
curl localhost:3001/health                           # -> {"status":"ok"}
```

`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `TARGET_REPO`, `TARGET_REPO_PATH` are only required once
the agent loop / GitHub PR features are exercised — Phase 1 (server + storage) boots without
them. `PORT` and `DATABASE_URL` are required at boot; a missing one fails loudly.

`pnpm --filter responder build` compiles to `dist/` and copies `schema.sql` alongside it;
`pnpm --filter responder start` runs the compiled build.

## Wire contracts (frozen)

- `POST /api/incidents` accepts an `ErrorEvent` (demo-app → responder).
- `GET /api/incidents/:id/stream` (SSE): `event: step` (data = `AgentStep` JSON) repeated for each step, then `event: rca` (data = `RCA` JSON), then `event: done`. If the agent gives up (step cap or 90s timeout) without an RCA, an `event: failed` (data = `{reason}`) is sent instead of `rca`, still followed by `done`.

`@sre/shared` types are frozen — changing a field needs a heads-up to the other person.

## Agent toolbox (Phase 3)

`apps/responder/src/agent/tools/` has the seven agent tools (`submit_rca`,
`get_logs`, `get_recent_commits`, `get_diff`, `read_file`, `search_code`,
`get_deploy_history`) plus the registry, wired into the agent loop
(`apps/responder/src/agent/loop.ts`, Phase 4). Pulls in `@anthropic-ai/sdk`
and `zod`; see [apps/responder/ARCHITECTURE.md](apps/responder/ARCHITECTURE.md)
for the contract and a diagram.

## Agent loop + live streaming (Phase 4)

`POST /api/incidents` kicks off `startInvestigation`, which runs an Anthropic
tool-use loop (system prompt in `src/agent/prompts/investigator.ts`) capped
at 12 steps / 90s. Every step is persisted to SQLite and published to an
in-process per-incident event bus (`src/events/incident-bus.ts`) in the same
call, so the SSE endpoint (`src/ingest/stream.controller.ts`) can replay
history for a late-joining viewer and then continue live with no gap or
duplicate. See [apps/responder/ARCHITECTURE.md](apps/responder/ARCHITECTURE.md)
for the full design.
