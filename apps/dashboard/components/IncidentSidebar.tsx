"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIncidentClient } from "@/lib/client/provider";
import { useRefresh } from "@/lib/refresh";
import type { IncidentFilter } from "@/lib/client/types";
import type { IncidentSummary } from "@/lib/types";
import { relativeTime } from "@/lib/time";
import { StatusDot } from "@/components/ui/StatusDot";
import { Skeleton } from "@/components/ui/Skeleton";

const FILTERS: { key: IncidentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
];

function IncidentRow({
  incident,
  selected,
  onNavigate,
}: {
  incident: IncidentSummary;
  selected: boolean;
  onNavigate?: () => void;
}) {
  const live = incident.status === "investigating";
  const titleColor = live || selected ? "text-text" : "text-muted-soft";
  const titleWeight = live ? "font-semibold" : "font-medium";

  return (
    <Link
      href={`/incidents/${incident.id}`}
      onClick={onNavigate}
      className={`flex flex-col gap-1.5 border-b border-border-subtle px-[18px] py-3 no-underline transition-colors ${
        selected
          ? "bg-panel shadow-[inset_3px_0_0_var(--color-danger)]"
          : "hover:bg-panel/60"
      }`}
    >
      <div className="flex items-center gap-2">
        <StatusDot
          color={live ? "var(--color-danger)" : "var(--color-success)"}
          pulse={live}
        />
        <span
          className={`flex-1 truncate text-[12.5px] ${titleWeight} ${titleColor}`}
          title={incident.title}
        >
          {incident.title}
        </span>
        {live ? (
          <span className="animate-pulse rounded-full bg-danger/[0.13] px-[7px] py-0.5 font-mono text-[10px] font-medium text-danger">
            live
          </span>
        ) : null}
      </div>
      <div className="pl-4 font-mono text-[11px] text-muted">
        {incident.service} · ×{incident.occurrences} · {relativeTime(incident.updatedAt)}
      </div>
    </Link>
  );
}

/** Collapsed 46px strip with quick counts (from the mockup). */
function CollapsedStrip({
  openCount,
  resolvedCount,
  onExpand,
}: {
  openCount: number;
  resolvedCount: number;
  onExpand: () => void;
}) {
  return (
    <div className="flex h-full w-[46px] flex-none flex-col items-center gap-3.5 border-r border-border-subtle bg-bg py-3">
      <button
        type="button"
        onClick={onExpand}
        title="Expand incidents"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border font-mono text-xs text-muted-soft transition-colors hover:border-muted hover:text-text"
      >
        »
      </button>
      <div className="flex flex-col items-center gap-1.5">
        <StatusDot color="var(--color-danger)" />
        <span className="font-mono text-[10px] font-semibold text-text">{openCount}</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <StatusDot color="var(--color-success)" />
        <span className="font-mono text-[10px] font-semibold text-muted">{resolvedCount}</span>
      </div>
      <span
        className="mt-1 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-muted-faint"
        style={{ writingMode: "vertical-rl" }}
      >
        Incidents
      </span>
    </div>
  );
}

export function IncidentSidebar({
  selectedId,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: {
  selectedId: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const client = useIncidentClient();
  const { version } = useRefresh();
  const [filter, setFilter] = useState<IncidentFilter>("all");
  const [list, setList] = useState<IncidentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });

  // Filtered list drives the visible rows (tabs -> listIncidents(filter)).
  useEffect(() => {
    let active = true;
    setError(null);
    setList(null);
    client
      .listIncidents(filter)
      .then((rows) => {
        if (active) setList(rows);
      })
      .catch(() => {
        if (active) {
          setError("Couldn't load incidents");
          setList([]);
        }
      });
    return () => {
      active = false;
    };
  }, [client, filter, version]);

  // Full list feeds the collapsed strip's counts.
  useEffect(() => {
    let active = true;
    client
      .listIncidents("all")
      .then((all) => {
        if (!active) return;
        setCounts({
          open: all.filter((i) => i.status !== "resolved").length,
          resolved: all.filter((i) => i.status === "resolved").length,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [client, version]);

  if (collapsed) {
    return (
      <CollapsedStrip
        openCount={counts.open}
        resolvedCount={counts.resolved}
        onExpand={() => onToggleCollapsed?.()}
      />
    );
  }

  return (
    <div className="flex h-full w-[316px] flex-none flex-col border-r border-border-subtle bg-bg">
      <div className="flex items-start gap-2 px-[18px] pb-3 pt-[18px]">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-text">Incidents</span>
          <span className="text-[11.5px] text-muted">demo-app · production</span>
        </div>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse incidents"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border font-mono text-xs text-muted-soft transition-colors hover:border-muted hover:text-text"
          >
            «
          </button>
        ) : null}
      </div>

      <div className="flex gap-1.5 px-[18px] pb-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === f.key
                ? "bg-text text-bg"
                : "border border-border text-muted-soft hover:text-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list === null ? (
          <div className="flex flex-col gap-2 px-[18px] py-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <div className="px-[18px] py-6 text-[12px] text-muted">{error}</div>
        ) : list.length === 0 ? (
          <div className="px-[18px] py-10 text-center text-[12px] text-muted">
            No {filter === "all" ? "" : filter} incidents.
          </div>
        ) : (
          list.map((inc) => (
            <IncidentRow
              key={inc.id}
              incident={inc}
              selected={inc.id === selectedId}
              onNavigate={onNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
