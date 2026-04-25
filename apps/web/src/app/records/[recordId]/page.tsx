import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { RecordRenderActions } from "@/components/RecordRenderActions";
import { getRecord } from "@/lib/api";

function formatDate(value: string | null): string {
  if (!value) return "Pending";
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

function renderContractPreview(contractData: unknown): React.ReactNode {
  const serialized = JSON.stringify(contractData, null, 2);
  return <pre className="ds-record-preview">{serialized}</pre>;
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  let record;
  try {
    record = await getRecord(recordId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The record service is unavailable.";
    return (
      <div className="ds-dashboard">
        <Section
          title="Contract Record Detail"
          subtitle="Authoritative governing record content and rendering controls."
        >
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Record unavailable</p>
            <p className="ds-card-panel__body">
              {message}
            </p>
          </Card>
        </Section>
      </div>
    );
  }

  return (
    <div className="ds-dashboard">
      <Section
        title="Contract Record Detail"
        subtitle="Authoritative governing record content and rendering controls."
      >
        <div className="ds-dashboard-grid ds-dashboard-grid--two">
          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Metadata</p>
            <div className="ds-status-list">
              <li>
                <span>Record ID</span>
                <strong className="ds-table__mono">{record.id}</strong>
              </li>
              <li>
                <span>Hash</span>
                <strong className="ds-table__mono">{record.hash}</strong>
              </li>
              <li>
                <span>Version</span>
                <strong>{record.version}</strong>
              </li>
              <li>
                <span>Status</span>
                <strong>{record.status}</strong>
              </li>
              <li>
                <span>Created</span>
                <strong>{formatDate(record.createdAt)}</strong>
              </li>
              <li>
                <span>Locked</span>
                <strong>{formatDate(record.lockedAt)}</strong>
              </li>
            </div>
            <RecordRenderActions recordId={record.id} />
          </Card>

          <Card className="ds-card-panel">
            <p className="ds-card-panel__title">Contract Preview</p>
            <p className="ds-card-panel__body">
              Full governing contract payload from system custody.
            </p>
            {renderContractPreview(record.contractData)}
          </Card>
        </div>
      </Section>
    </div>
  );
}
