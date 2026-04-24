import { notFound } from "next/navigation";
import { getServerApiBaseUrl } from "@/lib/config";

type VerifyResponse = {
  code?: string;
  verificationStatus?: string;
  governingRecordId?: string;
  version?: number;
  status?: string;
  recordHash?: string;
  recordVerifies?: boolean;
  executedAt?: string | null;
  lockedAt?: string | null;
  latestRenderingHash?: string | null;
  latestImageHash?: string | null;
  latestImageFormat?: string | null;
  latestGeneratedAt?: string | null;
  renderingHistory?: Array<{
    id: string;
    mode: string;
    generatedAt?: string;
    renderingHash?: string;
    imageHash?: string | null;
  }>;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

async function fetchVerify(recordId: string): Promise<VerifyResponse> {
  const base = getServerApiBaseUrl();
  const res = await fetch(`${base}/api/verify/${encodeURIComponent(recordId)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const j = (await res.json().catch(() => ({}))) as VerifyResponse;
  if (res.status === 404) return { ...j, code: "NOT_FOUND" };
  if (!res.ok) return { ...j, code: j.code ?? "ERROR" };
  return j;
}

export default async function VerifyPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  if (!isUuid(recordId)) notFound();
  const data = await fetchVerify(recordId);
  if (data.code === "NOT_FOUND" || !data.governingRecordId) {
    notFound();
  }
  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1 style={{ fontSize: "1.25rem" }}>Governing record verification</h1>
      <p style={{ color: "var(--muted, #6b7a8f)" }}>
        {data.verificationStatus === "VERIFIED"
          ? "This governing record’s hash matches the stored content."
          : "The stored hash could not be recomputed to match. Investigate in Deal-Scan."}
      </p>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "0.5rem 1rem",
          fontSize: 14,
        }}
      >
        <dt>Governing record ID</dt>
        <dd style={{ margin: 0, wordBreak: "break-all" }}>{data.governingRecordId}</dd>
        <dt>Version</dt>
        <dd style={{ margin: 0 }}>{data.version}</dd>
        <dt>Status</dt>
        <dd style={{ margin: 0 }}>{data.status}</dd>
        <dt>Record hash</dt>
        <dd style={{ margin: 0, wordBreak: "break-all" }}>{data.recordHash}</dd>
        {data.latestRenderingHash && (
          <>
            <dt>Latest PDF digest (rendering)</dt>
            <dd style={{ margin: 0, wordBreak: "break-all" }}>{data.latestRenderingHash}</dd>
          </>
        )}
        {data.latestImageHash && (
          <>
            <dt>Latest image digest</dt>
            <dd style={{ margin: 0, wordBreak: "break-all" }}>{data.latestImageHash}</dd>
          </>
        )}
        <dt>Executed (if recorded)</dt>
        <dd style={{ margin: 0 }}>{data.executedAt ?? "—"}</dd>
        <dt>Locked (if recorded)</dt>
        <dd style={{ margin: 0 }}>{data.lockedAt ?? "—"}</dd>
        <dt>Last facsimile time</dt>
        <dd style={{ margin: 0 }}>{data.latestGeneratedAt ?? "—"}</dd>
      </dl>
      {data.renderingHistory && data.renderingHistory.length > 0 && (
        <>
          <h2 style={{ fontSize: "1rem", marginTop: "1.5rem" }}>Rendering history</h2>
          <ul style={{ listStyle: "none", padding: 0, fontSize: 13 }}>
            {data.renderingHistory.slice(0, 8).map((e) => (
              <li key={e.id} style={{ borderBottom: "1px solid #e5e7eb", padding: "0.4rem 0" }}>
                <code>{e.mode}</code> · {e.generatedAt ?? "—"}{" "}
                {e.imageHash && (
                  <span>
                    · img <span style={{ fontSize: 11, wordBreak: "break-all" }}>{e.imageHash.slice(0, 12)}…</span>
                  </span>
                )}
                <br />
                <span style={{ fontSize: 11, color: "#64748b", wordBreak: "break-all" }}>{e.renderingHash}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p style={{ fontSize: 12, color: "#94a3b8", marginTop: "2rem" }}>
        Raw contract data and private signatures are not shown. Use authorized Deal-Scan workflows for contract detail.
      </p>
    </div>
  );
}
