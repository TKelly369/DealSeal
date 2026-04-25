import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { getGoverningRecords } from "@/lib/api";
import { DownloadRenderingButtons } from "@/components/DownloadRenderingButtons";

function formatLockedDate(value: string | null): string {
  if (!value) return "Pending lock";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function truncateHash(hash: string): string {
  if (!hash || hash.length <= 16) return hash;
  return `${hash.slice(0, 12)}...${hash.slice(-4)}`;
}

export default async function GoverningRecordsPage() {
  let records:
    | {
        id: string;
        dealId: string;
        version: number;
        status: string;
        hash: string;
        lockedAt: string | null;
      }[]
    | null = null;
  let loadError: string | null = null;

  try {
    records = await getGoverningRecords();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Unable to load governing records";
  }

  return (
    <div className="ds-dashboard">
      <Section
        title="Authoritative Governing Records"
        subtitle="Canonical governing records under system custody with deterministic version lineage."
      >
        {loadError ? (
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Data unavailable</p>
            <p className="ds-card-panel__body">
              Governing records could not be loaded right now. {loadError}
            </p>
          </Card>
        ) : null}

        {!records ? (
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Loading governing records…</p>
            <p className="ds-card-panel__body">Fetching authoritative record index from API.</p>
          </Card>
        ) : (
          <Card>
            <div className="ds-table-wrap">
              <table className="ds-table" aria-label="Authoritative governing records">
                <thead>
                  <tr>
                    <th>Record ID</th>
                    <th>Deal ID</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Hash</th>
                    <th>Locked At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={7}>No governing records available.</td>
                    </tr>
                  ) : (
                    records.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.dealId}</td>
                        <td>{row.version}</td>
                        <td>
                          <span
                            className={
                              row.status === "Locked"
                                ? "ds-status-pill ds-status-pill--locked"
                                : "ds-status-pill ds-status-pill--review"
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="ds-cell-hash">{truncateHash(row.hash)}</td>
                        <td>{formatLockedDate(row.lockedAt)}</td>
                        <td>
                          <div className="ds-table-actions">
                            <Button href="/workspace" variant="secondary">
                              View
                            </Button>
                            <Button href="/certified-renderings">Certified Rendering</Button>
                            <DownloadRenderingButtons governingRecordId={row.id} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}
