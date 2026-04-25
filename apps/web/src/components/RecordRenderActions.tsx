"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { renderContract } from "@/lib/api";
import { getToken } from "@/lib/session";

type RecordRenderActionsProps = {
  recordId: string;
  className?: string;
  recordHash?: string;
  recordVersion?: number;
  generatedAt?: string | null;
};

type RenderMode = "CERTIFIED" | "NON_AUTHORITATIVE";

function triggerDownload(pdfBase64: string, filename: string): void {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function RecordRenderActions({
  recordId,
  className,
  recordHash,
  recordVersion,
  generatedAt,
}: RecordRenderActionsProps) {
  const [activeMode, setActiveMode] = useState<RenderMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latestRenderingHash, setLatestRenderingHash] = useState<string | null>(null);
  const [latestGeneratedAt, setLatestGeneratedAt] = useState<string | null>(generatedAt ?? null);

  const metadata = useMemo(
    () => ({
      renderingHash: latestRenderingHash ?? "Not generated yet",
      generatedAt: latestGeneratedAt ?? "Pending action",
    }),
    [latestGeneratedAt, latestRenderingHash],
  );

  const onRender = async (mode: RenderMode) => {
    const token = getToken();
    if (!token) {
      setError("Sign in to generate renderings.");
      return;
    }

    setError(null);
    setActiveMode(mode);
    try {
      const output = await renderContract(recordId, mode, token);
      setLatestRenderingHash(output.renderingHash);
      setLatestGeneratedAt(new Date().toISOString());
      if (output.pdfBase64) {
        const filename = `DealScan-${mode.toLowerCase()}-${recordId}.pdf`;
        triggerDownload(output.pdfBase64, filename);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate rendering.");
    } finally {
      setActiveMode(null);
    }
  };

  return (
    <div className={className}>
      <CardHeader />
      <div className="ds-action-panel__meta">
        <div>
          <span>Record ID</span>
          <strong className="ds-table__mono">{recordId}</strong>
        </div>
        {recordVersion ? (
          <div>
            <span>Version</span>
            <strong>{recordVersion}</strong>
          </div>
        ) : null}
        {recordHash ? (
          <div>
            <span>Record hash</span>
            <strong className="ds-table__mono">{recordHash}</strong>
          </div>
        ) : null}
        <div>
          <span>Latest rendering hash</span>
          <strong className="ds-table__mono">{metadata.renderingHash}</strong>
        </div>
        <div>
          <span>Generated at</span>
          <strong>{metadata.generatedAt}</strong>
        </div>
      </div>
      <div className="ds-action-panel__buttons">
        <Button onClick={() => void onRender("CERTIFIED")} disabled={Boolean(activeMode)}>
          {activeMode === "CERTIFIED" ? "Generating Certified Rendering..." : "Generate Certified Rendering"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void onRender("NON_AUTHORITATIVE")}
          disabled={Boolean(activeMode)}
        >
          {activeMode === "NON_AUTHORITATIVE" ? "Generating Copy..." : "Download Copy"}
        </Button>
        <Button href={`/verify/${recordId}`} variant="secondary">
          Verify Record
        </Button>
      </div>
      {error ? <p className="ds-inline-warning">{error}</p> : null}
    </div>
  );
}

function CardHeader() {
  return (
    <div className="ds-action-panel__header">
      <p className="ds-card-panel__title">Actions</p>
      <p className="ds-card-panel__body">
        Generate certified renderings and non-authoritative copies from the same governing source.
      </p>
    </div>
  );
}
