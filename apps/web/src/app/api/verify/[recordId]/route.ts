import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "@/lib/config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public verification proxy: browsers hit the web origin `/api/verify/:id` (e.g. from QR); this route fetches the API.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await ctx.params;
  if (!UUID_RE.test(recordId)) {
    return NextResponse.json({ code: "INVALID_ID", message: "A valid record identifier is required" }, { status: 400 });
  }
  const apiBase = getServerApiBaseUrl();
  const res = await fetch(`${apiBase}/api/verify/${encodeURIComponent(recordId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
