import Link from "next/link";
import { getServerApiBaseUrl } from "@/lib/config";

type VerifyResponse = {
  code?: string;
  message?: string;
  verificationStatus?: string;
  governingRecordId?: string;
  recordId?: string;
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
  let res: Response;
  try {
    res = await fetch(`${base}/api/verify/${encodeURIComponent(recordId)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch {
    return { code: "UNAVAILABLE" };
  }
  const j = (await res.json().catch(() => ({}))) as VerifyResponse;
  if (res.status === 400) return { ...j, code: "INVALID_ID" };
  if (res.status === 404) return { ...j, code: "NOT_FOUND" };
  if (!res.ok) return { ...j, code: j.code ?? "ERROR" };
  return j;
}

function StatusBadge({ status }: { status: string | undefined }) {
  const s = (status ?? "").toUpperCase();
  if (s === "VERIFIED") {
    return <span className="badge ds-badge--verified">Verified</span>;
  }
  if (s === "MISMATCH") {
    return <span className="badge ds-badge--error">Hash mismatch</span>;
  }
  return <span className="badge">{status ?? "—"}</span>;
}

function QrNote() {
  return (
    <div className="ds-verify-qr-note">
      <strong style={{ color: "var(--text)" }}>QR code on certified renderings</strong> points to this public page
      (not a raw download). Scanning confirms you are viewing the same verification context as the PDF or image
      facsimile. Full contract text and private signatures are never shown here.
    </div>
  );
}

function NotFoundOrCertified() {
  return (
    <div className="ds-verify">
      <h1>Record verification</h1>
      <p className="ds-verify__lead">DealSeal public verification (read-only)</p>
      <div className="card" style={{ borderColor: "var(--border-bright)" }}>
        <p className="ds-card-title">Not found</p>
        <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
          Record not found or not yet certified. The governing record may not exist, or it may not be available for
          public verification yet.
        </p>
        <p style={{ marginTop: "1rem" }}>
          <Link className="btn btn-secondary" href="/">
            Return home
          </Link>
        </p>
      </div>
    </div>
  );
}

function InvalidIdMessage() {
  return (
    <div className="ds-verify">
      <h1>Record verification</h1>
      <p className="ds-verify__lead">A valid governing record ID is required (UUID format).</p>
      <div className="card">
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Try the <Link href="/verify/test">test layout</Link> or <Link href="/">return home</Link>.
        </p>
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="ds-verify">
      <h1>Verification unavailable</h1>
      <p className="ds-verify__lead">The verification service could not be reached. Try again later.</p>
    </div>
  );
}

function TestVerificationLayout() {
  return (
    <div className="ds-verify">
      <h1>Verification preview</h1>
      <p className="ds-verify__lead">
        Static layout only. Replace <code>test</code> in the URL with a real governing record UUID to load live data
        from the API.
      </p>
      <p style={{ marginBottom: "1rem" }}>
        <StatusBadge status="VERIFIED" />
        <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: 13 }}>(illustrative)</span>
      </p>
      <QrNote />
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="ds-card-title">Record metadata</p>
        <dl className="ds-meta-grid">
          <dt>Governing record ID</dt>
          <dd style={{ fontStyle: "italic", color: "var(--muted)" }}>Your UUID will appear here</dd>
          <dt>Version / status</dt>
          <dd>—</dd>
        </dl>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p className="ds-card-title">Digest (illustrative)</p>
        <div className="ds-hash" aria-hidden>
          0000…0000
        </div>
      </div>
    </div>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId: raw } = await params;
  const recordId = decodeURIComponent(raw);

  if (recordId === "test") {
    return <TestVerificationLayout />;
  }

  if (!isUuid(recordId)) {
    return <InvalidIdMessage />;
  }

  const data = await fetchVerify(recordId);
  if (data.code === "UNAVAILABLE" || data.code === "ERROR") {
    return <Unavailable />;
  }
  if (data.code === "INVALID_ID") {
    return <InvalidIdMessage />;
  }
  if (data.code === "NOT_FOUND" || !data.governingRecordId) {
    return <NotFoundOrCertified />;
  }

  const verified = data.verificationStatus === "VERIFIED";

  return (
    <div className="ds-verify">
      <h1>Record verification</h1>
      <p className="ds-verify__lead">DealSeal public verification (read-only). No contract body or private signatures.</p>
      <p style={{ marginBottom: "1rem" }}>
        <StatusBadge status={data.verificationStatus} />
      </p>
      <QrNote />
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <p className="ds-card-title">Record</p>
        <dl className="ds-meta-grid">
          <dt>Verification status</dt>
          <dd>{data.verificationStatus ?? "—"}</dd>
          <dt>Governing record ID</dt>
          <dd>{data.governingRecordId}</dd>
          <dt>Version</dt>
          <dd>{data.version}</dd>
          <dt>Status</dt>
          <dd>{data.status}</dd>
          <dt>Executed</dt>
          <dd>{data.executedAt ?? "—"}</dd>
          <dt>Locked</dt>
          <dd>{data.lockedAt ?? "—"}</dd>
          {data.latestGeneratedAt && (
            <>
              <dt>Last facsimile</dt>
              <dd>{data.latestGeneratedAt}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p className="ds-card-title">Record hash (SHA-256)</p>
        <div className="ds-hash">{data.recordHash}</div>
      </div>
      {data.latestRenderingHash && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="ds-card-title">Latest rendering hash (PDF digest)</p>
          <div className="ds-hash">{data.latestRenderingHash}</div>
        </div>
      )}
      {data.latestImageHash && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="ds-card-title">Latest image digest {data.latestImageFormat ? `(${data.latestImageFormat})` : ""}</p>
          <div className="ds-hash">{data.latestImageHash}</div>
        </div>
      )}
      {data.renderingHistory && data.renderingHistory.length > 0 && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="ds-card-title">Rendering history</p>
          <ul className="ds-history-list">
            {data.renderingHistory.slice(0, 12).map((e) => (
              <li key={e.id}>
                <span style={{ color: "var(--brand-gold)", fontWeight: 600 }}>{e.mode}</span> · {e.generatedAt ?? "—"}
                {e.imageHash && (
                  <span style={{ color: "var(--muted)" }}>
                    {" "}
                    · image {e.imageHash.slice(0, 10)}…
                  </span>
                )}
                <div className="ds-hash" style={{ marginTop: 6 }}>
                  {e.renderingHash}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: "1.5rem" }}>
        {verified
          ? "Hash recomputation matches the stored governing record."
          : "Hash check did not match. Use authorized Deal-Scan workflows in product."}
      </p>
    </div>
  );
}
