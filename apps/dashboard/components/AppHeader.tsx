"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusDot } from "@/components/ui/StatusDot";
import { useIncidentClient } from "@/lib/client/provider";

const HEALTH_POLL_MS = 10_000;

/** Whether the app is running on fixture data instead of the real responder. */
const IS_MOCK = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") !== "api";

type AgentHealth = "checking" | "online" | "offline";

/** Live responder reachability, polled over the client seam. */
function useAgentHealth(): AgentHealth {
  const client = useIncidentClient();
  const [health, setHealth] = useState<AgentHealth>("checking");

  useEffect(() => {
    let active = true;
    const check = async () => {
      const ok = await client.health();
      if (active) setHealth(ok ? "online" : "offline");
    };
    void check();
    const timer = setInterval(check, HEALTH_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client]);

  return health;
}

const HEALTH_BADGE: Record<AgentHealth, { color: string; label: string; text: string }> = {
  checking: { color: "var(--color-muted)", label: "checking…", text: "text-muted" },
  online: { color: "var(--color-success)", label: "agent online", text: "text-success" },
  offline: { color: "var(--color-danger)", label: "agent offline", text: "text-danger" },
};

/** Pull the incident id out of the current path, defaulting to the demo incident. */
function currentIncidentId(pathname: string): string {
  const match = pathname.match(/\/incidents\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "INC-7";
}

const TAB_BASE =
  "rounded-md px-3.5 py-1.5 text-xs transition-colors border";
// F1.2: active tab uses the accent color, inactive uses muted.
const TAB_ACTIVE = "font-medium text-accent bg-border-subtle border-border";
const TAB_IDLE = "text-muted bg-transparent border-transparent hover:text-text";

export function AppHeader() {
  const pathname = usePathname();
  const health = useAgentHealth();
  const badge = HEALTH_BADGE[health];
  const id = currentIncidentId(pathname);
  const isPostmortem = pathname.endsWith("/postmortem");
  const isDashboard = !isPostmortem;

  return (
    <header className="flex h-[52px] flex-none items-center gap-4 border-b border-border-subtle px-5">
      <Link href={`/incidents/${id}`} className="flex items-center gap-2.5 no-underline">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] bg-danger font-mono text-[11px] font-semibold text-bg">
          R
        </span>
        <span className="text-sm font-semibold text-text">responder</span>
      </Link>

      <span className="hidden rounded-full border border-border-subtle px-2 py-[3px] font-mono text-[11px] font-medium text-muted sm:inline">
        demo-app · production
      </span>

      <nav className="ml-2 flex gap-1">
        <Link href={`/incidents/${id}`} className={`${TAB_BASE} ${isDashboard ? TAB_ACTIVE : TAB_IDLE}`}>
          Dashboard
        </Link>
        <Link
          href={`/incidents/${id}/postmortem`}
          className={`${TAB_BASE} ${isPostmortem ? TAB_ACTIVE : TAB_IDLE}`}
        >
          Postmortem · {id}
        </Link>
      </nav>

      <div className="flex-1" />

      {IS_MOCK ? (
        <div
          className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-warning"
          title="NEXT_PUBLIC_DATA_SOURCE is not 'api' — showing fixture data; incidents and PRs are simulated"
        >
          <StatusDot color="var(--color-warning)" size={7} />
          <span className="hidden sm:inline">mock data — no live agent</span>
        </div>
      ) : (
        <div
          className={`flex items-center gap-1.5 font-mono text-[11px] font-medium ${badge.text}`}
          title="Live responder /health check, polled every 10s"
        >
          <StatusDot color={badge.color} size={7} pulse={health === "online"} />
          <span className="hidden sm:inline">{badge.label}</span>
        </div>
      )}
    </header>
  );
}
