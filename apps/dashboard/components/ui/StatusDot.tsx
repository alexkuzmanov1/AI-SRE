/** A small colored dot; `pulse` adds the breathing animation used for live status. */
export function StatusDot({
  color,
  size = 8,
  pulse = false,
  className = "",
}: {
  color: string;
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full flex-none ${pulse ? "animate-pulse-dot" : ""} ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}
