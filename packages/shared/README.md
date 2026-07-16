# @sre/shared

Shared TypeScript types for the AI Incident Responder monorepo. This is the **frozen wire contract** between `apps/responder` and `apps/dashboard` — both apps import from here; neither redefines these types locally. Changing a field needs a heads-up to whoever owns the other side.

## Usage

```ts
import type { ErrorEvent, Incident, AgentStep, RCA } from '@sre/shared';
```

## Types (`src/types.ts`)

```ts
type ErrorEvent = {
  service: string;
  message: string;
  stack: string;
  route: string;
  timestamp: string;
};

type Incident = {
  id: string;
  fingerprint: string;
  status: 'investigating' | 'resolved' | 'failed';
  title: string;
  firstSeen: string;
  count: number;
  rca?: RCA;
  prUrl?: string;     // set once POST /api/incidents/:id/pr has opened a PR
  prNumber?: number;
};

type AgentStep = {
  incidentId: string;
  index: number;
  type: 'thinking' | 'tool_call' | 'tool_result';
  tool?: string;
  input?: unknown;
  output?: string;
  text?: string;
};

type RCA = {
  root_cause: string;
  confidence: number;
  suspect_commit: string;
  evidence: string[];
  proposed_patch: string;   // unified diff, git-apply-able (a/ b/ paths, @@ hunks)
  postmortem_md: string;
};
```

`RCA` uses snake_case field names deliberately — it's the shape the `submit_rca` agent tool returns and both apps consume verbatim.

## Build

```bash
pnpm --filter @sre/shared build   # tsc -> dist/ (index.js + index.d.ts)
```

Consumed via the `workspace:*` protocol by both `apps/responder` and `apps/dashboard`.
