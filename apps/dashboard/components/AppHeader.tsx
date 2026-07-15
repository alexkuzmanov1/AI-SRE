"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusDot } from "@/components/ui/StatusDot";

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

      <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-success">
        <StatusDot color="var(--color-success)" size={7} pulse />
        <span className="hidden sm:inline">agent online</span>
      </div>
    </header>
  );
}
