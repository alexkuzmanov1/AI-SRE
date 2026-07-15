"use client";

import { useEffect, useState } from "react";
import { useIncidentClient } from "@/lib/client/provider";
import type { StreamStatus } from "@/lib/client/types";
import type { AgentStep } from "@/lib/types";

export interface IncidentStreamState {
  /** Steps received so far, ordered by `index`. */
  steps: AgentStep[];
  /** Connection state of the underlying stream. */
  status: StreamStatus;
  /** True while the stream is live and no terminal RCA has arrived yet. */
  isStreaming: boolean;
  /** The terminal `rca` step, once seen. */
  rcaStep?: AgentStep;
}

/**
 * Subscribes to an incident's agent-step stream and accumulates steps.
 *
 * Dedupes by `step.index` so an SSE reconnect that replays earlier steps (A8)
 * never produces duplicates. Cleans up on unmount / id change so switching
 * incidents quickly can't leak timers or cross feeds.
 */
export function useIncidentStream(id: string | undefined): IncidentStreamState {
  const client = useIncidentClient();
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    if (!id) return;

    setSteps([]);
    setStatus("connecting");

    const unsubscribe = client.streamIncident(
      id,
      (step) => {
        setSteps((prev) => {
          const existing = prev.findIndex((s) => s.index === step.index);
          if (existing >= 0) {
            const copy = prev.slice();
            copy[existing] = step;
            return copy;
          }
          return [...prev, step].sort((a, b) => a.index - b.index);
        });
      },
      (nextStatus) => setStatus(nextStatus),
    );

    return unsubscribe;
  }, [client, id]);

  const rcaStep = steps.find((s) => s.type === "rca");
  const isStreaming = status !== "closed" && !rcaStep;

  return { steps, status, isStreaming, rcaStep };
}
