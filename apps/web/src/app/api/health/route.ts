import { prisma } from "@/lib/db";

export async function GET() {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "degraded";
    console.error("[DealSeal] Health DB probe failed", error);
  }

  return Response.json({
    status: database === "ok" ? "ok" : "degraded",
    app: "DealSeal",
    domain: "dealseal1.com",
    database,
  });
}
