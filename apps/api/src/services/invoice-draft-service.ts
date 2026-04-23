import type { PrismaClient } from "@prisma/client";
import { InvoiceStatus } from "@prisma/client";

/**
 * Sums un-invoiced usage in [periodStart, periodEnd) and groups into a DRAFT invoice.
 */
export async function generateInvoiceDraftForPeriod(
  db: PrismaClient,
  orgId: string,
  options?: { label?: string; day?: Date },
): Promise<{ id: string; totalCents: number }> {
  const d = options?.day ?? new Date();
  const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const label = options?.label ?? `MTD ${periodStart.toISOString().slice(0, 7)}`;

  const events = await db.usageEvent.findMany({
    where: { orgId, recordedAt: { gte: periodStart, lt: periodEnd } },
  });
  const subtotal = events.reduce((s, e) => s + Number(e.amountUsd), 0);
  const totalCents = Math.max(0, Math.round(subtotal * 100));

  const inv = await db.$transaction(async (p) => {
    const invoice = await p.invoice.create({
      data: {
        orgId,
        status: InvoiceStatus.DRAFT,
        totalCents,
        issuedAt: null,
        currency: "usd",
        lines: {
          create: [
            {
              description: `Usage & fees — ${label} (${events.length} events)`,
              amountCents: totalCents,
              metadataJson: { eventIds: events.map((e) => e.id) },
            },
          ],
        },
      },
    });
    return invoice;
  });

  return { id: inv.id, totalCents };
}

export async function listInvoices(
  db: PrismaClient,
  orgId: string,
  take: number = 20,
) {
  return db.invoice.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take,
    include: { lines: true },
  });
}
