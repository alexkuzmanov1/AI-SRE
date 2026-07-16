"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIncidentClient } from "@/lib/client/provider";
import { Skeleton } from "@/components/ui/Skeleton";

const POLL_MS = 5000;

/**
 * Redirects to the first incident. While the list is empty (fresh DB) it shows
 * a waiting state and keeps polling, so the page jumps to the incident the
 * moment the first error report arrives. Unreachable backend gets an explicit
 * error state instead of an infinite skeleton.
 */
export default function HomePage() {
  const client = useIncidentClient();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "empty" | "error">("loading");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        const incidents = await client.listIncidents("all");
        if (!active) return;
        if (incidents.length > 0) {
          router.replace(`/incidents/${incidents[0].id}`);
          return;
        }
        setState("empty");
      } catch {
        if (!active) return;
        setState("error");
      }
      timer = setTimeout(check, POLL_MS);
    };

    void check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, router]);

  if (state === "loading") {
    return (
      <div className="flex h-full">
        <div className="hidden w-[316px] flex-none flex-col gap-3 border-r border-border-subtle p-4 md:flex">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-7">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-16 w-full max-w-xl" />
          <Skeleton className="h-16 w-full max-w-xl" />
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-text">Can&apos;t reach the responder</p>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          The incident backend is unreachable. Check that the responder is running (see the
          status badge in the header) — this page retries automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-success">
        All clear
      </span>
      <p className="text-sm font-semibold text-text">No incidents yet</p>
      <p className="max-w-md text-xs leading-relaxed text-muted">
        When the demo app reports an error, the incident appears here and the agent starts
        investigating. This page checks every few seconds and will jump to the first incident
        automatically.
      </p>
    </div>
  );
}
