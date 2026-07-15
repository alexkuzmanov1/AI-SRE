"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useIncidentClient } from "@/lib/client/provider";
import { useToast } from "@/components/ui/ToastProvider";
import type { Incident, RcaResult, TimelineEntry } from "@/lib/types";
import { RichText } from "@/components/ui/RichText";
import { DiffSnippet } from "@/components/investigation/DiffSnippet";
import { Skeleton } from "@/components/ui/Skeleton";

const SECTION_HEADER =
  "font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted border-b border-border-subtle pb-2";

const TIMELINE_TONE: Record<NonNullable<TimelineEntry["tone"]>, string> = {
  muted: "text-muted",
  danger: "text-danger",
  success: "text-success",
};

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className={SECTION_HEADER}>{title}</span>
      {children}
    </section>
  );
}

function PostmortemSkeleton() {
  return (
    <div className="mx-auto flex w-[720px] max-w-full flex-col gap-6 px-7 py-9">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-6 w-96 max-w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function PostmortemView({ id }: { id: string }) {
  const client = useIncidentClient();
  const { showToast } = useToast();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    let active = true;
    setIncident(null);
    setLoadError(null);
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

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-text">{loadError}</p>
        <Link href="/" className="text-xs text-accent">
          Back to incidents
        </Link>
      </div>
    );
  }

  if (!incident) {
    return <PostmortemSkeleton />;
  }

  // Derive the analysis from the incident record, or the terminal recorded step
  // for an incident still under investigation.
  const rca: RcaResult | undefined =
    incident.rca ?? incident.steps.find((s) => s.type === "rca")?.rca;

  if (!rca) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-text">No postmortem yet</p>
        <p className="text-xs text-muted">
          The agent is still investigating this incident.
        </p>
        <Link href={`/incidents/${id}`} className="mt-1 text-xs text-accent">
          Back to investigation
        </Link>
      </div>
    );
  }

  const prNumber = incident.prNumber ?? rca.prNumber;
  const prUrl = incident.prUrl ?? rca.prUrl;

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(rca.postmortemMd);
      showToast("Postmortem copied as Markdown.", "success");
    } catch {
      showToast("Couldn't access the clipboard.", "error");
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* breadcrumb / action bar */}
      <div className="flex h-[50px] flex-none items-center gap-2.5 border-b border-border-subtle px-7">
        <Link href={`/incidents/${id}`} className="text-xs text-muted no-underline hover:text-text">
          Incidents
        </Link>
        <span className="text-muted-faint">/</span>
        <span className="font-mono text-xs font-medium text-danger">{id}</span>
        <span className="text-muted-faint">/</span>
        <span className="text-xs font-medium text-text">Postmortem</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copyMarkdown}
          className="rounded-md border border-border px-3.5 py-1.5 text-xs font-medium text-muted-soft transition-colors hover:border-muted hover:text-text"
        >
          Copy as Markdown
        </button>
        {prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-2 rounded-md bg-success px-4 py-2 text-xs font-semibold text-bg no-underline transition-colors hover:bg-success-hover"
          >
            View PR #{prNumber} ↗
          </a>
        ) : null}
      </div>

      {/* document */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto flex w-[720px] max-w-full flex-col gap-7 px-7 pb-12 pt-9">
          {/* masthead */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setReviewed((r) => !r)}
              role="checkbox"
              aria-checked={reviewed}
              aria-label="Reviewed by human"
              className="flex w-fit items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-text"
            >
              <span>Postmortem · Generated by Responder · Reviewed by human</span>
              <span className={reviewed ? "text-success" : "text-muted"} aria-hidden>
                {reviewed ? "☑" : "☐"}
              </span>
            </button>
            <h1 className="text-[26px] font-semibold leading-tight text-text">{rca.title}</h1>
            <div className="flex flex-wrap gap-2">
              <Chip className="border-danger/30 bg-danger/[0.09] text-danger">{id}</Chip>
              <Chip className="border-border text-muted-soft">{rca.service}</Chip>
              <Chip className="border-border text-muted-soft">{rca.severity}</Chip>
              <Chip className="border-border text-muted-soft">{rca.date}</Chip>
              {/* Confidence uses the warning token per FRONTEND_TASKS.md (F4.1 / tokens). */}
              <Chip className="border-warning/30 bg-warning/[0.08] text-warning">
                confidence {Math.round(rca.confidence * 100)}%
              </Chip>
            </div>
          </div>

          <Section title="Summary">
            <p className="m-0 text-[13.5px] leading-relaxed text-text-secondary">
              <RichText
                text={rca.summary}
                codeClassName="font-mono text-[12px] bg-panel px-1.5 py-0.5 rounded"
              />
            </p>
          </Section>

          <Section title="Timeline (UTC)">
            <div className="grid grid-cols-[64px_1fr] gap-x-4 gap-y-2 text-[12.5px] leading-normal text-text-secondary">
              {rca.timeline.map((entry, i) => (
                <div key={i} className="contents">
                  <span
                    className={`font-mono text-[11.5px] ${TIMELINE_TONE[entry.tone ?? "muted"]}`}
                  >
                    {entry.time}
                  </span>
                  <span>
                    <RichText
                      text={entry.text}
                      codeClassName="font-mono text-[11.5px] text-text"
                    />
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Root Cause">
            <p className="m-0 text-[13.5px] leading-relaxed text-text-secondary">
              <RichText
                text={rca.rootCause}
                codeClassName="font-mono text-[12px] bg-panel px-1.5 py-0.5 rounded"
              />
            </p>
            <DiffSnippet
              diff={rca.rootCauseSnippet}
              background="panel"
              textClassName="text-[11.5px] leading-[1.7]"
            />
          </Section>

          <Section title="Evidence">
            <div className="flex flex-col gap-2">
              {rca.evidence.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-2.5 text-[12.5px] leading-normal text-text-secondary"
                >
                  <span className="mt-0.5 flex-none font-mono text-[11px] font-semibold text-muted-faint">
                    E{i + 1}
                  </span>
                  <span>
                    <RichText text={item} codeClassName="font-mono text-[11.5px] text-text-secondary" />
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Fix">
            <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-panel px-4 py-3">
              <span className="font-mono text-xs font-semibold text-success">PR #{prNumber}</span>
              <span className="flex-1 text-[12.5px] text-text-secondary">{rca.fixDescription}</span>
              {rca.prMerged ? (
                <span className="rounded-full bg-purple/[0.13] px-2 py-0.5 font-mono text-[10px] font-medium text-purple">
                  merged
                </span>
              ) : null}
            </div>
          </Section>

          <Section title="Action Items">
            <div className="flex flex-col gap-2">
              {rca.actionItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-baseline gap-2.5 text-[12.5px] leading-normal text-text-secondary"
                >
                  <span
                    className={`h-[13px] w-[13px] flex-none self-center rounded-[3px] border ${
                      item.done ? "border-success bg-success/20" : "border-border"
                    }`}
                    aria-hidden
                  />
                  <span>{item.text}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-muted">
                    owner: {item.owner}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </article>
      </div>
    </div>
  );
}
