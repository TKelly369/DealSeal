import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";

const rows = [
  {
    recordId: "GR-10291",
    dealId: "DL-8841",
    version: "v7",
    status: "Locked",
    hash: "9d1af2e9c0f47be8...",
    lockedAt: "2026-04-22 13:48 UTC",
  },
  {
    recordId: "GR-10308",
    dealId: "DL-8875",
    version: "v2",
    status: "Locked",
    hash: "ef9cbe8811d0ac70...",
    lockedAt: "2026-04-23 09:16 UTC",
  },
  {
    recordId: "GR-10341",
    dealId: "DL-8920",
    version: "v1",
    status: "Draft",
    hash: "pending",
    lockedAt: "Pending lock",
  },
];

export default function GoverningRecordsPage() {
  return (
    <div className="ds-dashboard">
      <Section
        title="Authoritative Governing Records"
        subtitle="Canonical governing records under system custody with deterministic version lineage."
      >
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
                {rows.map((row) => (
                  <tr key={row.recordId}>
                    <td>{row.recordId}</td>
                    <td>{row.dealId}</td>
                    <td>{row.version}</td>
                    <td>
                      <span className={row.status === "Locked" ? "ds-status-pill ds-status-pill--locked" : "ds-status-pill ds-status-pill--review"}>
                        {row.status}
                      </span>
                    </td>
                    <td className="ds-cell-hash">{row.hash}</td>
                    <td>{row.lockedAt}</td>
                    <td>
                      <div className="ds-table-actions">
                        <Button href="/workspace" variant="secondary">
                          View
                        </Button>
                        <Button href="/certified-renderings">Certified Rendering</Button>
                        <Button href="/documents" variant="secondary">
                          Copy
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Section>
    </div>
  );
}
