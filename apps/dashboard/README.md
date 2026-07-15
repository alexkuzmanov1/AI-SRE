# Responder Dashboard

Incident-responder dashboard (Next.js App Router, TypeScript `strict`, Tailwind) built
from the provided GitHub-dark mockup. Every screen works end-to-end against an in-memory
mock; switching to the real backend is a single env-flag flip with **no component changes**.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000  (mock data, fully offline)
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm typecheck`.

## The data seam

All data access flows through one interface — [`IncidentClient`](lib/client/types.ts) — with
two implementations selected by an env flag:

| `NEXT_PUBLIC_DATA_SOURCE` | Implementation | Notes |
| --- | --- | --- |
| `mock` (default) | [`lib/client/mock.ts`](lib/client/mock.ts) | In-memory fixtures; timer-driven streaming. Works with no backend. |
| `api` | [`lib/client/http.ts`](lib/client/http.ts) | HTTP + SSE against `NEXT_PUBLIC_RESPONDER_URL`. |

```
listIncidents(filter?)                 GET  /api/incidents?filter=
getIncident(id)                        GET  /api/incidents/:id
streamIncident(id, onStep, onStatus?)  SSE  /api/incidents/:id/stream
applyFix(id)                           POST /api/incidents/:id/apply-fix
revert(id)                             POST /api/incidents/:id/revert
```

Components obtain the client **only** through [`useIncidentClient()`](lib/client/provider.tsx)
and never import `mock`/`http` directly, so flipping the flag swaps the source with zero
component edits:

```bash
# .env.local
NEXT_PUBLIC_DATA_SOURCE=api
NEXT_PUBLIC_RESPONDER_URL=http://localhost:8000
```

`streamIncident` returns an unsubscribe function — the same shape works for the mock timer
loop and for a real `EventSource`. The optional `onStatus` callback surfaces the
`reconnecting` state used by the SSE client (F6.1); the frozen two-argument form still works.

## Types

[`lib/types.ts`](lib/types.ts) mirrors the backend's frozen S1 contracts
(`ErrorEvent`, `Incident`, `AgentStep`, `RcaResult`) byte-for-byte, so `api` mode consumes
backend JSON with no transformation. Fields used only for presentation are tagged `[DISPLAY]`.

## Structure

```
app/                      routes: / (redirect) · /incidents/[id] · /incidents/[id]/postmortem
components/               AppHeader, IncidentSidebar, Providers
  investigation/          IncidentHeader, StepStream, RcaCard, DiffSnippet, InvestigationView
  postmortem/             PostmortemView
  ui/                     RichText, StatusDot, Skeleton, ToastProvider
hooks/useIncidentStream   subscribe + accumulate steps (dedupes by index for SSE replay)
lib/client/               types (seam) · mock · http · index (factory) · provider (context)
lib/types.ts · lib/time.ts · lib/refresh.tsx
```

## Design tokens

Tokens from the mockup are encoded as CSS variables in [`app/globals.css`](app/globals.css)
and mapped into the Tailwind theme ([`tailwind.config.ts`](tailwind.config.ts)) as
`bg-panel`, `text-muted`, `text-accent`, etc. Colors are stored as RGB channels so Tailwind
`/opacity` modifiers work. Fonts (IBM Plex Sans / Mono) are wired via `next/font`. Dark only.

Two **deliberate deviations** from the raw mockup follow the written spec (FRONTEND_TASKS.md):

- the incident error message is rendered in **mono** (F3.1 "(mono)");
- **confidence** uses the **warning** token `#e3b341` (F4.1 + token table), where the mockup
  had rendered it green.

## Fixtures

Three incidents recreate the mockup: **INC-7** (TypeError in checkout, live/investigating,
verbatim RCA + postmortem, PR #214, 92%), **INC-6** (orders query timeout, resolved),
**INC-5** (null deref after cleanup, resolved). Incident timestamps use fixed UTC clock
values for the header labels and load-relative offsets for the "Xm/Xd ago" list labels.
