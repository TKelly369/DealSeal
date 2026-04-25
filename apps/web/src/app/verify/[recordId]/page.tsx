import Link from "next/link";
import { verifyRecord } from "@/lib/api";

type VerifyResponse = {
  valid: boolean;
  hashMatch: boolean;
  version: number;
  timestamp: string;
  recordId?: string;
  recordHash?: string;
};

async function fetchVerify(recordId: string): Promise<VerifyResponse> {
  try {
    return (await verifyRecord(recordId)) as VerifyResponse;
  } catch {
    return {
      valid: false,
      hashMatch: false,
      version: 0,
      timestamp: new Date(0).toISOString(),
    };
  }
}

function VerificationBadge({ valid }: { valid: boolean }) {
  return <span className={valid ? "ds-badge-verified" : "ds-badge-invalid"}>{valid ? "VALID" : "INVALID"}</span>;
}

type VerifyPageProps = {
  params: Promise<{ recordId: string }>;
  searchParams: Promise<{ hash?: string; renderingHash?: string }>;
};

export default async function VerifyPage({ params, searchParams }: VerifyPageProps) {
  const { recordId: raw } = await params;
  const { hash: suppliedHash, renderingHash } = await searchParams;
  const recordId = decodeURIComponent(raw);

  const data = await fetchVerify(recordId);
  const resolvedRecordId = data.recordId ?? recordId;
  const hashMatch = suppliedHash ? suppliedHash === data.recordHash : data.hashMatch;
  const valid = Boolean(data.valid && hashMatch && renderingHash);

  return (
    <div className="ds-dashboard">
      <div className="ds-card ds-verify-card">
        <h1 className="ds-section__title">Rendering Verification</h1>
        <p className="ds-section__subtitle">
          Independent verification of authoritative custody and rendering integrity for DealSeal records.
        </p>

        <div className="ds-verify-badge-row">
          <VerificationBadge valid={valid} />
        </div>

        <div className="ds-verify-status-grid">
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Record exists</p>
            <p className="ds-verify-status-item__value">{data.recordId ? "Confirmed" : "Not found"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Hash match confirmed</p>
            <p className="ds-verify-status-item__value">{hashMatch ? "Yes" : "No"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Rendering hash received</p>
            <p className="ds-verify-status-item__value">{renderingHash ? "Yes" : "No"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">System custody confirmed</p>
            <p className="ds-verify-status-item__value">{data.valid ? "Yes" : "No"}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Record ID</p>
            <p className="ds-verify-status-item__value">{resolvedRecordId}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Version</p>
            <p className="ds-verify-status-item__value">{data.version}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Timestamp</p>
            <p className="ds-verify-status-item__value">{new Date(data.timestamp).toLocaleString()}</p>
          </div>
          <div className="ds-verify-status-item">
            <p className="ds-verify-status-item__label">Rendering Hash</p>
            <p className="ds-verify-status-item__value ds-table__mono">{renderingHash ?? "—"}</p>
          </div>
        </div>

        <div className="ds-verify-links">
          <p className="ds-card-panel__title">Canonical verification URL</p>
          <p className="ds-card-panel__body">
            <a
              href={`https://dealseal1.com/verify/${encodeURIComponent(resolvedRecordId)}?hash=${encodeURIComponent(
                data.recordHash ?? "",
              )}&renderingHash=${encodeURIComponent(renderingHash ?? "")}`}
              target="_blank"
              rel="noreferrer"
            >
              {`https://dealseal1.com/verify/${resolvedRecordId}`}
            </a>
          </p>
          <p className="ds-verify-links__back">
            <Link href="/" className="ds-ui-button ds-ui-button--secondary">
              Return to dashboard
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
