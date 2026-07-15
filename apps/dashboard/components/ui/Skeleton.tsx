/** Shimmer placeholder block used by loading states (F6.2). */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`shimmer animate-shimmer rounded ${className}`} style={style} aria-hidden />;
}
