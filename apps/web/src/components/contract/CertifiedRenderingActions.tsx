"use client";

import { useState } from "react";
import Link from "next/link";
import type { DemoRecord } from "@/lib/demo-records";

type RenderResponse = {
  recordId: string;
  version: number;
  recordHash: string;
  renderingHash: string;
  renderedAt: string;
  verificationUrl: string;
};

type CertifiedRenderingActionsProps = {
  record: DemoRecord;
  onCertified: (payload: {
    mode: "CERTIFIED";
    renderingHash: string;
    renderedAt: string;
    verificationUrl: string;
  }) => void;
};

export function CertifiedRenderingActions({ record, onCertified }: CertifiedRenderingActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RenderResponse | null>(null);

  async function handleGenerate(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: record.id,
          mode: "CERTIFIED",
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Render request failed (${response.status})`);
      }

      const payload = (await response.json()) as RenderResponse;
      setResult(payload);
      onCertified({
        mode: "CERTIFIED",
        renderingHash: payload.renderingHash,
        renderedAt: payload.renderedAt,
        verificationUrl: payload.verificationUrl,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate certified rendering.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card ds-actions-panel">
      <h3>Action Panel</h3>
      <button type="button" className="btn" onClick={() => void handleGenerate()} disabled={loading}>
        {loading ? "Generating..." : "Generate Certified Rendering"}
      </button>

      {error ? <p className="ds-inline-error">{error}</p> : null}

      {result ? (
        <div className="ds-render-success">
          <h4>Certified Rendering Ready</h4>
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
