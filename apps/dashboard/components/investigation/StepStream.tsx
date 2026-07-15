"use client";

import { useEffect, useRef } from "react";
import type { AgentStep } from "@/lib/types";
import { RichText } from "@/components/ui/RichText";
import { StatusDot } from "@/components/ui/StatusDot";

/** A tool call plus its (optional) paired result, rendered as one card. */
interface ToolRow {
  kind: "tool";
  call: AgentStep;
  result?: AgentStep;
}
interface ThoughtRow {
  kind: "thought";
  step: AgentStep;
}
type Row = ToolRow | ThoughtRow;

/** Format `get_logs` + `{ service, window }` as `get_logs(checkout-api, 30m)`. */
function formatToolCall(step: AgentStep): string {
  const args = step.toolInput ? Object.values(step.toolInput).map((v) => String(v)) : [];
  return `${step.toolName ?? "tool"}(${args.join(", ")})`;
}

/** Fold the flat step list into display rows, pairing tool_call → tool_result. */
function toRows(steps: AgentStep[]): Row[] {
  const rows: Row[] = [];
  for (const step of steps) {
    if (step.type === "rca") continue; // the RCA renders in its own card, not the timeline
    if (step.type === "tool_result") {
      const last = rows[rows.length - 1];
      if (last && last.kind === "tool" && !last.result) {
        last.result = step;
      } else {
        rows.push({ kind: "tool", call: step });
      }
      continue;
    }
    if (step.type === "tool_call") rows.push({ kind: "tool", call: step });
    else rows.push({ kind: "thought", step });
  }
  return rows;
}

function RailDot({ variant }: { variant: "thought" | "tool" }) {
  return (
    <div className="flex w-[22px] flex-none justify-center">
      {variant === "tool" ? (
        <span
          className="mt-[9px] h-[9px] w-[9px] rounded-full border-2 border-bg bg-accent"
          style={{ outline: "1.5px solid var(--color-accent)" }}
        />
      ) : (
        <span className="mt-1 h-[9px] w-[9px] rounded-full border-2 border-muted bg-bg" />
      )}
    </div>
  );
}

export function StepStream({
  steps,
  isStreaming,
}: {
  steps: AgentStep[];
  isStreaming: boolean;
}) {
  const rows = toRows(steps);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest step as the feed grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps.length, isStreaming]);

  return (
    <div className="relative flex-1 overflow-y-auto px-7 py-6" aria-live="polite">
      {/* vertical rail */}
      <div className="pointer-events-none absolute bottom-5 left-[38px] top-8 w-px bg-border-subtle" />

      <div className="relative flex flex-col gap-4">
        {rows.map((row, i) => {
          if (row.kind === "thought") {
            return (
              <div key={`t-${row.step.index}-${i}`} className="animate-fade-in-up flex gap-4">
                <RailDot variant="thought" />
                <div className="max-w-[560px] text-[13px] leading-[1.55] text-muted-soft">
                  <RichText text={row.step.content ?? ""} />
                </div>
              </div>
            );
          }
          return (
            <div key={`c-${row.call.index}-${i}`} className="animate-fade-in-up flex gap-4">
              <RailDot variant="tool" />
              <div className="flex max-w-[560px] flex-1 flex-col gap-1 rounded-lg border border-border-subtle bg-panel px-3.5 py-2.5">
                <span className="font-mono text-[11.5px] font-semibold text-accent">
                  {formatToolCall(row.call)}
                </span>
                {row.result?.toolResult ? (
                  <span className="font-mono text-[11px] leading-relaxed text-muted">
                    {row.result.toolResult}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {isStreaming ? (
          <div className="flex gap-4">
            <div className="flex w-[22px] flex-none justify-center">
              <StatusDot color="var(--color-accent)" size={9} pulse className="mt-1" />
            </div>
            <div className="flex max-w-[560px] flex-1 items-center gap-2.5">
              <div className="shimmer animate-shimmer h-3 flex-1 rounded" />
              <span className="font-mono text-[11px] text-muted">working…</span>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
