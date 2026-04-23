import { AnalyticsClient } from "./AnalyticsClient";

export default function AnalyticsPage() {
  return (
    <div className="page">
      <h1>Analytics</h1>
      <p style={{ color: "var(--muted)" }}>
        Live metrics from <code>GET /analytics/dashboard</code> and advanced reports (paid tier).
      </p>
      <AnalyticsClient />
    </div>
  );
}
