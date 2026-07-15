# AI-SRE

## Wire contracts (frozen)

- `POST /api/incidents` accepts an `ErrorEvent` (demo-app → responder).
- `GET /api/incidents/:id/stream` (SSE): `event: step` (data = `AgentStep` JSON) repeated for each step, then `event: rca` (data = `RCA` JSON), then `event: done`.

`@sre/shared` types are frozen — changing a field needs a heads-up to the other person.
