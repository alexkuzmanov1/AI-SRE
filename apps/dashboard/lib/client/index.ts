import { HttpIncidentClient } from "@/lib/client/http";
import { MockIncidentClient } from "@/lib/client/mock";
import type { IncidentClient } from "@/lib/client/types";

export type { IncidentClient, IncidentFilter, StreamStatus, ApplyFixResult } from "@/lib/client/types";

/**
 * Build the active {@link IncidentClient} from the environment.
 *
 *   NEXT_PUBLIC_DATA_SOURCE=mock  -> in-memory fixtures (default)
 *   NEXT_PUBLIC_DATA_SOURCE=api   -> HTTP + SSE against NEXT_PUBLIC_RESPONDER_URL
 *
 * Flipping the flag swaps the data source with zero component changes.
 */
export function createIncidentClient(): IncidentClient {
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
  if (source === "api") {
    const baseUrl = process.env.NEXT_PUBLIC_RESPONDER_URL ?? "http://localhost:3001";
    return new HttpIncidentClient(baseUrl);
  }
  return new MockIncidentClient();
}
