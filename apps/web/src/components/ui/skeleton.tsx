export function Skeleton({ className }: { className?: string }) {
  return <div className={`ds-skeleton ${className ?? ""}`.trim()} aria-hidden />;
}
