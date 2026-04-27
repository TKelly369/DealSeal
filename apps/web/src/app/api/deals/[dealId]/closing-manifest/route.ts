import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { dealId } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      generatedDocuments: {
        where: { isAuthoritative: true, authoritativeContractHash: { not: null } },
        orderBy: { createdAt: "asc" },
      },
      authoritativeContract: true,
    },
  });
  if (!deal || deal.dealerId !== session.user.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (deal.status !== "CLOSING_PACKAGE_READY" && deal.status !== "CONSUMMATED") {
    return NextResponse.json({ error: "Closing package not ready" }, { status: 409 });
  }

  const hash = deal.authoritativeContract?.contentHash ?? "";
  const manifest = deal.generatedDocuments.filter((d) => d.documentType === "UCSP_CLOSING_MANIFEST").pop();

  return NextResponse.json({
    dealId,
    authoritativeContractHash: hash,
    hashSeal: hash ? hash.slice(0, 8) : "",
    manifestFileUrl: manifest?.fileUrl ?? null,
    documents: deal.generatedDocuments.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      fileUrl: d.fileUrl,
      version: d.version,
      authoritativeContractHash: d.authoritativeContractHash,
      hashSeal: d.authoritativeContractHash ? d.authoritativeContractHash.slice(0, 8) : "",
    })),
  });
}
