"use client";

import { useMemo, useState } from "react";

type DocRow = {
  id: string;
  title: string;
  type: string;
  status: "PENDING" | "CERTIFIED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
};

export function DocumentsPanelClient({
  initialDocuments,
  onAuditMovement,
  onUpdateDocument,
  onUploadDocumentContent,
  onGetDocumentDownloadUrl,
}: {
  initialDocuments: DocRow[];
  onAuditMovement: (
    action: "VIEW" | "EDIT" | "EMAIL" | "PRINT" | "DOWNLOAD",
    documentId: string,
    details?: { title?: string; note?: string },
  ) => Promise<void>;
  onUpdateDocument: (
    documentId: string,
    title: string,
    type: string,
    status: "PENDING" | "CERTIFIED" | "REJECTED",
  ) => Promise<DocRow>;
  onUploadDocumentContent: (documentId: string, formData: FormData) => Promise<{ version: number; byteSize: number; mimeType: string; fileName: string }>;
  onGetDocumentDownloadUrl: (documentId: string) => Promise<{ url: string; fileName: string; version: number }>;
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [selectedId, setSelectedId] = useState(initialDocuments[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const selected = useMemo(() => docs.find((d) => d.id === selectedId) ?? null, [docs, selectedId]);
  const [titleInput, setTitleInput] = useState(selected?.title ?? "");
  const [typeInput, setTypeInput] = useState(selected?.type ?? "");
  const [statusInput, setStatusInput] = useState<"PENDING" | "CERTIFIED" | "REJECTED">(selected?.status ?? "PENDING");

  function syncEditor(documentId: string) {
    const row = docs.find((d) => d.id === documentId);
    if (!row) return;
    setSelectedId(documentId);
    setTitleInput(row.title);
    setTypeInput(row.type);
    setStatusInput(row.status);
    void onAuditMovement("VIEW", row.id, { title: row.title, note: "Document opened in workspace panel" });
  }

  async function saveEdits() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await onUpdateDocument(selected.id, titleInput, typeInput, statusInput);
      setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setInfo("Document metadata saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save document.");
    } finally {
      setSaving(false);
    }
  }

  async function logAndOpenMail() {
    if (!selected) return;
    await onAuditMovement("EMAIL", selected.id, { title: selected.title, note: "Email intent from document panel" });
    window.location.href = `mailto:?subject=${encodeURIComponent(`DealSeal Document: ${selected.title}`)}&body=${encodeURIComponent(
      `Document type: ${selected.type}\nStatus: ${selected.status}\nDocument ID: ${selected.id}`,
    )}`;
  }

  async function logAndPrint() {
    if (!selected) return;
    await onAuditMovement("PRINT", selected.id, { title: selected.title, note: "Print action from document panel" });
    window.print();
  }

  async function logAndDownload() {
    if (!selected) return;
    const out = await onGetDocumentDownloadUrl(selected.id);
    await onAuditMovement("DOWNLOAD", selected.id, {
      title: selected.title,
      note: `Direct binary download initiated (${out.fileName}, v${out.version})`,
    });
    const url = out.url;
    const a = document.createElement("a");
    a.href = url;
    a.download = out.fileName;
    a.click();
  }

  async function uploadBinaryContent(formData: FormData) {
    if (!selected) return;
    setUploading(true);
    setError(null);
    setInfo(null);
    try {
      const out = await onUploadDocumentContent(selected.id, formData);
      setInfo(`Uploaded ${out.fileName} as binary v${out.version} (${out.mimeType}, ${out.byteSize} bytes).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Binary upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="row" style={{ alignItems: "start", gap: "1rem", flexWrap: "wrap" }}>
      <div className="card" style={{ minWidth: 300, flex: 1 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Workspace documents</h2>
        {docs.length === 0 ? <p style={{ color: "var(--muted)" }}>No documents yet in this workspace.</p> : null}
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              className={d.id === selectedId ? "btn" : "btn btn-secondary"}
              onClick={() => syncEditor(d.id)}
              style={{ textAlign: "left" }}
            >
              <div style={{ fontWeight: 700 }}>{d.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {d.type} · {d.status}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ minWidth: 320, flex: 1 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Document editor</h2>
        {!selected ? (
          <p style={{ color: "var(--muted)" }}>Select a document to view or edit.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <label style={{ display: "grid", gap: 6 }}>
              Title
              <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              Type
              <input value={typeInput} onChange={(e) => setTypeInput(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              Status
              <select value={statusInput} onChange={(e) => setStatusInput(e.target.value as "PENDING" | "CERTIFIED" | "REJECTED")}>
                <option value="PENDING">PENDING</option>
                <option value="CERTIFIED">CERTIFIED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </label>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" onClick={() => void saveEdits()} disabled={saving}>
                {saving ? "Saving..." : "Save edits"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void logAndOpenMail()}>
                Email
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void logAndPrint()}>
                Print
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => void logAndDownload()}>
                Download
              </button>
            </div>
            <form
              action={async (fd) => {
                await uploadBinaryContent(fd);
              }}
              style={{ display: "grid", gap: "0.45rem", marginTop: "0.25rem" }}
            >
              <label style={{ display: "grid", gap: 6 }}>
                Upload or replace file content
                <input name="file" type="file" required />
              </label>
              <button type="submit" disabled={uploading}>
                {uploading ? "Uploading..." : "Upload binary content"}
              </button>
            </form>
            {error ? <p style={{ margin: 0, color: "#fecaca" }}>{error}</p> : null}
            {info ? <p style={{ margin: 0, color: "var(--verified)" }}>{info}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
