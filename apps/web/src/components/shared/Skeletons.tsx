import { Skeleton } from "@/components/ui/skeleton";

export function MetricCardSkeleton() {
  return (
    <div className="card">
      <Skeleton className="ds-skeleton-line sm" />
      <Skeleton className="ds-skeleton-line lg" />
      <Skeleton className="ds-skeleton-line xs" />
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="card">
      <Skeleton className="ds-skeleton-line md" />
      <Skeleton className="ds-skeleton-row" />
      <Skeleton className="ds-skeleton-row" />
      <Skeleton className="ds-skeleton-row" />
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="card">
      <Skeleton className="ds-skeleton-line sm" />
      <Skeleton className="ds-skeleton-line full" />
      <Skeleton className="ds-skeleton-line long" />
      <Skeleton className="ds-skeleton-line md" />
    </div>
  );
}
