import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDealerStaffRole } from "@/lib/role-policy";
import { getDealSealStorage, readLocalObject } from "@/lib/storage/deal-seal-storage";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isDealerStaffRole(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.dealerProfile.findUnique({
    where: { workspaceId: session.user.workspaceId },
    select: {
      openingDisclosureStorageKey: true,
      openingDisclosureOriginalName: true,
    },
  });
  if (!profile?.openingDisclosureStorageKey) {
    return NextResponse.json({ error: "Opening disclosure file not found." }, { status: 404 });
  }

  const mode = new URL(req.url).searchParams.get("mode");
  const viewing = mode === "view";
  const fileName = profile.openingDisclosureOriginalName || "opening-disclosure.pdf";

  const storage = getDealSealStorage();
  if (storage.providerLabel === "LOCAL") {
    const buf = await readLocalObject(profile.openingDisclosureStorageKey);
    if (!buf) {
      return NextResponse.json({ error: "Object not found in local storage." }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${viewing ? "inline" : "attachment"}; filename="${fileName.replace(/"/g, "")}"`,
      },
    });
  }

  const url = await storage.presignedGetUrl(profile.openingDisclosureStorageKey, {
    expiresSeconds: 300,
    filename: fileName,
  });
  return NextResponse.redirect(url);
}
