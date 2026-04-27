"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { CertificationQueueRow, certifyDocument, rejectDocument } from "@/app/admin/actions";
import { DocumentCertificationSchema } from "@/lib/types";

export function CertificationReviewSheet({
  item,
  open,
  onOpenChange,
  onDone,
}: {
  item: CertificationQueueRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (mode: "certify" | "reject") => {
    setError(null);
    const parsed = DocumentCertificationSchema.safeParse({
      docId: item?.id ?? "",
      adminNotes: notes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input.");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "certify") {
          await certifyDocument(parsed.data);
          onDone(`Certified ${parsed.data.docId}`);
        } else {
          await rejectDocument(parsed.data);
          onDone(`Rejected ${parsed.data.docId}`);
        }
        onOpenChange(false);
        setNotes("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed.");
      }
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ds-sheet-overlay" />
        <Dialog.Content className="ds-sheet-content ds-sheet-content-right">
          <div className="ds-sidebar-top">
            <Dialog.Title>Certification Review</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close review sheet">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          {item ? (
            <>
              <p style={{ color: "var(--muted)" }}>Review metadata and issue a certification decision.</p>
              <dl className="ds-meta-grid">
                <dt>Document ID</dt>
                <dd>{item.id}</dd>
                <dt>Submitted By</dt>
                <dd>
                  {item.submittedBy} ({item.submitterRole})
                </dd>
                <dt>Type</dt>
                <dd>{item.documentType}</dd>
                <dt>Date Submitted</dt>
                <dd>{new Date(item.dateSubmitted).toLocaleString()}</dd>
              </dl>
              <label style={{ display: "grid", gap: 6, marginTop: "0.9rem", color: "var(--text-secondary)" }}>
                Admin Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Explain the decision and compliance rationale..."
                />
              </label>
              {error ? <p style={{ color: "#fecaca", marginBottom: 0 }}>{error}</p> : null}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.9rem" }}>
                <button type="button" disabled={pending} onClick={() => run("certify")}>
                  {pending ? "Processing..." : "Certify Document"}
                </button>
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run("reject")}>
                  Reject Document
                </button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
