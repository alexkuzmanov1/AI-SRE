"use client";

import Link from "next/link";
import type { RcaResult } from "@/lib/types";
import { RichText } from "@/components/ui/RichText";
import { DiffSnippet } from "@/components/investigation/DiffSnippet";

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
  prUrl,
  prNumber,
}: {
  rca: RcaResult;
  postmortemHref: string;
  onApplyFix: () => void;
  applying: boolean;
  prUrl?: string;
  prNumber?: number;
}) {
  const bullets = rca.evidenceBrief ?? rca.evidence;
  const hasPr = Boolean(prUrl);

  return (
    <aside className="flex max-h-[55%] w-full flex-col gap-3.5 overflow-y-auto border-t border-border-subtle bg-panel p-5 lg:max-h-none lg:w-80 lg:flex-none lg:border-l lg:border-t-0">
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

      <DiffSnippet diff={rca.proposedPatch} />

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
          Open PR with fix
        </button>
      )}

      <Link
        href={postmortemHref}
        className="bg-transparent text-center text-[11.5px] font-medium text-muted-soft no-underline transition-colors hover:text-text"
      >
        View full postmortem →
      </Link>
    </aside>
  );
}
