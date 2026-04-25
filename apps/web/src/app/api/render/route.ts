import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDemoRecord } from "@/lib/demo-records";

type RenderRequestBody = {
  recordId?: string;
  mode?: "CERTIFIED" | "NON_AUTHORITATIVE";
};

function isValidMode(mode: unknown): mode is "CERTIFIED" | "NON_AUTHORITATIVE" {
  return mode === "CERTIFIED" || mode === "NON_AUTHORITATIVE";
}

function hashSha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RenderRequestBody;
  if (!body.recordId || !isValidMode(body.mode)) {
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: "recordId and mode (CERTIFIED | NON_AUTHORITATIVE) are required",
      },
      { status: 400 },
    );
  }

  const record = getDemoRecord(body.recordId);
  if (!record) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Record not found" }, { status: 404 });
  }

  const renderedAt = new Date().toISOString();
  const renderingHash = hashSha256(
    JSON.stringify({
      recordId: record.id,
      mode: body.mode,
      recordHash: record.hash,
      version: record.version,
      renderedAt,
    }),
  );

  const verificationUrl = `https://dealseal1.com/verify/${encodeURIComponent(record.id)}?hash=${encodeURIComponent(
    record.hash,
  )}&renderingHash=${encodeURIComponent(renderingHash)}`;

  return NextResponse.json({
    recordId: record.id,
    version: record.version,
    recordHash: record.hash,
    renderingHash,
    verificationUrl,
    renderedAt,
  });
}
