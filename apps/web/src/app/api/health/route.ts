export async function GET() {
  return Response.json({
    status: "ok",
    app: "DealSeal",
    domain: "dealseal1.com",
  });
}
