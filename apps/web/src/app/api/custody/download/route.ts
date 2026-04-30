import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertDocumentAccessAndLog } from "@/lib/services/document-custody-access.service";
import { getDealSealStorage, readLocalObject } from "@/lib/storage/deal-seal-storage";

/**
 * Custodial download for rows with `GeneratedDocument.storageKey`.
 * Query: dealId, documentId — avoids exposing raw object keys in URLs.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId");
  const documentId = searchParams.get("documentId");
  if (!dealId || !documentId) {
    return NextResponse.json({ error: "dealId and documentId are required." }, { status: 400 });
  }

  const doc = await prisma.generatedDocument.findFirst({
    where: { id: documentId, dealId },
  });
  if (!doc?.storageKey) {
    return NextResponse.json({ error: "Document has no custodial storage key yet." }, { status: 404 });
  }

  const logged = await assertDocumentAccessAndLog({
    session: session.user,
    dealId,
    documentId,
    action: "DOWNLOAD",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
  });
  if (!logged.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storage = getDealSealStorage();
  if (storage.providerLabel === "LOCAL") {
    const buf = await readLocalObject(doc.storageKey);
    if (!buf) {
      return NextResponse.json({ error: "Object not found in local vault." }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="document-${documentId.slice(0, 8)}.bin"`,
      },
    });
  }

  const url = await storage.presignedGetUrl(doc.storageKey, { expiresSeconds: 300 });
  return NextResponse.redirect(url);
}
