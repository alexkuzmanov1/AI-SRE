"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { IncidentSidebar } from "@/components/IncidentSidebar";
import { InvestigationView } from "@/components/investigation/InvestigationView";

export default function IncidentPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!id) return null;

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <IncidentSidebar
          selectedId={id}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close incidents"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-fade-in-up absolute left-0 top-0 h-full shadow-2xl shadow-black/60">
            <IncidentSidebar
              selectedId={id}
              onToggleCollapsed={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {/* Main pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-none items-center gap-2 border-b border-border-subtle px-4 py-2.5 text-xs font-medium text-muted-soft md:hidden"
        >
          <span className="font-mono">☰</span> Incidents
        </button>
        <div className="min-h-0 flex-1">
          <InvestigationView id={id} />
        </div>
      </div>
    </div>
  );
}
