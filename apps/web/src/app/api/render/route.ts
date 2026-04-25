import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { buildVerificationUrl, getDemoRecord } from "@/lib/demo-records";

type RenderRequestBody = {
  recordId?: string;
  mode?: "CERTIFIED" | "NON_AUTHORITATIVE";
};

function isRenderMode(value: unknown): value is "CERTIFIED" | "NON_AUTHORITATIVE" {
  return value === "CERTIFIED" || value === "NON_AUTHORITATIVE";
}

function buildRenderingHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RenderRequestBody;
  if (!body.recordId || !isRenderMode(body.mode)) {
    return NextResponse.json(
      { message: "recordId and mode (CERTIFIED | NON_AUTHORITATIVE) are required" },
      { status: 400 },
    );
  }

  const record = getDemoRecord(body.recordId);
  if (!record) {
    return NextResponse.json({ message: "Demo record not found" }, { status: 404 });
  }

  const renderedAt = new Date().toISOString();
  const renderingHash = buildRenderingHash(record.id + record.hash + body.mode + renderedAt);
  const verificationUrl = buildVerificationUrl(record.id, record.hash, renderingHash);

  return NextResponse.json({
    recordId: record.id,
    version: record.version,
    recordHash: record.hash,
    renderingHash,
    renderedAt,
    verificationUrl,
  });
}
