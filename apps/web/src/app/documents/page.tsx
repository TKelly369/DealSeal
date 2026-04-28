import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { DocumentsPanelClient } from "./DocumentsPanelClient";
import { createDocumentDownloadUrl, uploadDocumentBinary } from "@/lib/services/document-binary.service";

type MovementAction = "VIEW" | "EDIT" | "EMAIL" | "PRINT" | "DOWNLOAD";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/documents");

  const docs = await prisma.document.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const writeMovementAudit = async (
    action: MovementAction,
    documentId: string,
    details: { title?: string; note?: string } = {},
  ) => {
    "use server";
    const fresh = await auth();
    if (!fresh?.user) return;
    try {
      await prisma.userAccessAudit.create({
        data: {
          userId: fresh.user.id,
          workspaceId: fresh.user.workspaceId,
          fullName: fresh.user.name ?? fresh.user.email ?? "Unknown user",
          title: null,
          phone: null,
          metadata: {
            eventType: "DOCUMENT_MOVEMENT",
            action,
            documentId,
            documentTitle: details.title ?? null,
            note: details.note ?? null,
            role: fresh.user.role,
            source: "/documents",
          },
        },
      });
    } catch (e) {
      console.error("[DealSeal] document movement audit write failed", e);
    }
  };

  const updateDocument = async (documentId: string, title: string, type: string, status: "PENDING" | "CERTIFIED" | "REJECTED") => {
    "use server";
    const fresh = await auth();
    if (!fresh?.user) throw new Error("Authentication required.");

    const row = await prisma.document.findFirst({
      where: { id: documentId, workspaceId: fresh.user.workspaceId },
      select: { id: true },
    });
    if (!row) throw new Error("Document not found for your workspace.");

    const nextTitle = title.trim();
    const nextType = type.trim();
    if (!nextTitle) throw new Error("Title is required.");
    if (!nextType) throw new Error("Type is required.");

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { title: nextTitle, type: nextType, status },
      select: { id: true, title: true, type: true, status: true, createdAt: true, updatedAt: true },
    });
    await writeMovementAudit("EDIT", updated.id, { title: updated.title, note: "Document metadata updated" });
    return updated;
  };

  const uploadDocumentContent = async (documentId: string, formData: FormData) => {
    "use server";
    const fresh = await auth();
    if (!fresh?.user) throw new Error("Authentication required.");
    const row = await prisma.document.findFirst({
      where: { id: documentId, workspaceId: fresh.user.workspaceId },
      select: { id: true, title: true },
    });
    if (!row) throw new Error("Document not found for your workspace.");
    const maybeFile = formData.get("file");
    if (!(maybeFile instanceof File)) {
      throw new Error("No file provided.");
    }
    const out = await uploadDocumentBinary({
      workspaceId: fresh.user.workspaceId,
      documentId,
      file: maybeFile,
      actorUserId: fresh.user.id,
    });
    await writeMovementAudit("EDIT", row.id, {
      title: row.title,
      note: `Binary upload v${out.version} (${out.fileName}, ${out.mimeType}, ${out.byteSize} bytes)`,
    });
    return out;
  };

  const getDocumentDownloadUrl = async (documentId: string) => {
    "use server";
    const fresh = await auth();
    if (!fresh?.user) throw new Error("Authentication required.");
    const row = await prisma.document.findFirst({
      where: { id: documentId, workspaceId: fresh.user.workspaceId },
      select: { id: true, title: true },
    });
    if (!row) throw new Error("Document not found for your workspace.");
    const out = await createDocumentDownloadUrl({
      workspaceId: fresh.user.workspaceId,
      documentId,
      expiresSeconds: 300,
    });
    await writeMovementAudit("DOWNLOAD", row.id, {
      title: row.title,
      note: `Binary download v${out.version} (${out.fileName})`,
    });
    return out;
  };

  return (
    <div>
      <h1>Document panel</h1>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <p>Dealers and lenders can view, edit, email, print, and download workspace documents.</p>
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>
          Every document movement is audit logged after authenticated login.
        </p>
      </div>
      <DocumentsPanelClient
        initialDocuments={docs}
        onAuditMovement={writeMovementAudit}
        onUpdateDocument={updateDocument}
        onUploadDocumentContent={uploadDocumentContent}
        onGetDocumentDownloadUrl={getDocumentDownloadUrl}
      />
    </div>
  );
}
