import type {
  AgentStep as WireAgentStep,
  Incident as WireIncident,
  RCA as WireRca,
} from "@sre/shared";
import type {
  ActionItem,
  AgentStep,
  Incident,
  IncidentSummary,
  RcaResult,
  TimelineEntry,
} from "@/lib/types";

/**
 * Wire → view-model mapping.
 *
 * `@sre/shared` owns the frozen wire contract; this module is the only place
 * the dashboard translates it into the presentation-shaped types in
 * `lib/types.ts`. Display-only fields with no wire counterpart are synthesized
 * best-effort here (and only here) so components stay wire-agnostic.
 */

export type { WireAgentStep, WireIncident, WireRca };

/** The wire `Incident` carries no service name; the demo has a single patient service. */
const DEFAULT_SERVICE = "demo-app";
const DEFAULT_SEVERITY = "sev-2";

/** Map a wire `AgentStep` (`thinking`/`tool_call`/`tool_result`) to a view step. */
export function mapWireStep(step: WireAgentStep): AgentStep {
  const base = { index: step.index, ts: new Date().toISOString() };
  switch (step.type) {
    case "thinking":
      return { ...base, type: "thought", content: step.text ?? "" };
    case "tool_call":
      return {
        ...base,
        type: "tool_call",
        toolName: step.tool,
        toolInput: asRecord(step.input),
      };
    case "tool_result":
      return {
        ...base,
        type: "tool_result",
        toolName: step.tool,
        toolResult: step.output,
      };
  }
}

/**
 * Extract the data rows of the first markdown table under a heading matching
 * `heading` (best effort — the agent's postmortems use `## Timeline` and
 * `## Action Items` tables). Returns [] when the section or table is absent.
 */
function parseMdTable(md: string, heading: RegExp): string[][] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => heading.test(l.trim()));
  if (start === -1) return [];
  const rows: string[][] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (/^#{1,6}\s/.test(line)) break; // next section
    if (!line.startsWith("|")) {
      if (rows.length > 0) break; // table ended
      continue; // prose before the table starts
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length === 0 || cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // |---|---|
    rows.push(cells);
  }
  return rows.length > 1 ? rows.slice(1) : []; // drop the header row
}

/** `2026-07-15 09:00` → `09:00`; anything without a clock time passes through. */
function shortTime(cell: string): string {
  return /\d{1,2}:\d{2}/.exec(cell)?.[0] ?? cell;
}

function parseTimeline(md: string): TimelineEntry[] {
  return parseMdTable(md, /^#{1,6}\s*Timeline/i)
    .filter((cells) => cells.length >= 2)
    .map(([time, ...rest]) => ({ time: shortTime(time ?? ""), text: rest.join(" — ") }));
}

function parseActionItems(md: string): ActionItem[] {
  return parseMdTable(md, /^#{1,6}\s*Action Items/i)
    .filter((cells) => Boolean(cells[0]))
    .map((cells) => ({
      text: cells.length > 2 && cells[2] ? `[${cells[2]}] ${cells[0]}` : cells[0]!,
      owner: cells[1] || "TBD",
    }));
}

/** Map the wire `RCA` (snake_case) to the view `RcaResult`, synthesizing display fields. */
export function mapWireRca(rca: WireRca): RcaResult {
  const firstLine = rca.root_cause.split("\n")[0] ?? rca.root_cause;
  return {
    rootCause: rca.root_cause,
    confidence: rca.confidence,
    suspectCommit: rca.suspect_commit,
    evidence: rca.evidence,
    proposedPatch: rca.proposed_patch,
    postmortemMd: rca.postmortem_md,
    // [DISPLAY] fields below have no wire counterpart — synthesized best-effort.
    service: DEFAULT_SERVICE,
    severity: DEFAULT_SEVERITY,
    title: firstLine,
    summary: rca.root_cause,
    rootCauseSnippet: removedLines(rca.proposed_patch),
    fixDescription: firstLine,
    date: new Date().toISOString().slice(0, 10),
    // Parsed best-effort from the agent's postmortem markdown tables.
    timeline: parseTimeline(rca.postmortem_md),
    actionItems: parseActionItems(rca.postmortem_md),
  };
}

/** Map a wire `Incident` to the full view `Incident`. */
export function mapWireIncident(w: WireIncident): Incident {
  // PR linkage is a planned wire-contract addition (responder stores the PR it
  // opened). Read it defensively so the UI lights up as soon as it ships.
  const pr = w as WireIncident & { prUrl?: string; prNumber?: number; prMerged?: boolean };
  return {
    prUrl: pr.prUrl,
    prNumber: pr.prNumber,
    prMerged: pr.prMerged,
    id: w.id,
    title: w.title,
    service: DEFAULT_SERVICE,
    status: w.status,
    severity: DEFAULT_SEVERITY,
    error: {
      id: w.fingerprint,
      service: DEFAULT_SERVICE,
      message: w.title,
      method: "",
      route: "",
      firstSeen: w.firstSeen,
      lastSeen: w.firstSeen,
      count: w.count,
      fingerprint: w.fingerprint,
    },
    occurrences: w.count,
    firstSeen: w.firstSeen,
    updatedAt: w.firstSeen,
    steps: [],
    rca: w.rca ? mapWireRca(w.rca) : undefined,
  };
}

/** Map a wire `Incident` to the sidebar's lightweight projection. */
export function mapWireIncidentSummary(w: WireIncident): IncidentSummary {
  return {
    id: w.id,
    title: w.title,
    service: DEFAULT_SERVICE,
    status: w.status,
    severity: DEFAULT_SEVERITY,
    occurrences: w.count,
    firstSeen: w.firstSeen,
    updatedAt: w.firstSeen,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return value === undefined ? undefined : { value };
}

function removedLines(patch: string): string {
  const lines = patch
    .split("\n")
    .filter((l) => l.startsWith("-") && !l.startsWith("---"))
    .map((l) => l.slice(1).trimEnd());
  return lines.length > 0 ? lines.join("\n") : patch;
}
