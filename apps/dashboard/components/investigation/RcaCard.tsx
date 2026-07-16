"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { RcaResult } from "@/lib/types";
import { RichText } from "@/components/ui/RichText";
import { DiffSnippet } from "@/components/investigation/DiffSnippet";

const RCA_DEFAULT_WIDTH = 320;
const RCA_MIN_WIDTH = 300;

function clampWidth(w: number): number {
  const max = Math.min(760, window.innerWidth * 0.65);
  return Math.min(max, Math.max(RCA_MIN_WIDTH, w));
}

/**
 * Root Cause Analysis card shown once the agent produces an RCA (F3.3).
 * Renders the cause, condensed evidence, the proposed-fix diff, the apply
 * action and a deep link to the full postmortem.
 */
export function RcaCard({
  rca,
  postmortemHref,
  onApplyFix,
  applying,
  applyError,
  prUrl,
  prNumber,
}: {
  rca: RcaResult;
  postmortemHref: string;
  onApplyFix: () => void;
  applying: boolean;
  /** Failure state of the last apply-fix attempt, shown inline by the button. */
  applyError?: string | null;
  prUrl?: string;
  prNumber?: number;
}) {
  const bullets = rca.evidenceBrief ?? rca.evidence;
  const hasPr = Boolean(prUrl);

  // Resizable on desktop: drag the left edge; double-click resets.
  const [width, setWidth] = useState(RCA_DEFAULT_WIDTH);
  const asideRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);

  return (
    <aside
      ref={asideRef}
      style={{ "--rca-w": `${width}px` } as React.CSSProperties}
      className="relative flex max-h-[55%] w-full flex-col gap-3.5 overflow-y-auto border-t border-border-subtle bg-panel p-5 lg:max-h-none lg:w-[var(--rca-w)] lg:flex-none lg:border-l lg:border-t-0"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize — double-click to reset"
        onPointerDown={(e) => {
          e.preventDefault();
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const right = asideRef.current?.getBoundingClientRect().right ?? window.innerWidth;
          setWidth(clampWidth(right - e.clientX));
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onDoubleClick={() => setWidth(RCA_DEFAULT_WIDTH)}
        className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize touch-none transition-colors hover:bg-accent/40 lg:block"
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Root Cause Analysis
        </span>
        {/* Confidence uses the warning token per FRONTEND_TASKS.md (F4.1 / tokens). */}
        <span className="font-mono text-[11px] font-semibold text-warning">
          {Math.round(rca.confidence * 100)}%
        </span>
      </div>

      <p className="text-[13.5px] font-semibold leading-snug text-text">{rca.rootCause}</p>

      <div className="flex flex-col gap-2">
        {bullets.map((item, i) => (
          <div key={i} className="flex gap-2 text-[11.5px] leading-normal text-muted-soft">
            <span className="flex-none text-muted-faint">{String(i + 1).padStart(2, "0")}</span>
            <span>
              <RichText text={item} codeClassName="font-mono text-[10.5px] text-text" />
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-none flex-col gap-1.5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          Proposed fix
        </span>
        <DiffSnippet diff={rca.proposedPatch} className="max-h-64 overflow-y-auto" />
      </div>

      {applying ? (
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg bg-success px-4 py-2.5 text-[13px] font-semibold text-bg opacity-70"
        >
          Opening PR…
        </button>
      ) : hasPr ? (
        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full rounded-lg bg-success px-4 py-2.5 text-center text-[13px] font-semibold text-bg no-underline transition-colors hover:bg-success-hover"
        >
          View PR #{prNumber} ↗
        </a>
      ) : (
        <button
          type="button"
          onClick={onApplyFix}
          className="w-full rounded-lg bg-success px-4 py-2.5 text-[13px] font-semibold text-bg transition-colors hover:bg-success-hover"
        >
          {applyError ? "Retry opening PR" : "Open PR with fix"}
        </button>
      )}

      {applyError && !applying ? (
        <p
          role="alert"
          className="m-0 rounded-md border border-danger/30 bg-danger/[0.08] px-3 py-2 text-[11.5px] leading-snug text-danger"
        >
          {applyError}
        </p>
      ) : null}

      <Link
        href={postmortemHref}
        className="bg-transparent text-center text-[11.5px] font-medium text-muted-soft no-underline transition-colors hover:text-text"
      >
        View full postmortem →
      </Link>
    </aside>
  );
}
