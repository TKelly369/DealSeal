"use client";

import { useState } from "react";
import { ContractViewer, ContractViewerMode, CertificationOverlayData } from "@/components/contract/ContractViewer";
import type { GoverningRecord } from "@/lib/demo-records";

type RenderApiResponse = {
  recordHash: string;
  renderingHash: string;
  verificationUrl: string;
  timestamp: string;
  mode: "certified" | "non_authoritative";
};

export function RecordDetailClient({ record }: { record: GoverningRecord }) {
  const [mode, setMode] = useState<ContractViewerMode>("base");
  const [overlayData, setOverlayData] = useState<CertificationOverlayData | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"certified" | "non_authoritative" | null>(null);

  async function generate(targetMode: "certified" | "non_authoritative") {
    try {
      setError(null);
      setBusy(targetMode);
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: record.id, mode: targetMode }),
      });

      if (!response.ok) {
        throw new Error("Rendering service failed.");
      }

      const payload = (await response.json()) as RenderApiResponse;
      if (targetMode === "certified") {
        setOverlayData({
          recordHash: payload.recordHash,
          renderingHash: payload.renderingHash,
          verificationUrl: payload.verificationUrl,
          timestamp: payload.timestamp,
        });
      } else {
        setOverlayData(undefined);
      }
      setMode(targetMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected rendering error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: "1rem" }}>
        <button onClick={() => generate("certified")} disabled={busy !== null}>
          {busy === "certified" ? "Generating..." : "Generate Certified Rendering"}
        </button>
        <button className="btn-secondary" onClick={() => generate("non_authoritative")} disabled={busy !== null}>
          {busy === "non_authoritative" ? "Generating..." : "Generate Non-Authoritative Copy"}
        </button>
      </div>

      {error ? (
        <p
          style={{
            marginTop: 0,
            marginBottom: "1rem",
            color: "#fecaca",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            background: "color-mix(in srgb, var(--danger) 12%, var(--surface))",
            padding: "0.7rem 0.9rem",
          }}
        >
          {error}
        </p>
      ) : null}

      <ContractViewer record={record} mode={mode} overlayData={overlayData} />
    </>
  );
}
