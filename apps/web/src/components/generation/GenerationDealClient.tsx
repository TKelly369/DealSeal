"use client";

import { useState } from "react";
import { useEffect } from "react";

type InputPayload = {
  amountFinanced: string;
  taxesAmount: string;
  feesAmount: string;
  downPaymentAmount: string;
  totalSalePrice: string;
  pricingNotes: string;
  taxesNotes: string;
  feesNotes: string;
  addOnsNotes: string;
  tradeInNotes: string;
  aiQuestions: string;
};

export function GenerationDealClient({
  roleLabel,
  dealId,
  initial,
  applyInput,
  runAiPopulate,
  runMismatchValidation,
  uploadDocForAi,
  engagementSnapshot,
  automateEngagement,
}: {
  roleLabel: "Dealer" | "Lender" | "Admin";
  dealId: string;
  initial: InputPayload;
  applyInput: (input: InputPayload) => Promise<void>;
  runAiPopulate: () => Promise<{ confidenceSummary?: string }>;
  runMismatchValidation: () => Promise<{ message: string }>;
  uploadDocForAi: (fileName: string) => Promise<void>;
  engagementSnapshot: {
    openDealerAlerts: number;
    lenderOpenTasks: number;
    missingItems: number;
    canSimultaneouslyCloseAndFund: boolean;
  };
  automateEngagement: () => Promise<{
    openDealerAlerts: number;
    lenderOpenTasks: number;
    missingItems: number;
    canSimultaneouslyCloseAndFund: boolean;
  }>;
}) {
  const [s, setS] = useState<InputPayload>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [engagement, setEngagement] = useState(engagementSnapshot);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const on = <K extends keyof InputPayload>(k: K, v: InputPayload[K]) => setS((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch(`/api/generation/engagement/${dealId}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as {
          openDealerAlerts: number;
          lenderOpenTasks: number;
          missingItems: number;
          canSimultaneouslyCloseAndFund: boolean;
        };
        if (!active) return;
        setEngagement(next);
        setLastSyncAt(new Date());
      } catch {
        // Keep UI usable if polling fails.
      }
    };
    void run();
    const id = window.setInterval(() => {
      void run();
    }, 10_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [dealId]);

  return (
    <div className="ds-section-shell">
      <h1 style={{ marginTop: 0 }}>{roleLabel} Generation Link</h1>
      <p style={{ color: "var(--muted)" }}>
        Deal <code>{dealId}</code> central AI workspace. Input and document uploads here drive population across
        numbers, forms, and jacket consistency checks for finance, risk, compliance, and legality in auto finance.
      </p>
      {msg ? <p style={{ color: "var(--muted)" }}>{msg}</p> : null}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Simultaneous dealer + lender engagement</h2>
        <p style={{ color: "var(--muted)" }}>
          Run both sides in parallel to close and fund faster. Automation monitors finance/risk/legal blockers and keeps
          compliance outputs synchronized.
        </p>
        <p style={{ margin: 0 }}>
          Dealer alerts: <strong>{engagement.openDealerAlerts}</strong> · Lender open tasks:{" "}
          <strong>{engagement.lenderOpenTasks}</strong> · Missing items: <strong>{engagement.missingItems}</strong>
        </p>
        <p style={{ marginTop: "0.4rem", color: engagement.canSimultaneouslyCloseAndFund ? "#86efac" : "#fbbf24" }}>
          {engagement.canSimultaneouslyCloseAndFund
            ? "Parallel close/fund path is clear."
            : "Parallel close/fund has blockers. Use automation to coordinate and clear quickly."}
        </p>
        <p style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.82rem" }}>
          Auto-refresh every 10s{lastSyncAt ? ` · Last sync ${lastSyncAt.toLocaleTimeString()}` : ""}
        </p>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const out = await automateEngagement();
              setEngagement(out);
              setMsg("Simultaneous engagement workflow started with automated coordination tasks.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Start simultaneous engagement automation
        </button>
      </div>
      <div className="card">
        <div className="ds-form-grid">
          <label>Amount financed<input value={s.amountFinanced} onChange={(e) => on("amountFinanced", e.target.value)} /></label>
          <label>Taxes<input value={s.taxesAmount} onChange={(e) => on("taxesAmount", e.target.value)} /></label>
          <label>Fees<input value={s.feesAmount} onChange={(e) => on("feesAmount", e.target.value)} /></label>
          <label>Down payment<input value={s.downPaymentAmount} onChange={(e) => on("downPaymentAmount", e.target.value)} /></label>
          <label>Total sale price<input value={s.totalSalePrice} onChange={(e) => on("totalSalePrice", e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Pricing notes<textarea rows={2} value={s.pricingNotes} onChange={(e) => on("pricingNotes", e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Taxes notes<textarea rows={2} value={s.taxesNotes} onChange={(e) => on("taxesNotes", e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Fees notes<textarea rows={2} value={s.feesNotes} onChange={(e) => on("feesNotes", e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Add-ons notes<textarea rows={2} value={s.addOnsNotes} onChange={(e) => on("addOnsNotes", e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Trade-in notes<textarea rows={2} value={s.tradeInNotes} onChange={(e) => on("tradeInNotes", e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Ask AI to perform actions/questions<textarea rows={3} value={s.aiQuestions} onChange={(e) => on("aiQuestions", e.target.value)} /></label>
        </div>
        <div className="row" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await applyInput(s);
                setMsg("Generation input saved and propagated.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save and propagate
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const out = await runAiPopulate();
                setMsg(out.confidenceSummary ?? "AI auto-populated deal numbers/forms.");
              } finally {
                setBusy(false);
              }
            }}
          >
            AI populate deal + forms
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const out = await runMismatchValidation();
                setMsg(out.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Validate mismatch and alert
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2 className="ds-card-title" style={{ marginTop: 0 }}>Upload docs for AI analysis and correction</h2>
        <p style={{ color: "var(--muted)" }}>Upload a document file name to queue AI analysis and consistency correction workflow.</p>
        <UploadDocForm
          onUpload={async (fileName) => {
            await uploadDocForAi(fileName);
            setMsg(`Document ${fileName} queued for AI analysis.`);
          }}
        />
      </div>
    </div>
  );
}

function UploadDocForm({ onUpload }: { onUpload: (fileName: string) => Promise<void> }) {
  const [fileName, setFileName] = useState("");
  return (
    <div className="row">
      <input placeholder="document-file.pdf" value={fileName} onChange={(e) => setFileName(e.target.value)} />
      <button
        className="btn btn-secondary"
        onClick={async () => {
          if (!fileName.trim()) return;
          await onUpload(fileName.trim());
          setFileName("");
        }}
      >
        Queue doc for AI
      </button>
    </div>
  );
}
