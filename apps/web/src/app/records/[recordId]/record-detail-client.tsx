"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ContractViewer } from "@/components/contract/ContractViewer";
import { CertifiedRenderingActions } from "@/components/contract/CertifiedRenderingActions";
import { Button } from "@/components/ui/Button";

type RenderedState = {
  mode: "CERTIFIED";
  html: string;
  renderingHash: string;
  verificationUrl: string;
};

type RecordDetailClientProps = {
  recordId: string;
  dealId: string;
  recordHash: string;
  version: number;
  status: string;
  createdAtLabel: string;
  lockedAtLabel: string;
  timestamp: string;
  contractData: Record<string, unknown>;
};

export function RecordDetailClient({
  recordId,
  dealId,
  recordHash,
  version,
  status,
  createdAtLabel,
  lockedAtLabel,
  timestamp,
  contractData,
}: RecordDetailClientProps) {
  const [rendered, setRendered] = useState<RenderedState | null>(null);

  const verificationHref = useMemo(() => {
    if (!rendered) {
      return `/verify/${recordId}?hash=${encodeURIComponent(recordHash)}`;
    }
    return `/verify/${recordId}?hash=${encodeURIComponent(recordHash)}&renderingHash=${encodeURIComponent(
      rendered.renderingHash,
    )}`;
  }, [recordHash, recordId, rendered]);

  return (
    <div className="ds-record-layout">
      <div className="ds-record-main">
        <ContractViewer
          recordId={recordId}
          recordHash={recordHash}
          version={version}
          timestamp={timestamp}
          contractData={contractData}
          renderedHtml={rendered?.html ?? null}
          renderedMode={rendered?.mode ?? null}
          renderingHash={rendered?.renderingHash ?? null}
          verificationUrl={rendered?.verificationUrl ?? null}
        />
      </div>

      <Card className="ds-card-panel ds-contract-side-panel">
        <p className="ds-card-panel__title">Record Metadata</p>
        <ul className="ds-status-list">
          <li>
            <span>Record ID</span>
            <strong className="ds-table__mono">{recordId}</strong>
          </li>
          <li>
            <span>Deal ID</span>
            <strong>{dealId}</strong>
          </li>
          <li>
            <span>Hash</span>
            <strong className="ds-table__mono">{recordHash}</strong>
          </li>
          <li>
            <span>Version</span>
            <strong>{version}</strong>
          </li>
          <li>
            <span>Status</span>
            <strong>{status}</strong>
          </li>
          <li>
            <span>Created</span>
            <strong>{createdAtLabel}</strong>
          </li>
          <li>
            <span>Locked</span>
            <strong>{lockedAtLabel}</strong>
          </li>
        </ul>

        <CertifiedRenderingActions
          recordId={recordId}
          recordHash={recordHash}
          onRendered={(payload) =>
            setRendered({
              mode: "CERTIFIED",
              html: payload.html,
              renderingHash: payload.renderingHash,
              verificationUrl: payload.verificationUrl,
            })
          }
        />

        <div className="ds-action-panel__buttons">
          {rendered?.verificationUrl ? (
            <Button href={rendered.verificationUrl} variant="secondary">
              Open Verification URL
            </Button>
          ) : null}
          <Button href={verificationHref} variant="secondary">
            Verify Rendering
          </Button>
        </div>
      </Card>
    </div>
  );
}
