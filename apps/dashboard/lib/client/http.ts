import type { AgentStep, Incident, IncidentSummary } from "@/lib/types";
import type {
  ApplyFixResult,
  IncidentClient,
  IncidentFilter,
  StreamStatus,
} from "@/lib/client/types";
import {
  mapWireIncident,
  mapWireIncidentSummary,
  mapWireRca,
  mapWireStep,
  type WireAgentStep,
  type WireIncident,
  type WireRca,
} from "@/lib/client/wire";

/**
 * Real-backend implementation of {@link IncidentClient}, talking to the
 * responder over HTTP + SSE. Enabled with `NEXT_PUBLIC_DATA_SOURCE=api`; the
 * component tree is identical to `mock` mode.
 *
 * All payloads are typed by the frozen `@sre/shared` wire contract and mapped
 * to view models in `lib/client/wire.ts`. The SSE stream follows the frozen
 * wire protocol: `event: step` × N, then `event: rca`, then `event: done`
 * (with an out-of-band `event: failed` if the investigation aborts).
 *
 * Endpoints (backend A7–A10):
 *   GET  /api/incidents?filter=...
 *   GET  /api/incidents/:id
 *   SSE  /api/incidents/:id/stream
 *   POST /api/incidents/:id/apply-fix
 *   POST /api/incidents/:id/revert
 */
export class HttpIncidentClient implements IncidentClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // Trim a trailing slash so path joins are predictable.
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.url(path), {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
    if (!res.ok) {
      throw new Error(`Request failed: ${res.status} ${res.statusText} (${path})`);
    }
    return (await res.json()) as T;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(this.url("/health"), {
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listIncidents(filter: IncidentFilter = "all"): Promise<IncidentSummary[]> {
    const query = filter === "all" ? "" : `?filter=${encodeURIComponent(filter)}`;
    const wire = await this.json<WireIncident[]>(`/api/incidents${query}`);
    return wire.map(mapWireIncidentSummary);
  }

  async getIncident(id: string): Promise<Incident> {
    const wire = await this.json<WireIncident>(`/api/incidents/${encodeURIComponent(id)}`);
    return mapWireIncident(wire);
  }

  streamIncident(
    id: string,
    onStep: (step: AgentStep) => void,
    onStatus?: (status: StreamStatus) => void,
  ): () => void {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      // No SSE available (SSR / unsupported env): nothing to subscribe to.
      onStatus?.("closed");
      return () => {};
    }

    onStatus?.("connecting");
    const es = new EventSource(this.url(`/api/incidents/${encodeURIComponent(id)}/stream`));
    let closed = false;
    // Highest wire step index seen; synthesized terminal steps (rca/failed)
    // slot in after it so the hook's index-based ordering/dedupe keeps working.
    let lastIndex = -1;

    const close = () => {
      if (closed) return;
      closed = true;
      es.close();
      onStatus?.("closed");
    };

    /** Parse an SSE frame's JSON payload, ignoring malformed frames. */
    const parse = <T>(event: MessageEvent<string>): T | undefined => {
      try {
        return JSON.parse(event.data) as T;
      } catch {
        return undefined;
      }
    };

    es.onopen = () => {
      if (!closed) onStatus?.("open");
    };

    es.addEventListener("step", (event: MessageEvent<string>) => {
      if (closed) return;
      const wire = parse<WireAgentStep>(event);
      if (!wire) return;
      lastIndex = Math.max(lastIndex, wire.index);
      onStep(mapWireStep(wire));
    });

    es.addEventListener("rca", (event: MessageEvent<string>) => {
      if (closed) return;
      const rca = parse<WireRca>(event);
      if (!rca) return;
      // Surface the analysis as the terminal `rca` view step the UI expects.
      onStep({
        index: ++lastIndex,
        ts: new Date().toISOString(),
        type: "rca",
        rca: mapWireRca(rca),
      });
    });

    es.addEventListener("failed", (event: MessageEvent<string>) => {
      if (closed) return;
      const payload = parse<{ reason?: string }>(event);
      onStep({
        index: ++lastIndex,
        ts: new Date().toISOString(),
        type: "thought",
        content: `Investigation failed: ${payload?.reason ?? "unknown reason"}`,
      });
      close();
    });

    es.addEventListener("done", () => close());

    es.onerror = () => {
      if (closed) return;
      // EventSource auto-reconnects while readyState === CONNECTING; the backend
      // (A8) replays prior steps then resumes live. The hook dedupes by index.
      if (es.readyState === EventSource.CLOSED) {
        onStatus?.("closed");
      } else {
        onStatus?.("reconnecting");
      }
    };

    return () => {
      if (closed) return;
      closed = true;
      es.close();
    };
  }

  async applyFix(id: string): Promise<ApplyFixResult> {
    return this.json<ApplyFixResult>(`/api/incidents/${encodeURIComponent(id)}/apply-fix`, {
      method: "POST",
    });
  }

  async revert(id: string): Promise<void> {
    const res = await fetch(this.url(`/api/incidents/${encodeURIComponent(id)}/revert`), {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(`Revert failed: ${res.status} ${res.statusText}`);
    }
  }
}
