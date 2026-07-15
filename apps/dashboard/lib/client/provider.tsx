"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { createIncidentClient } from "@/lib/client/index";
import type { IncidentClient } from "@/lib/client/types";

const IncidentClientContext = createContext<IncidentClient | null>(null);

/**
 * Provides the single {@link IncidentClient} instance for the session. Mounted
 * once at the app root so the `mock` client's in-memory mutations (applyFix /
 * revert) persist across navigation.
 */
export function IncidentClientProvider({ children }: { children: ReactNode }) {
  const ref = useRef<IncidentClient | null>(null);
  if (ref.current === null) {
    ref.current = createIncidentClient();
  }
  return (
    <IncidentClientContext.Provider value={ref.current}>
      {children}
    </IncidentClientContext.Provider>
  );
}

/** Access the active incident client. Components use only this — never `mock`/`http` directly. */
export function useIncidentClient(): IncidentClient {
  const client = useContext(IncidentClientContext);
  if (!client) {
    throw new Error("useIncidentClient must be used within an IncidentClientProvider");
  }
  return client;
}
