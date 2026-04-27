import { FeedSkeleton, MetricCardSkeleton, TableSkeleton } from "@/components/shared/Skeletons";

export default function DashboardLoading() {
  return (
    <div className="ds-dashboard-page">
      <div className="ds-dashboard-metrics">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <section className="ds-dashboard-main-grid">
        <TableSkeleton />
        <FeedSkeleton />
      </section>
    </div>
  );
}
