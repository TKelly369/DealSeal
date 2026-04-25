import { NextResponse } from "next/server";
import {
  createRenderingHash,
  getDemoRecord,
  buildVerificationUrl,
  type RenderingMode,
} from "@/lib/demo-records";

type RenderRequest = {
  recordId?: string;
  mode?: RenderingMode;
};

function isValidMode(mode: unknown): mode is RenderingMode {
  return mode === "CERTIFIED" || mode === "NON_AUTHORITATIVE";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RenderRequest;
  if (!body.recordId || !isValidMode(body.mode)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request payload",
      },
      { status: 400 },
    );
  }

  const record = getDemoRecord(body.recordId);
  if (!record) {
    return NextResponse.json(
      {
        ok: false,
        error: "Record not found",
      },
      { status: 404 },
    );
  }

  const renderedAt = new Date().toISOString();
  const renderingHash = createRenderingHash(record, body.mode, renderedAt);
  const verificationUrl = buildVerificationUrl(record.id, record.hash, renderingHash);

  return NextResponse.json({
    ok: true,
    recordId: record.id,
    version: record.version,
    recordHash: record.hash,
    renderingHash,
    renderedAt,
    verificationUrl,
  });
}
