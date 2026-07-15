# responder — architecture notes

## Ingest flow (`src/ingest/`)

`POST /api/incidents` ([incidents.controller.ts](src/ingest/incidents.controller.ts)):

1. Validate the body against `ErrorEvent` (`@sre/shared`) — every field must be
   a non-empty string. Invalid → `400`, nothing touches the DB.
2. Fingerprint the event ([fingerprint.ts](src/ingest/fingerprint.ts)).
3. `findByFingerprint` → `createIncident`. These two calls **must stay
   synchronous** (both are `better-sqlite3`, which is sync). Inserting an
   `await` between them opens a race window: two concurrent requests for the
   same new error both miss the find, both try to create, and the second hits
   the `fingerprint UNIQUE` constraint as an unhandled 500. If either call ever
   needs to become async, the pair needs a transaction or a lock, not a plain
   await.
4. Existing fingerprint → `bumpCount`, reply `202` with the existing id.
   New fingerprint → `createIncident` (`status: investigating`), reply `202`,
   then kick off the agent loop.

### Why `setImmediate`, not `queueMicrotask`, to start the loop

The loop start is deliberately scheduled with `setImmediate` and wrapped in
`try/catch`:

- Microtasks run *before* the response is flushed to the socket. A
  microtask-scheduled loop start with any sync-heavy work would still delay
  the reply. `setImmediate` runs after I/O, so the `202` actually goes out
  first.
- A throw inside a bare `queueMicrotask` callback becomes an uncaught
  exception and crashes the process. Harmless while `startInvestigation` is a
  `console.log` stub — real danger once Phase 4 drops in the actual agent
  loop. The `try/catch` logs the failure instead of taking the server down.

## Fingerprinting (`src/ingest/fingerprint.ts`)

`fingerprint(event) = sha256(normalize(message) + "\n" + top-3 stack frames)`.

Goal: the *same* crash produces the *same* fingerprint every time, so repeats
dedupe onto one incident instead of spawning new ones on every hit.

- `normalize(message)` strips the parts of an error message that vary run to
  run without changing what broke: absolute paths (collapsed to basename),
  UUIDs, hex addresses, and line/column numbers. Order matters — paths are
  stripped before numbers so a `:line:col` embedded in a path is removed as
  part of the path, not left dangling.
- `parseFrames(stack, limit=3)` extracts the top stack frames as
  `file:function` (e.g. `users.service.ts:getUser`). Handles both V8 stack
  line shapes: `at fn (location)` and bare `at location` (anonymous frames
  fall back to `<anon>`).
- No wall-clock, no randomness anywhere in the pipeline — a restart or a
  redeploy must not change a fingerprint for the same input.

## Agent loop stub (`src/agent/loop.ts`)

`startInvestigation(incidentId)` is currently a stub — logs and returns. It
exists now so the ingest controller has a stable call site. Phase 4 replaces
the body with the real Anthropic tool-use loop; **the exported signature must
not change**, so the swap is a drop-in with no controller edits.
