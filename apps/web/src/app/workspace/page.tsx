import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { getRecords } from "@/lib/api";

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function WorkspacePage() {
  let records = await getRecords().catch(() => []);

  return (
    <div className="ds-dashboard">
      <Section
        title="Contract Workspace"
        subtitle="Operational index of authoritative governing records and transaction lineage."
      >
        <Card>
          <div className="ds-table-wrap">
            <table className="ds-table" aria-label="Governing records workspace table">
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Deal ID</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ds-empty-state">
                      No governing records found.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <Link href={`/records/${record.id}`}>{record.id}</Link>
                      </td>
                      <td>{record.dealId}</td>
                      <td>{record.version}</td>
                      <td>
                        <span className="ds-status-pill ds-status-pill--locked">{record.status}</span>
                      </td>
                      <td>{formatTimestamp(record.createdAt ?? null)}</td>
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
