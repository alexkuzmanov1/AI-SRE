import type { AgentStep, Incident, IncidentSummary } from "@/lib/types";
import { createSeedIncidents } from "@/lib/client/fixtures";
import type {
  ApplyFixResult,
  IncidentClient,
  IncidentFilter,
  StreamStatus,
} from "@/lib/client/types";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function toSummary(inc: Incident): IncidentSummary {
  return {
    id: inc.id,
    title: inc.title,
    service: inc.service,
    status: inc.status,
    severity: inc.severity,
    occurrences: inc.occurrences,
    firstSeen: inc.firstSeen,
    updatedAt: inc.updatedAt,
  };
}

function matchesFilter(inc: Incident, filter: IncidentFilter): boolean {
  switch (filter) {
    case "open":
      return inc.status !== "resolved";
    case "resolved":
      return inc.status === "resolved";
    case "all":
    default:
      return true;
  }
}

/** Deep clone so callers can never mutate the mock's internal state. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * In-memory implementation of {@link IncidentClient}. Holds a mutable copy of the
 * fixtures so `applyFix` / `revert` persist for the lifetime of the client
 * instance (one per app session). Streaming replays each incident's recorded
 * steps on timers to simulate the backend's SSE feed.
 */
export class MockIncidentClient implements IncidentClient {
  private incidents: Incident[] = createSeedIncidents();

  private find(id: string): Incident | undefined {
    return this.incidents.find((inc) => inc.id === id);
  }

  async listIncidents(filter: IncidentFilter = "all"): Promise<IncidentSummary[]> {
    await delay(180);
    return this.incidents.filter((inc) => matchesFilter(inc, filter)).map(toSummary);
  }

  async getIncident(id: string): Promise<Incident> {
    await delay(160);
    const inc = this.find(id);
    if (!inc) throw new Error(`Incident ${id} not found`);
    return clone(inc);
  }

  streamIncident(
    id: string,
    onStep: (step: AgentStep) => void,
    onStatus?: (status: StreamStatus) => void,
  ): () => void {
    const inc = this.find(id);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!inc) {
      onStatus?.("closed");
      return () => {
        cancelled = true;
      };
    }

    const steps = inc.steps;
    onStatus?.("open");

    if (inc.status === "investigating") {
      // Active incident: reveal steps progressively, stopping at the terminal RCA.
      let i = 0;
      const emitNext = () => {
        if (cancelled || i >= steps.length) return;
        const step = steps[i++];
        onStep(clone(step));
        if (step.type === "rca") {
          onStatus?.("closed"); // stream closes once the RCA lands
          return;
        }
        const gap = 600 + Math.random() * 600; // ~600–1200ms
        timer = setTimeout(emitNext, gap);
      };
      timer = setTimeout(emitNext, 400);
    } else {
      // Resolved/reverted incident: replay the full recorded history at once.
      timer = setTimeout(() => {
        if (cancelled) return;
        for (const step of steps) onStep(clone(step));
        onStatus?.("closed");
      }, 0);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }

  async applyFix(id: string): Promise<ApplyFixResult> {
    await delay(1400);
    const inc = this.find(id);
    if (!inc) throw new Error(`Incident ${id} not found`);

    // An RCA is required before a fix can be opened. For an active incident the
    // analysis lives on the terminal step until the fix is applied.
    const rcaStep = inc.steps.find((s) => s.type === "rca");
    const rca = inc.rca ?? rcaStep?.rca;
    if (!rca) throw new Error(`Cannot open a PR for ${id}: no root-cause analysis yet`);

    const prNumber = rca.prNumber ?? 214;
    const prUrl = rca.prUrl ?? `https://github.com/demo-app/${inc.service}/pull/${prNumber}`;

    inc.rca = { ...rca, prNumber, prUrl, prMerged: true };
    inc.status = "resolved";
    inc.prNumber = prNumber;
    inc.prUrl = prUrl;
    inc.prMerged = true;
    inc.updatedAt = new Date().toISOString();

    return { prUrl, prNumber };
  }

  async revert(id: string): Promise<void> {
    await delay(900);
    const inc = this.find(id);
    if (!inc) throw new Error(`Incident ${id} not found`);
    inc.status = "reverted";
    inc.prMerged = false;
    if (inc.rca) inc.rca = { ...inc.rca, prMerged: false };
    inc.updatedAt = new Date().toISOString();
  }
}
