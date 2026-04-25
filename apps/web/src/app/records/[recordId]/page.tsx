import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { getRecord } from "@/lib/api";
import { RecordDetailClient } from "./record-detail-client";

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
        <RecordDetailClient
          recordId={record.id}
          dealId={record.dealId}
          recordHash={record.hash}
          version={record.version}
          status={record.status}
          createdAtLabel={formatDate(record.createdAt)}
          lockedAtLabel={formatDate(record.lockedAt)}
          timestamp={record.createdAt ?? new Date().toISOString()}
          contractData={record.contractData}
        />
      </Section>
    </div>
  );
}
