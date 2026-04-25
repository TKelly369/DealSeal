"use client";

import { useState } from "react";
import { ContractViewer } from "@/components/contract/ContractViewer";
import { CertifiedRenderingActions } from "@/components/contract/CertifiedRenderingActions";
import type { DemoRecord } from "@/lib/demo-records";

type RecordDetailClientProps = {
  record: DemoRecord;
};

type CertifiedState = {
  mode: "CERTIFIED";
  renderingHash: string;
  renderedAt: string;
  verificationUrl: string;
};

export function RecordDetailClient({ record }: RecordDetailClientProps) {
  const [certifiedState, setCertifiedState] = useState<CertifiedState | null>(null);

  return (
    <>
      <section className="ds-viewer-shell">
        <ContractViewer
          record={record}
          mode={certifiedState?.mode ?? "BASE"}
          renderingHash={certifiedState?.renderingHash}
          verificationUrl={certifiedState?.verificationUrl}
          renderedAt={certifiedState?.renderedAt}
        />
      </section>

      <CertifiedRenderingActions
        record={record}
        onCertified={(payload) => {
          setCertifiedState(payload);
        }}
      />
    </>
  );
}
