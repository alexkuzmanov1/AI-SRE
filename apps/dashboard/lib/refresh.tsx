"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface RefreshApi {
  /** Bumped whenever incident data changes (applyFix / revert). */
  version: number;
  /** Signal that incident data changed so subscribers refetch. */
  refresh: () => void;
}

const RefreshContext = createContext<RefreshApi | null>(null);

/**
 * Tiny app-wide signal so the incident list refetches after a mutation on the
 * investigation view (the mock client mutates shared state; this tells other
 * mounted views to re-read it).
 */
export function RefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, refresh }), [version, refresh]);
  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefresh(): RefreshApi {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error("useRefresh must be used within a RefreshProvider");
  return ctx;
}
