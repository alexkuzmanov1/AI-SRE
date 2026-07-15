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
- `GET /api/incidents/:id/stream` (SSE): `event: step` (data = `AgentStep` JSON) repeated for each step, then `event: rca` (data = `RCA` JSON), then `event: done`.

`@sre/shared` types are frozen — changing a field needs a heads-up to the other person.
