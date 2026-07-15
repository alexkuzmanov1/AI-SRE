import type { ReactNode } from "react";
import type { Incident, IncidentStatus } from "@/lib/types";
import { utcClock } from "@/lib/time";

const STATUS_CHIP: Record<IncidentStatus, { label: string; className: string }> = {
  investigating: {
    label: "Investigating…",
    className: "text-warning border-warning/40 bg-warning/10",
  },
  resolved: {
    label: "Resolved",
    className: "text-success border-success/40 bg-success/10",
  },
  reverted: {
    label: "Reverted",
    className: "text-danger border-danger/40 bg-danger/10",
  },
  failed: {
    label: "Investigation failed",
    className: "text-danger border-danger/40 bg-danger/10",
  },
};

/**
 * The investigation header: the error message (mono, per F3.1) plus a meta line
 * `METHOD /route · first seen HH:MM UTC · N occurrences`, and a status chip.
 */
export function IncidentHeader({
  incident,
  action,
}: {
  incident: Incident;
  action?: ReactNode;
}) {
  const { error, status, occurrences } = incident;
  const chip = STATUS_CHIP[status];

  return (
    <div className="flex flex-none items-start gap-3.5 border-b border-border-subtle px-7 py-5">
      <div className="flex flex-1 flex-col gap-1.5">
        <h1 className="break-words font-mono text-[17px] font-semibold leading-snug text-text">
          {error.message}
        </h1>
        <p className="text-xs text-muted">
          {error.method} {error.route} · first seen {utcClock(error.firstSeen)} · {occurrences}{" "}
          occurrences
        </p>
      </div>
      <div className="flex flex-none items-center gap-2.5">
        {action}
        <span
          className={`rounded-full border px-2.5 py-1.5 text-[11px] font-medium ${chip.className}`}
        >
          {chip.label}
        </span>
      </div>
    </div>
  );
}
