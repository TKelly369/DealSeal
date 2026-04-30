import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DealWorkflowService } from "@/lib/services/deal-workflow.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { dealId } = await params;
  const deal = await DealWorkflowService.getDealForActor(dealId, session.user.workspaceId, "dealer");
  if (!deal) {
    return new NextResponse("Deal not found", { status: 404 });
  }

  const buyer = deal.parties.find((p) => p.role === "BUYER");
  const vehicle = deal.vehicle ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}` : "Pending vehicle";
  const now = new Date().toLocaleString();
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DealSeal Initial Disclosure</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 20px 0 6px; }
      p { margin: 6px 0; line-height: 1.4; }
      .box { border: 1px solid #333; padding: 12px; border-radius: 6px; margin-top: 12px; }
      .sign { margin-top: 40px; border-top: 1px solid #444; padding-top: 8px; width: 360px; }
      @media print { .no-print { display: none; } body { margin: 16px; } }
    </style>
  </head>
  <body>
    <button class="no-print" onclick="window.print()">Print disclosure</button>
    <h1>DealSeal Initial Dealer Disclosure</h1>
    <p>Generated: ${now}</p>
    <div class="box">
      <p><strong>Deal ID:</strong> ${deal.id}</p>
      <p><strong>Dealer workspace:</strong> ${deal.dealerId}</p>
      <p><strong>Lender workspace:</strong> ${deal.lenderId}</p>
      <p><strong>Buyer:</strong> ${buyer ? `${buyer.firstName} ${buyer.lastName}` : "Pending buyer details"}</p>
      <p><strong>Vehicle:</strong> ${vehicle}</p>
      <p><strong>State:</strong> ${deal.state}</p>
    </div>
    <h2>Disclosure statement</h2>
    <p>This disclosure confirms the customer has been informed that final lender approval, coordinated contract generation, and signature capture must follow DealSeal workflow controls.</p>
    <p>Customer acknowledges the pre-lender package is for review and may change based on lender conditions.</p>
    <div class="sign">
      <p>Customer signature: ________________________________</p>
      <p>Date: ____________________</p>
    </div>
    <div class="sign">
      <p>Dealer representative: ________________________________</p>
      <p>Date: ____________________</p>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
