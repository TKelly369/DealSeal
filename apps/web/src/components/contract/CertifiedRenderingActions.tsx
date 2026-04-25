"use client";

import { useState } from "react";
import Link from "next/link";
import { ContractViewer } from "@/components/contract/ContractViewer";
import type { DemoRecord } from "@/lib/demo-records";

type RenderApiSuccess = {
  ok: true;
  recordId: string;
  version: number;
  recordHash: string;
  renderingHash: string;
  renderedAt: string;
  verificationUrl: string;
};

type RenderApiFailure = {
  ok: false;
  error: string;
};

type RenderApiResponse = RenderApiSuccess | RenderApiFailure;

type CertifiedRenderingActionsProps = {
  record: DemoRecord;
};

export function CertifiedRenderingActions({ record }: CertifiedRenderingActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenderApiSuccess | null>(null);

  async function handleGenerate(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id, mode: "CERTIFIED" }),
      });
      const payload = (await response.json().catch(() => ({
        ok: false,
        error: "Invalid response",
      }))) as RenderApiResponse;
      if (!response.ok || !payload.ok) {
        setResult(null);
        setError(payload.ok ? "Unable to generate certified rendering." : payload.error);
        return;
      }
      setResult(payload);
    } catch (requestError) {
      setResult(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to generate certified rendering.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card ds-actions-panel">
      <h3>Certified Rendering Actions</h3>
      <button type="button" className="btn" onClick={() => void handleGenerate()} disabled={loading}>
        {loading ? "Generating Certified Rendering..." : "Generate Certified Rendering"}
      </button>

      {error ? <p className="ds-inline-error">{error}</p> : null}

      {result ? (
        <div className="ds-render-success">
          <h4>Certified Rendering Ready</h4>
          <ContractViewer
            record={record}
            mode="CERTIFIED"
            renderingHash={result.renderingHash}
            verificationUrl={result.verificationUrl}
            renderedAt={result.renderedAt}
          />
          <p>
            <strong>Rendering Hash:</strong> <span className="ds-mono">{result.renderingHash}</span>
          </p>
          <p>
            <strong>Verification URL:</strong>{" "}
            <a href={result.verificationUrl} target="_blank" rel="noreferrer">
              {result.verificationUrl}
            </a>
          </p>
          <Link href={result.verificationUrl} className="btn btn-secondary">
            Verify Rendering
          </Link>
        </div>
      ) : null}
    </section>
  );
}
