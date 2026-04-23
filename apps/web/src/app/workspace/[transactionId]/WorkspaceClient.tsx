"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { setLastTransactionId } from "@/lib/session";

type VersionRow = {
  id: string;
  version: number;
  materialChange?: boolean;
  changeReason?: string | null;
  createdAt: string;
  diffJson?: unknown;
};

export function WorkspaceClient({ transactionId }: { transactionId: string }) {
  const [buyer, setBuyer] = useState("");
  const [amount, setAmount] = useState("");
  const [vin, setVin] = useState("");
  const [buyerVersion, setBuyerVersion] = useState<number | undefined>(undefined);
  const [vehicleVersion, setVehicleVersion] = useState<number | undefined>(undefined);
  const [finVersion, setFinVersion] = useState<number | undefined>(undefined);
  const [buyerHist, setBuyerHist] = useState<VersionRow[]>([]);
  const [vehicleHist, setVehicleHist] = useState<VersionRow[]>([]);
  const [finHist, setFinHist] = useState<VersionRow[]>([]);
  const [docId, setDocId] = useState("");
  const [intent, setIntent] = useState<{
    intentId: string;
    upload: { url: string; headers: Record<string, string> };
    stagingKey: string;
  } | null>(null);
  const [finalizeSha, setFinalizeSha] = useState("");
  const [docStatus, setDocStatus] = useState("");
  const [templates, setTemplates] = useState<{ key: string; name: string }[]>([]);
  const [templateKey, setTemplateKey] = useState("default-v1");
  const [pkgStatus, setPkgStatus] = useState("");
  const [audit, setAudit] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stateSnap, setStateSnap] = useState<unknown>(null);
  const [nextStates, setNextStates] = useState<unknown>(null);
  const [lenderData, setLenderData] = useState<unknown>(null);
  const [proto, setProto] = useState<unknown>(null);
  const [toSt, setToSt] = useState("LOCKED");
  const [exDoc, setExDoc] = useState("");
  const [exContract, setExContract] = useState("");
  const [lockStatus, setLockStatus] = useState<unknown>(null);
  const [exBundle, setExBundle] = useState<unknown>(null);
  const [emb, setEmb] = useState<unknown>(null);
  const [pf, setPf] = useState<unknown>(null);
  const [fc, setFc] = useState<unknown>(null);
  const [certMsg, setCertMsg] = useState("");

  const loadVersions = useCallback(async () => {
    const [b, v, f] = await Promise.all([
      api<{ items: VersionRow[] }>(
        `/transactions/${transactionId}/buyer/versions`,
      ),
      api<{ items: VersionRow[] }>(
        `/transactions/${transactionId}/vehicle/versions`,
      ),
      api<{ items: VersionRow[] }>(
        `/transactions/${transactionId}/financials/versions`,
      ),
    ]);
    setBuyerHist(b.items);
    setVehicleHist(v.items);
    setFinHist(f.items);
    if (b.items[0]) setBuyerVersion(b.items[0].version);
    if (v.items[0]) setVehicleVersion(v.items[0].version);
    if (f.items[0]) setFinVersion(f.items[0].version);
  }, [transactionId]);

  useEffect(() => {
    setLastTransactionId(transactionId);
    void loadVersions().catch(() => {});
    void api<{ items: { key: string; name: string }[] }>("/packages/templates")
      .then((r) => setTemplates(r.items))
      .catch(() => setTemplates([{ key: "default-v1", name: "Default export" }]));
  }, [transactionId, loadVersions]);

  const patchBuyer = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/buyer`, {
        method: "PATCH",
        body: JSON.stringify({
          legalName: buyer || undefined,
          expectedVersion: buyerVersion,
          reason: "workspace save",
        }),
      });
      await loadVersions();
    } catch (e) {
      setErr(String(e));
    }
  };

  const patchVehicle = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/vehicle`, {
        method: "PATCH",
        body: JSON.stringify({
          vin: vin || undefined,
          expectedVersion: vehicleVersion,
          reason: "workspace save",
        }),
      });
      await loadVersions();
    } catch (e) {
      setErr(String(e));
    }
  };

  const patchFinancials = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/financials`, {
        method: "PATCH",
        body: JSON.stringify({
          amountFinanced: amount ? Number(amount) : undefined,
          expectedVersion: finVersion,
          reason: "workspace save",
        }),
      });
      await loadVersions();
    } catch (e) {
      setErr(String(e));
    }
  };

  const createDoc = async () => {
    setErr(null);
    try {
      const out = await api<{ id: string }>(`/documents`, {
        method: "POST",
        body: JSON.stringify({
          transactionId,
          type: "SUPPORTING",
        }),
      });
      setDocId(out.id);
      setDocStatus(`Created document ${out.id}`);
    } catch (e) {
      setErr(String(e));
    }
  };

  const requestIntent = async () => {
    if (!docId) {
      setErr("Create a document first");
      return;
    }
    setErr(null);
    try {
      const out = await api<{
        intentId: string;
        upload: { url: string; headers: Record<string, string> };
        stagingKey: string;
      }>(`/documents/upload-intent`, {
        method: "POST",
        body: JSON.stringify({
          transactionId,
          documentId: docId,
          mimeType: "application/pdf",
          maxBytes: 10_000_000,
        }),
      });
      setIntent(out);
      setDocStatus("Intent created — PUT file to presigned URL, then finalize.");
    } catch (e) {
      setErr(String(e));
    }
  };

  const finalizeUpload = async () => {
    if (!docId || !intent) return;
    setErr(null);
    try {
      const sha =
        finalizeSha.length === 64
          ? finalizeSha
          : "0".repeat(63) + "1";
      await api(`/documents/${docId}/finalize`, {
        method: "POST",
        body: JSON.stringify({
          intentId: intent.intentId,
          sha256: sha,
          authoritative: true,
        }),
      });
      setDocStatus("Finalize requested");
    } catch (e) {
      setErr(String(e));
    }
  };

  const requestPackage = async () => {
    setErr(null);
    try {
      const job = await api<{ id: string; status: string }>(`/packages/jobs`, {
        method: "POST",
        body: JSON.stringify({
          transactionId,
          formats: ["JSON"],
          templateKey,
        }),
      });
      setPkgStatus(`Job ${job.id} status ${job.status}`);
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadAudit = async () => {
    setErr(null);
    try {
      const out = await api(
        `/audit/transactions/${transactionId}/timeline?normalized=true&limit=30`,
      );
      setAudit(out);
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadState = async () => {
    setErr(null);
    try {
      const s = await api(`/transactions/${transactionId}/state`);
      const n = await api<{ items: unknown[] }>(
        `/transactions/${transactionId}/state/allowed-transitions`,
      );
      setStateSnap(s);
      setNextStates(n.items);
    } catch (e) {
      setErr(String(e));
    }
  };

  const transition = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/state/transition`, {
        method: "POST",
        body: JSON.stringify({ toState: toSt, reason: "workspace" }),
      });
      await loadState();
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadLender = async () => {
    setErr(null);
    try {
      const o = await api(`/transactions/${transactionId}/lender-evaluation`);
      setLenderData(o);
    } catch (e) {
      setErr(String(e));
    }
  };

  const runLender = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/lender-evaluation/run`, { method: "POST", body: "{}" });
      await loadLender();
      const p = await api(`/transactions/${transactionId}/completion-protocol`);
      setProto(p);
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadProto = async () => {
    setErr(null);
    try {
      const p = await api(`/transactions/${transactionId}/completion-protocol`);
      setProto(p);
    } catch (e) {
      setErr(String(e));
    }
  };

  const rebuildProto = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/completion-protocol/rebuild`, { method: "POST" });
      await loadProto();
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadLock = async () => {
    setErr(null);
    try {
      setLockStatus(await api(`/transactions/${transactionId}/lock-status`));
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadExecution = async () => {
    setErr(null);
    try {
      setExBundle(await api(`/transactions/${transactionId}/execution`));
    } catch (e) {
      setErr(String(e));
    }
  };

  const submitExecution = async () => {
    setErr(null);
    try {
      const out = await api<unknown>(`/transactions/${transactionId}/execution/submit`, {
        method: "POST",
        body: JSON.stringify({ documentId: exDoc.trim() }),
      });
      setExBundle({ submitted: out });
      await loadState();
    } catch (e) {
      setErr(String(e));
    }
  };

  const verifyExecution = async () => {
    setErr(null);
    try {
      const out = await api<unknown>(`/transactions/${transactionId}/execution/verify`, {
        method: "POST",
        body: JSON.stringify({ executedContractId: exContract.trim() }),
      });
      setExBundle({ lastVerify: out });
      await loadState();
    } catch (e) {
      setErr(String(e));
    }
  };

  const lockDeal = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/lock`, { method: "POST", body: "{}" });
      await loadLock();
      await loadState();
    } catch (e) {
      setErr(String(e));
    }
  };

  const genEmbodiment = async () => {
    setErr(null);
    try {
      const o = await api(`/transactions/${transactionId}/authoritative-embodiment/generate`, {
        method: "POST",
        body: "{}",
      });
      setEmb(o);
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadEmbodiment = async () => {
    setErr(null);
    try {
      setEmb(await api(`/transactions/${transactionId}/authoritative-embodiment`));
    } catch (e) {
      setErr(String(e));
    }
  };

  const requestCertified = async () => {
    setErr(null);
    try {
      const job = await api<{ id: string; status: string; packageKind?: string }>(
        `/transactions/${transactionId}/packages/generate-certified`,
        { method: "POST", body: JSON.stringify({ formats: ["JSON"] }) },
      );
      setCertMsg(`Certified job ${job.id} — ${job.status} (${job.packageKind ?? "?"})`);
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadPostFunding = async () => {
    setErr(null);
    try {
      setPf(await api(`/transactions/${transactionId}/post-funding`));
    } catch (e) {
      setErr(String(e));
    }
  };

  const rebuildPf = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/post-funding/rebuild`, { method: "POST" });
      await loadPostFunding();
    } catch (e) {
      setErr(String(e));
    }
  };

  const loadFinalClearance = async () => {
    setErr(null);
    try {
      setFc(await api(`/transactions/${transactionId}/final-clearance`));
    } catch (e) {
      setErr(String(e));
    }
  };

  const completeFinalClearance = async () => {
    setErr(null);
    try {
      await api(`/transactions/${transactionId}/final-clearance/complete`, { method: "POST" });
      await loadFinalClearance();
      await loadState();
    } catch (e) {
      setErr(String(e));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {err && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
          {err}
        </div>
      )}

      <div className="row">
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3>Buyer</h3>
          <label>
            Legal name
            <input
              style={{ display: "block", width: "100%", marginTop: 4 }}
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
            />
          </label>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Optimistic lock version: {buyerVersion ?? "—"}
          </p>
          <button type="button" onClick={() => void patchBuyer()}>
            PATCH buyer
          </button>
        </div>
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3>Vehicle</h3>
          <label>
            VIN
            <input
              style={{ display: "block", width: "100%", marginTop: 4 }}
              value={vin}
              onChange={(e) => setVin(e.target.value)}
            />
          </label>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Version: {vehicleVersion ?? "—"}
          </p>
          <button type="button" onClick={() => void patchVehicle()}>
            PATCH vehicle
          </button>
        </div>
        <div className="card" style={{ flex: "1 1 320px" }}>
          <h3>Financials</h3>
          <label>
            Amount financed
            <input
              style={{ display: "block", width: "100%", marginTop: 4 }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>
            Version: {finVersion ?? "—"}
          </p>
          <button type="button" onClick={() => void patchFinancials()}>
            PATCH financials
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Version history</h3>
        <div className="row">
          <div style={{ flex: 1 }}>
            <h4>Buyer</h4>
            <ul style={{ color: "var(--muted)", fontSize: 13 }}>
              {buyerHist.map((v) => (
                <li key={v.id}>
                  v{v.version} · material={String(v.materialChange)} ·{" "}
                  {v.changeReason ?? "—"} · {new Date(v.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1 }}>
            <h4>Vehicle</h4>
            <ul style={{ color: "var(--muted)", fontSize: 13 }}>
              {vehicleHist.map((v) => (
                <li key={v.id}>
                  v{v.version} · material={String(v.materialChange)} ·{" "}
                  {v.changeReason ?? "—"}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1 }}>
            <h4>Financials</h4>
            <ul style={{ color: "var(--muted)", fontSize: 13 }}>
              {finHist.map((v) => (
                <li key={v.id}>
                  v{v.version} · material={String(v.materialChange)} ·{" "}
                  {v.changeReason ?? "—"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Document upload</h3>
        <button type="button" onClick={() => void createDoc()}>
          Create document stub
        </button>
        <button type="button" onClick={() => void requestIntent()} style={{ marginLeft: 8 }}>
          Request upload intent
        </button>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>{docStatus}</p>
        {intent && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12, wordBreak: "break-all" }}>{intent.upload.url}</p>
            <label>
              SHA-256 (64 hex) after upload
              <input
                style={{ display: "block", width: "100%", marginTop: 4 }}
                value={finalizeSha}
                onChange={(e) => setFinalizeSha(e.target.value)}
              />
            </label>
            <button type="button" onClick={() => void finalizeUpload()} style={{ marginTop: 8 }}>
              Finalize upload
            </button>
            <p style={{ color: "var(--muted)", fontSize: 12 }}>
              In production: PUT binary to the presigned URL using the returned headers, then
              finalize with the computed digest.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Deal state</h3>
        <button type="button" onClick={() => void loadState()}>
          Load state + allowed transitions
        </button>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={toSt}
            onChange={(e) => setToSt(e.target.value)}
            placeholder="toState (e.g. LOCKED, GREEN_STAGE_1)"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" onClick={() => void transition()}>
            POST /state/transition
          </button>
        </div>
        {stateSnap ? (
          <pre style={{ fontSize: 11, maxHeight: 120, overflow: "auto" }}>
            {JSON.stringify(stateSnap, null, 2)}
          </pre>
        ) : null}
        {nextStates ? (
          <pre style={{ fontSize: 11, maxHeight: 120, overflow: "auto" }}>
            {JSON.stringify(nextStates, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="card">
        <h3>Lender evaluation</h3>
        <button type="button" onClick={() => void loadLender()}>
          GET /lender-evaluation
        </button>
        <button type="button" style={{ marginLeft: 8 }} onClick={() => void runLender()}>
          Run evaluation
        </button>
        {Boolean(lenderData) && (
          <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(lenderData, null, 2)}
          </pre>
        )}
      </div>

      <div className="card">
        <h3>Completion protocol</h3>
        <button type="button" onClick={() => void loadProto()}>
          Load protocol
        </button>
        <button type="button" style={{ marginLeft: 8 }} onClick={() => void rebuildProto()}>
          Rebuild
        </button>
        {proto ? (
          <pre style={{ fontSize: 11, maxHeight: 220, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(proto, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="card">
        <h3>Package generation</h3>
        <select
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value)}
          style={{ marginRight: 8 }}
        >
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name} ({t.key})
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void requestPackage()}>
          Request package job
        </button>
        <p style={{ color: "var(--muted)" }}>{pkgStatus}</p>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>{certMsg}</p>
        <button type="button" style={{ marginTop: 8 }} onClick={() => void requestCertified()}>
          Request certified package
        </button>
      </div>

      <div className="card">
        <h3>Lock &amp; execution</h3>
        <button type="button" onClick={() => void loadLock()}>
          GET lock-status
        </button>
        <button type="button" style={{ marginLeft: 8 }} onClick={() => void loadExecution()}>
          GET execution bundle
        </button>
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
          For execution submit, use an <strong>EXECUTED_CONTRACT</strong> document (create via API with
          that type) whose <code>requirementKey</code> matches the governing reference, then finalize
          to ACCEPTED.
        </p>
        <label>
          documentId
          <input
            value={exDoc}
            onChange={(e) => setExDoc(e.target.value)}
            style={{ display: "block", width: "100%", maxWidth: 400 }}
            placeholder="uuid of executed contract document"
          />
        </label>
        <button type="button" onClick={() => void submitExecution()} style={{ marginTop: 4 }}>
          POST execution/submit
        </button>
        <label style={{ display: "block", marginTop: 8 }}>
          executedContractId
          <input
            value={exContract}
            onChange={(e) => setExContract(e.target.value)}
            style={{ display: "block", width: "100%", maxWidth: 400 }}
            placeholder="from execution bundle"
          />
        </label>
        <button type="button" onClick={() => void verifyExecution()} style={{ marginTop: 4 }}>
          POST execution/verify
        </button>
        <button type="button" onClick={() => void lockDeal()} style={{ marginLeft: 8 }}>
          POST lock (compliance+)
        </button>
        {Boolean(lockStatus) && (
          <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}>
            {JSON.stringify(lockStatus, null, 2)}
          </pre>
        )}
        {Boolean(exBundle) && (
          <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}>
            {JSON.stringify(exBundle, null, 2)}
          </pre>
        )}
      </div>

      <div className="card">
        <h3>Authoritative embodiment</h3>
        <button type="button" onClick={() => void loadEmbodiment()}>
          GET authoritative-embodiment
        </button>
        <button type="button" style={{ marginLeft: 8 }} onClick={() => void genEmbodiment()}>
          Generate
        </button>
        {Boolean(emb) && (
          <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}>{JSON.stringify(emb, null, 2)}</pre>
        )}
      </div>

      <div className="card">
        <h3>Post-funding</h3>
        <button type="button" onClick={() => void loadPostFunding()}>
          GET post-funding
        </button>
        <button type="button" style={{ marginLeft: 8 }} onClick={() => void rebuildPf()}>
          Rebuild obligations
        </button>
        {Boolean(pf) && (
          <pre style={{ fontSize: 11, maxHeight: 200, overflow: "auto" }}>{JSON.stringify(pf, null, 2)}</pre>
        )}
      </div>

      <div className="card">
        <h3>Final clearance (Green Stage 2)</h3>
        <button type="button" onClick={() => void loadFinalClearance()}>
          GET final-clearance
        </button>
        <button type="button" style={{ marginLeft: 8 }} onClick={() => void completeFinalClearance()}>
          Complete
        </button>
        {Boolean(fc) && (
          <pre style={{ fontSize: 11, maxHeight: 220, overflow: "auto" }}>{JSON.stringify(fc, null, 2)}</pre>
        )}
      </div>

      <div className="card">
        <h3>Audit timeline (normalized)</h3>
        <button type="button" onClick={() => void loadAudit()}>
          Load audit timeline
        </button>
        {Boolean(audit) && (
          <pre
            style={{
              marginTop: 8,
              fontSize: 11,
              maxHeight: 280,
              overflow: "auto",
              color: "var(--muted)",
            }}
          >
            {JSON.stringify(audit, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
