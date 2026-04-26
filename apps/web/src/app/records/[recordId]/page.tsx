import Link from "next/link";
import { RecordDetailClient } from "@/components/contract/RecordDetailClient";
import { getDemoRecordById } from "@/lib/demo-records";

export default async function RecordDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId: rawRecordId } = await params;
  const record = getDemoRecordById(decodeURIComponent(rawRecordId));

  if (!record) {
    return (
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Record not found</h1>
        <p style={{ color: "var(--text-secondary)" }}>The requested demo record is unavailable.</p>
        <Link className="btn btn-secondary" href="/">
          Return to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <p style={{ margin: "0 0 0.8rem" }}>
        <Link href="/">Back to dashboard</Link>
      </p>
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ marginBottom: "0.5rem", fontSize: "1.65rem" }}>Governing Record</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Generate a certified rendering or non-authoritative convenience copy from one authoritative source body.
        </p>
      </header>

      <RecordDetailClient record={record} />
    </div>
  );
}
