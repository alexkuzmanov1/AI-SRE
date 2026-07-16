"use client";

import { useCallback, useEffect, useState } from "react";
import { useIncidentClient } from "@/lib/client/provider";
import { ApiError } from "@/lib/client/http";
import { useRefresh } from "@/lib/refresh";
import { useToast } from "@/components/ui/ToastProvider";
import { useIncidentStream } from "@/hooks/useIncidentStream";
import type { Incident } from "@/lib/types";
import { IncidentHeader } from "@/components/investigation/IncidentHeader";
import { StepStream } from "@/components/investigation/StepStream";
import { RcaCard } from "@/components/investigation/RcaCard";
import { Skeleton } from "@/components/ui/Skeleton";

function InvestigationSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-col gap-2 border-b border-border-subtle px-7 py-5">
        <Skeleton className="h-6 w-2/3 max-w-xl" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-7">
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-16 w-full max-w-lg" />
        <Skeleton className="h-16 w-full max-w-lg" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
    </div>
  );
}

export function InvestigationView({ id }: { id: string }) {
  const client = useIncidentClient();
  const { showToast } = useToast();
  const { refresh } = useRefresh();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);

  const { steps, isStreaming, rcaStep } = useIncidentStream(id);

  useEffect(() => {
    let active = true;
    setIncident(null);
    setLoadError(null);
    setApplyError(null);
    client
      .getIncident(id)
      .then((inc) => {
        if (active) setIncident(inc);
      })
      .catch(() => {
        if (active) setLoadError(`Incident ${id} could not be loaded.`);
      });
    return () => {
      active = false;
    };
  }, [client, id]);

  // The RCA becomes available either from the incident record (resolved) or from
  // the terminal streamed step (active incident revealing its analysis live).
  const rca = incident?.rca ?? rcaStep?.rca;
  const prUrl = incident?.prUrl ?? rca?.prUrl;
  const prNumber = incident?.prNumber ?? rca?.prNumber;
  const hasOpenPr = Boolean(incident?.prUrl);

  const onApplyFix = useCallback(async () => {
    if (!rca) {
      showToast("No root cause available yet — cannot open a PR.", "error");
      return;
    }
    setApplying(true);
    setApplyError(null);
    const snapshot = incident;
    // Optimistic: flip status to resolved. The PR link itself is attached only
    // once the server returns it, so the card shows the pending state until then.
    setIncident((prev) => (prev ? { ...prev, status: "resolved", rca: prev.rca ?? rca } : prev));
    try {
      const res = await client.applyFix(id);
      setIncident((prev) =>
        prev
          ? {
              ...prev,
              status: "resolved",
              prNumber: res.prNumber,
              prUrl: res.prUrl,
              prMerged: true,
              rca: prev.rca
                ? { ...prev.rca, prNumber: res.prNumber, prUrl: res.prUrl, prMerged: true }
                : prev.rca,
            }
          : prev,
      );
      refresh();
      const isMock = (process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock") !== "api";
      showToast(
        isMock
          ? `Simulated PR #${res.prNumber} (mock data — no real PR was opened).`
          : `Opened PR #${res.prNumber} — incident resolved.`,
        "success",
      );
    } catch (err) {
      // Reconcile: reload the authoritative state (or restore the snapshot).
      const fresh = await client.getIncident(id).catch(() => null);
      setIncident(fresh ?? snapshot);
      // Map the two contract failures to specific states; generic otherwise.
      const message =
        err instanceof ApiError && err.status === 409
          ? "Patch failed to apply — the branch has diverged."
          : err instanceof ApiError && err.status === 400
            ? "No RCA yet — wait for the investigation to finish."
            : "Couldn't open the PR. Please try again.";
      setApplyError(message);
      showToast(message, "error");
    } finally {
      setApplying(false);
    }
  }, [client, id, incident, rca, refresh, showToast]);

  const onRevert = useCallback(async () => {
    setReverting(true);
    const snapshot = incident;
    setIncident((prev) => (prev ? { ...prev, status: "reverted" } : prev));
    try {
      await client.revert(id);
      const fresh = await client.getIncident(id).catch(() => null);
      if (fresh) setIncident(fresh);
      refresh();
      showToast("Fix reverted.", "info");
    } catch {
      setIncident(snapshot);
      showToast("Couldn't revert the fix.", "error");
    } finally {
      setReverting(false);
    }
  }, [client, id, incident, refresh, showToast]);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-text">{loadError}</p>
        <p className="text-xs text-muted">
          It may not exist, or the responder backend is unavailable.
        </p>
      </div>
    );
  }

  if (!incident) {
    return <InvestigationSkeleton />;
  }

  const canRevert = incident.status === "resolved";

  return (
    <div className="flex h-full flex-col">
      <IncidentHeader
        incident={incident}
        action={
          canRevert ? (
            <button
              type="button"
              onClick={onRevert}
              disabled={reverting}
              className="rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-muted-soft transition-colors hover:border-muted hover:text-text disabled:opacity-60"
            >
              {reverting ? "Reverting…" : "Revert fix"}
            </button>
          ) : null
        }
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <StepStream steps={steps} isStreaming={isStreaming} />
        {rca ? (
          <RcaCard
            rca={rca}
            postmortemHref={`/incidents/${id}/postmortem`}
            onApplyFix={onApplyFix}
            applying={applying}
            applyError={applyError}
            prUrl={hasOpenPr ? prUrl : undefined}
            prNumber={hasOpenPr ? prNumber : undefined}
          />
        ) : null}
      </div>
    </div>
  );
}
