"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { renderContract } from "@/lib/api";
import { getToken } from "@/lib/session";

type CertifiedRenderingActionsProps = {
  recordId: string;
  recordHash: string;
  onRendered: (payload: {
    renderedAt: string;
    recordHash: string;
    renderingHash: string;
    verificationUrl: string;
  }) => void;
};

export function CertifiedRenderingActions({
  recordId,
  recordHash,
  onRendered,
}: CertifiedRenderingActionsProps) {
  const [loading, setLoading] = useState(false);
  const [renderingHash, setRenderingHash] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = getToken() ?? "demo-token";
      const response = await renderContract(recordId, "CERTIFIED", token);
      setRenderingHash(response.renderingHash);
      setVerificationUrl(response.verificationUrl);
      onRendered({
        renderedAt: response.renderedAt,
        recordHash: response.recordHash,
        renderingHash: response.renderingHash,
        verificationUrl: response.verificationUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate certified rendering.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ds-certified-actions">
      <div className="ds-action-panel__buttons">
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? "Generating Certified Rendering..." : "Generate Certified Rendering"}
        </Button>
      </div>

      <div className="ds-action-panel__meta">
        <div>
          <span>Record Hash</span>
          <strong className="ds-table__mono">{recordHash}</strong>
        </div>
        <div>
          <span>Rendering Hash</span>
          <strong className="ds-table__mono">{renderingHash ?? "Pending generation"}</strong>
        </div>
        <div>
          <span>Verification URL</span>
          <strong>
            {verificationUrl ? (
              <a href={verificationUrl} target="_blank" rel="noreferrer">
                {verificationUrl}
              </a>
            ) : (
              "Not available"
            )}
          </strong>
        </div>
      </div>

      {verificationUrl ? (
        <div className="ds-action-panel__buttons">
          <Button href={verificationUrl} variant="secondary">
            Verify Rendering
          </Button>
        </div>
      ) : null}

      {error ? <p className="ds-inline-warning">{error}</p> : null}
    </div>
  );
}
