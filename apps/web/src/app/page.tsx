import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { getDashboardMetrics, getRecords } from "@/lib/api";

export default async function Home() {
  let metrics = {
    totalContracts: 0,
    certifiedRenderings: 0,
    verificationRequests: 0,
    activeDeals: 0,
  };
  let recent: Awaited<ReturnType<typeof getRecords>> = [];
  let dataUnavailable = false;

  try {
    const [fetchedMetrics, fetchedRecords] = await Promise.all([getDashboardMetrics(), getRecords()]);
    metrics = fetchedMetrics;
    recent = fetchedRecords.slice(0, 6);
  } catch {
    dataUnavailable = true;
  }

  return (
    <div className="ds-dashboard">
      <Section
        title="DealSeal Contract Authority Dashboard"
        subtitle="Financial-grade operations for authoritative governing records, certified visual renderings, and verification integrity."
        actions={
          <>
            <Button href="/workspace">Contracts</Button>
            <Button href="/packages" variant="secondary">
              Packages
            </Button>
          </>
        }
      >
        {dataUnavailable ? (
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Live data temporarily unavailable</p>
            <p className="ds-card-panel__body">
              Dashboard metrics and recent contracts will repopulate automatically once API connectivity is restored.
            </p>
          </Card>
        ) : null}
        <div className="ds-dashboard-grid ds-dashboard-grid--three">
          <Card className="ds-stat-card">
            <p className="ds-stat-card__label">Total Contracts</p>
            <p className="ds-stat-card__value">{metrics.totalContracts}</p>
            <p className="ds-stat-card__description">Authoritative records under custody</p>
          </Card>
          <Card className="ds-stat-card">
            <p className="ds-stat-card__label">Certified Renderings</p>
            <p className="ds-stat-card__value">{metrics.certifiedRenderings}</p>
            <p className="ds-stat-card__description">Certified PDF outputs generated</p>
          </Card>
          <Card className="ds-stat-card">
            <p className="ds-stat-card__label">Verification Requests</p>
            <p className="ds-stat-card__value">{metrics.verificationRequests}</p>
            <p className="ds-stat-card__description">Public authenticity checks</p>
          </Card>
        </div>
      </Section>

      <Section title="Recent contracts" subtitle="Latest governing records available for rendering and verification.">
        <Card>
          <div className="ds-table-wrap">
            <table className="ds-table" aria-label="Recent contracts">
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Deal ID</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No governing records available.</td>
                  </tr>
                ) : (
                  recent.map((record) => (
                    <tr key={record.id}>
                      <td className="ds-table__mono">{record.id}</td>
                      <td>{record.dealId}</td>
                      <td>{record.version}</td>
                      <td>
                        <span className="ds-status-pill ds-status-pill--locked">{record.status}</span>
                      </td>
                      <td>{record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}</td>
                      <td>
                        <div className="ds-table__actions">
                          <Button href={`/records/${record.id}`} variant="secondary">
                            Open
                          </Button>
                          <Button href={`/verify/${record.id}`}>Verify</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </div>
  );
}
