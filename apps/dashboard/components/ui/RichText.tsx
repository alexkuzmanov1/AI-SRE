import { Fragment } from "react";

/**
 * Renders text with `inline code` spans (delimited by backticks) styled in mono.
 * Used for agent thoughts, postmortem prose and timeline entries.
 */
export function RichText({
  text,
  codeClassName = "font-mono text-[0.85em] bg-border-subtle text-text px-1.5 py-0.5 rounded",
}: {
  text: string;
  codeClassName?: string;
}) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 1 && part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className={codeClassName}>
              {part.slice(1, -1)}
            </code>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
