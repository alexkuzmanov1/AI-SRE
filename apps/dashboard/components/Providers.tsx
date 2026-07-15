"use client";

import type { ReactNode } from "react";
import { IncidentClientProvider } from "@/lib/client/provider";
import { RefreshProvider } from "@/lib/refresh";
import { ToastProvider } from "@/components/ui/ToastProvider";

/** Client-side context providers mounted once at the app root. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <IncidentClientProvider>
      <RefreshProvider>
        <ToastProvider>{children}</ToastProvider>
      </RefreshProvider>
    </IncidentClientProvider>
  );
}
