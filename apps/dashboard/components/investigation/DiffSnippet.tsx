type LineKind = "add" | "remove" | "hunk" | "comment" | "context";

function classify(line: string): LineKind {
  const t = line.trimStart();
  if (t.startsWith("@@")) return "hunk";
  if (t.startsWith("//")) return "comment";
  if (t.startsWith("--")) return "comment"; // SQL comment (two dashes) — before single '-'
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "remove";
  return "context";
}

const KIND_COLOR: Record<Exclude<LineKind, "context">, string> = {
  add: "var(--color-success)",
  remove: "var(--color-danger)",
  hunk: "var(--color-muted)",
  comment: "var(--color-muted)",
};

/** Split a context line's trailing `// comment` so it can be muted. */
function splitContext(line: string): { code: string; comment?: string } {
  const idx = line.indexOf("//");
  if (idx > 0) return { code: line.slice(0, idx), comment: line.slice(idx) };
  return { code: line };
}

/**
 * Renders a unified-diff snippet with added/removed lines colored via the
 * success/danger tokens. Used by the RCA card (proposed fix) and the postmortem
 * ROOT CAUSE section (offending change).
 */
export function DiffSnippet({
  diff,
  background = "bg",
  className = "",
  textClassName = "text-[10.5px] leading-[1.6]",
}: {
  diff: string;
  background?: "bg" | "panel";
  className?: string;
  textClassName?: string;
}) {
  const lines = diff.replace(/\n$/, "").split("\n");
  const bgClass = background === "panel" ? "bg-panel" : "bg-bg";
  return (
    <pre
      className={`overflow-x-auto rounded-lg border border-border-subtle ${bgClass} px-3.5 py-3 font-mono text-muted-soft ${textClassName} ${className}`}
    >
      <code>
        {lines.map((line, i) => {
          const kind = classify(line);
          if (kind === "context") {
            const { code, comment } = splitContext(line);
            return (
              <div key={i}>
                {code}
                {comment ? <span style={{ color: "var(--color-muted)" }}>{comment}</span> : null}
                {code === "" && !comment ? " " : null}
              </div>
            );
          }
          return (
            <div key={i} style={{ color: KIND_COLOR[kind] }}>
              {line || " "}
            </div>
          );
        })}
      </code>
    </pre>
  );
}
