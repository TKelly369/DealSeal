"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getToken } from "@/lib/session";
import { getServerApiBaseUrl } from "@/lib/config";

type DownloadRenderingButtonsProps = {
  governingRecordId: string;
  className?: string;
};

type DownloadKind = "CERTIFIED" | "NON_AUTHORITATIVE";

async function downloadRenderingPdf(
  governingRecordId: string,
  mode: DownloadKind,
): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Please sign in to download renderings.");
  }

  const base = getServerApiBaseUrl();
  const res = await fetch(`${base}/governing-records/${encodeURIComponent(governingRecordId)}/download/pdf`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/pdf",
    },
    body: JSON.stringify({ mode }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Download failed (${res.status}): ${body || res.statusText}`);
  }

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const defaultName = mode === "CERTIFIED" ? "certified-rendering.pdf" : "non-authoritative-copy.pdf";
  const disposition = res.headers.get("content-disposition");
  const fileNameMatch = disposition?.match(/filename="([^"]+)"/i);
  anchor.href = objectUrl;
  anchor.download = fileNameMatch?.[1] ?? defaultName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function DownloadRenderingButtons({ governingRecordId, className }: DownloadRenderingButtonsProps) {
  const [active, setActive] = useState<DownloadKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDownload = async (mode: DownloadKind) => {
    setError(null);
    setActive(mode);
    try {
      await downloadRenderingPdf(governingRecordId, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to download rendering.");
    } finally {
      setActive(null);
    }
  };

  const certifiedLoading = active === "CERTIFIED";
  const copyLoading = active === "NON_AUTHORITATIVE";

  return (
    <div className={className}>
      <div className="ds-table-actions">
        <Button onClick={() => void onDownload("CERTIFIED")} disabled={Boolean(active)}>
          {certifiedLoading ? "Preparing Certified PDF..." : "Download Certified Rendering"}
        </Button>
        <Button variant="secondary" onClick={() => void onDownload("NON_AUTHORITATIVE")} disabled={Boolean(active)}>
          {copyLoading ? "Preparing Copy PDF..." : "Download Copy"}
        </Button>
      </div>
      {error ? <p className="ds-form-hint ds-form-hint--error">{error}</p> : null}
    </div>
  );
}
