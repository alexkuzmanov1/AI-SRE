import type { AgentStep, Incident, IncidentSummary } from "@/lib/types";

/** Filter applied to the incident list. */
export type IncidentFilter = "all" | "open" | "resolved";

/**
 * Connection state of a step stream. Surfaced via the optional `onStatus`
 * callback so the UI can show a "reconnecting" indicator when an SSE stream
 * drops (F6.1). The `mock` client emits `open` then `closed`; it never drops.
 */
export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

/** Result of opening a fix PR. */
export interface ApplyFixResult {
  prUrl: string;
  prNumber: number;
}

/**
 * The single seam all data access flows through. Two implementations exist —
 * `mock` (in-memory fixtures) and `http` (real responder backend) — chosen by an
 * env flag. Components depend only on this interface, never on a concrete client.
 *
 * `streamIncident` intentionally mirrors an unsubscribe-style subscription so the
 * exact same call site works for a mock timer loop and for a real `EventSource`.
 */
export interface IncidentClient {
  /** Whether the responder backend is reachable. Never rejects. */
  health(): Promise<boolean>;

  /** List incidents, optionally filtered. Defaults to `all`. */
  listIncidents(filter?: IncidentFilter): Promise<IncidentSummary[]>;

  /** Fetch a single incident by id. Rejects if not found. */
  getIncident(id: string): Promise<Incident>;

  /**
   * Subscribe to an incident's agent steps. `onStep` is invoked once per step in
   * order. For an active incident, steps arrive progressively; for a resolved
   * incident, the recorded history is replayed immediately then the stream ends.
   * Returns an unsubscribe function that tears down the underlying timer/socket.
   *
   * `onStatus` is optional: implementations that can lose their connection (the
   * SSE `http` client) use it to surface `reconnecting` / `open` / `closed`. The
   * frozen two-argument form — `streamIncident(id, onStep)` — remains valid and
   * is all the `mock` client needs.
   */
  streamIncident(
    id: string,
    onStep: (step: AgentStep) => void,
    onStatus?: (status: StreamStatus) => void,
  ): () => void;

  /** Open a PR with the proposed fix; resolves with the PR link. */
  applyFix(id: string): Promise<ApplyFixResult>;

  /** Revert a previously applied fix. */
  revert(id: string): Promise<void>;
}
