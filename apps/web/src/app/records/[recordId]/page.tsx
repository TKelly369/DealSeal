import { notFound } from "next/navigation";
import { Section } from "@/components/ui/Section";
import { getDemoRecord } from "@/lib/demo-records";
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
  const record = getDemoRecord(recordId);
  if (!record) {
    notFound();
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
