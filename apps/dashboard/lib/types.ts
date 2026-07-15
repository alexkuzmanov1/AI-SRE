/**
 * Dashboard VIEW MODELS.
 *
 * The wire contract is owned by `@sre/shared` (`ErrorEvent`, `Incident`,
 * `AgentStep`, `RCA`) — those types are the frozen truth and are never
 * redefined here. The interfaces in this file are presentation-shaped view
 * models; `lib/client/wire.ts` maps wire payloads into them at the HTTP/SSE
 * seam, and the `mock` client fabricates them directly.
 *
 * Fields that exist only for this dashboard's presentation (no wire
 * counterpart) are tagged with a `[DISPLAY]` comment.
 */

/**
 * Lifecycle of an incident. `investigating`/`resolved`/`failed` come from the
 * wire contract (`@sre/shared` Incident.status); `reverted` is a UI-side state
 * entered after a fix PR is reverted.
 */
export type IncidentStatus = "investigating" | "resolved" | "failed" | "reverted";

/** A single agent step emitted over the stream. Matches the S1 `AgentStep`. */
export type AgentStepType = "thought" | "tool_call" | "tool_result" | "rca";

/**
 * A deduplicated error signal captured by the exception filter — the thing that
 * opens an incident. Mirrors the S1 `ErrorEvent`.
 */
export interface ErrorEvent {
  id: string;
  service: string;
  /** Human-readable error message, e.g. "TypeError: Cannot read properties…". */
  message: string;
  /** HTTP method of the failing route, e.g. "POST". */
  method: string;
  /** Failing route/path, e.g. "/checkout". */
  route: string;
  /** ISO-8601 timestamp of the first occurrence. */
  firstSeen: string;
  /** ISO-8601 timestamp of the most recent occurrence. */
  lastSeen: string;
  /** Number of occurrences grouped under this event. */
  count: number;
  /** Grouping fingerprint (stack-trace based). */
  fingerprint?: string;
  /** Representative stack trace, if captured. */
  stack?: string;
}

/**
 * One step in the agent's investigation. The stream emits these in order via
 * `index`. Which optional fields are populated depends on `type`:
 *  - `thought`      -> `content`
 *  - `tool_call`    -> `toolName`, `toolInput`
 *  - `tool_result`  -> `toolName`, `toolResult`
 *  - `rca`          -> `rca`
 */
export interface AgentStep {
  /** Monotonic ordering index within an incident's stream (0-based). */
  index: number;
  /** ISO-8601 timestamp the step was produced. */
  ts: string;
  type: AgentStepType;

  /** Prose reasoning for `thought` steps. May contain `inline code` in backticks. */
  content?: string;

  /** Tool name for `tool_call` / `tool_result`, e.g. "get_deploy_history". */
  toolName?: string;
  /** Structured arguments for a `tool_call`, e.g. `{ service: "checkout-api" }`. */
  toolInput?: Record<string, unknown>;
  /** Result payload (rendered as a mono line) for a `tool_result`. */
  toolResult?: string;

  /** Full analysis payload, present only on the terminal `rca` step. */
  rca?: RcaResult;
}

/** A UTC timeline entry rendered in the postmortem. */
export interface TimelineEntry {
  /** Short UTC clock label, e.g. "13:58". */
  time: string;
  text: string;
  /** [DISPLAY] Optional emphasis for the timestamp color. */
  tone?: "muted" | "danger" | "success";
}

/** A follow-up task rendered in the postmortem's ACTION ITEMS section. */
export interface ActionItem {
  text: string;
  /** Owner handle, e.g. "TBD". */
  owner: string;
  done?: boolean;
}

/**
 * The agent's root-cause analysis. Mirrors the S1 `RcaResult`. Display fields
 * used by the postmortem/RCA views are tagged `[DISPLAY]`.
 */
export interface RcaResult {
  /** One-line statement of the cause. */
  rootCause: string;
  /** Confidence in [0, 1]. Rendered as a percentage. */
  confidence: number;
  /** Short SHA of the commit believed to have introduced the regression. */
  suspectCommit?: string;
  /** Ordered evidence bullets (full text, shown in the postmortem). */
  evidence: string[];
  /** [DISPLAY] Condensed evidence bullets shown in the compact RCA card. */
  evidenceBrief?: string[];
  /** Proposed fix as a unified-diff snippet. */
  proposedPatch: string;
  /** Full postmortem rendered as Markdown (source for "Copy as Markdown"). */
  postmortemMd: string;

  // --- Display fields surfaced by the mockup ---
  /** Affected service, e.g. "checkout-api". */
  service: string;
  /** Severity label, e.g. "sev-2". */
  severity: string;
  /** Pull-request number for the fix, once opened. */
  prNumber?: number;
  /** Pull-request URL for the fix, once opened. */
  prUrl?: string;
  /** Whether the fix PR has been merged. */
  prMerged?: boolean;
  /** [DISPLAY] Postmortem title line. */
  title: string;
  /** [DISPLAY] Prose summary paragraph. */
  summary: string;
  /** [DISPLAY] Diff snippet illustrating the offending change (removed lines). */
  rootCauseSnippet: string;
  /** [DISPLAY] One-line description of the fix shown in the FIX section. */
  fixDescription: string;
  /** [DISPLAY] UTC date the postmortem covers, e.g. "2026-07-15". */
  date: string;
  timeline: TimelineEntry[];
  actionItems: ActionItem[];
}

/**
 * A full incident. Mirrors the S1 `Incident`. `steps` is the recorded history
 * (used for instant replay); the live stream re-emits these for an active
 * incident. `rca` is present once the agent has produced an analysis.
 */
export interface Incident {
  id: string;
  title: string;
  service: string;
  status: IncidentStatus;
  severity: string;
  /** The triggering error event. */
  error: ErrorEvent;
  /** Occurrence count (kept in sync with `error.count`). */
  occurrences: number;
  /** ISO-8601 timestamp the incident was first seen. */
  firstSeen: string;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
  /** Recorded agent steps. */
  steps: AgentStep[];
  /** Analysis, present once produced. */
  rca?: RcaResult;
  /** Fix PR number once opened. */
  prNumber?: number;
  /** Fix PR URL once opened. */
  prUrl?: string;
  /** Whether the fix PR has been merged. */
  prMerged?: boolean;
}

/**
 * Lightweight projection for the incident list. This is what the sidebar renders
 * and what `listIncidents` returns.
 */
export interface IncidentSummary {
  id: string;
  title: string;
  service: string;
  status: IncidentStatus;
  severity: string;
  /** Occurrence count for the `×N` label. */
  occurrences: number;
  firstSeen: string;
  updatedAt: string;
}
