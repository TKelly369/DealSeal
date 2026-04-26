import { NextRequest, NextResponse } from "next/server";
import { computeRecordHash, computeRenderingHash, RenderingMode } from "@/lib/certification";
import { getDemoRecordById } from "@/lib/demo-records";

type RenderRequest = {
  recordId?: string;
  mode?: RenderingMode;
};

function isRenderingMode(value: string): value is RenderingMode {
  return value === "certified" || value === "non_authoritative";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as RenderRequest;
  if (!body.recordId || !body.mode || !isRenderingMode(body.mode)) {
    return NextResponse.json({ error: "recordId and mode are required." }, { status: 400 });
  }

  const record = getDemoRecordById(body.recordId);
  if (!record) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  const recordHash = computeRecordHash(record);
  const renderingHash = computeRenderingHash(record, body.mode);
  const timestamp = new Date().toISOString();
  const verifyParams = new URLSearchParams({
    hash: recordHash,
    renderingHash,
    timestamp,
  });
  const verificationUrl = `/verify/${encodeURIComponent(record.id)}?${verifyParams.toString()}`;

  return NextResponse.json({
    recordHash,
    renderingHash,
    verificationUrl,
    timestamp,
    mode: body.mode,
  });
}
