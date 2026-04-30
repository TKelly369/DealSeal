import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDealerStaffRole } from "@/lib/role-policy";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isDealerStaffRole(session.user.role)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const profile = await prisma.dealerProfile.findUnique({
    where: { workspaceId: session.user.workspaceId },
    select: {
      legalName: true,
      dbaName: true,
      businessPhone: true,
      titleClerkName: true,
      titleClerkEmail: true,
    },
  });

  const now = new Date().toLocaleString();
  const dealerName = profile?.legalName || profile?.dbaName || "Dealer workspace";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>DealSeal Initial Disclosure Packet</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      h2 { font-size: 16px; margin: 22px 0 6px; }
      h3 { font-size: 14px; margin: 16px 0 6px; }
      p { margin: 6px 0; line-height: 1.4; }
      li { margin: 4px 0; line-height: 1.35; }
      .box { border: 1px solid #333; padding: 12px; border-radius: 6px; margin-top: 12px; }
      .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .table th, .table td { border: 1px solid #777; padding: 6px; font-size: 12px; text-align: left; vertical-align: top; }
      .small { color: #333; font-size: 12px; }
      .sign { margin-top: 40px; border-top: 1px solid #444; padding-top: 8px; width: 380px; }
      @media print { .no-print { display: none; } body { margin: 16px; } }
    </style>
  </head>
  <body>
    <button class="no-print" onclick="window.print()">Print disclosure packet</button>
    <h1>DEALSEAL</h1>
    <p><strong>Initial Disclosure, Deal Authorization, and Change Summary Packet</strong></p>
    <p class="small">Template for customer-facing pre-submission disclosure, final execution disclosure, and litigation-protective change summary.</p>
    <p>Generated: ${now}</p>
    <div class="box">
      <p><strong>Dealer workspace:</strong> ${session.user.workspaceId}</p>
      <p><strong>Dealer legal name:</strong> ${dealerName}</p>
      <p><strong>Business phone:</strong> ${profile?.businessPhone ?? "Pending"}</p>
      <p><strong>Title clerk:</strong> ${profile?.titleClerkName ?? "Pending"}${profile?.titleClerkEmail ? ` (${profile.titleClerkEmail})` : ""}</p>
    </div>
    <h2>Document Purpose</h2>
    <p>This packet is designed to be the first customer-signed disclosure uploaded by the dealer before the DealSeal system allows substantive deal work. The customer acknowledges that all pre-approval terms are estimates, that lender approval controls the final contract, and that final signed documents consummate the deal.</p>

    <h2>Important Implementation Rule</h2>
    <p>The dealer may create a file shell with basic identity information, but the system should block deal numbers, financing structure, document generation, document upload, lender submission, and contract workflow until the signed Initial Disclosure is uploaded, validated, timestamped, and associated with the file.</p>

    <h2>1. DealSeal Initial Disclosure and Process Acknowledgment</h2>
    <p><strong>IMPORTANT: PLEASE READ CAREFULLY BEFORE PROCEEDING.</strong></p>
    <p>This DealSeal Initial Disclosure and Process Acknowledgment explains how your vehicle purchase and financing transaction will be structured, reviewed, submitted, approved, finalized, and signed through the DealSeal platform. By signing this disclosure, you authorize the dealer to begin the DealSeal process and acknowledge that no final purchase or financing contract exists until final lender-approved documents are presented and signed.</p>
    <h3>A. Purpose of this disclosure</h3>
    <p>This document is the first step in opening your transaction inside the DealSeal system. It allows the dealer to begin preparing your proposed deal file and working toward lender review. This disclosure is not the final purchase contract, retail installment sales contract, security agreement, loan agreement, or final financing agreement.</p>
    <h3>B. Everything before lender approval is an estimate</h3>
    <p>You understand that any numbers, payment amounts, finance terms, annual percentage rate estimates, taxes, fees, down payment amounts, trade-in values, payoff estimates, warranties, protection products, or other deal terms discussed before lender approval are estimates only.</p>
    <h3>C. Dealer preparation and system-controlled document assembly</h3>
    <p>After this disclosure is signed and uploaded, the dealer may use DealSeal to structure the proposed transaction. DealSeal may assist in preparing transaction data, compliance checks, state-specific forms, lender-required documents, and related paperwork.</p>
    <h3>D. State-specific compliance and onboarding logic</h3>
    <p>DealSeal may use dealer onboarding, lender onboarding, and transaction setup data to determine applicable state and lender compliance requirements.</p>
    <h3>E. Lender review and approval controls final terms</h3>
    <p>The lender may approve, decline, request more information, or approve with different terms. Lender approval controls final financing terms.</p>
    <h3>F. Final documents after lender approval</h3>
    <p>Only final documents presented after lender approval and signed by the customer create the binding purchase and financing agreement.</p>
    <h3>G. Changes and re-disclosure at signature</h3>
    <p>If final lender-approved terms differ from preliminary terms, a Change Summary Disclosure should identify differences before final signature.</p>
    <h3>H. Final execution and consummation</h3>
    <p>Your transaction is not final and not consummated until final lender-approved documents are presented and signed.</p>
    <p><strong>Plain-English Customer Statement:</strong> Everything before lender approval is an estimate. Once the lender approves the deal, DealSeal updates the contract and all related documents to match lender-approved terms before signature.</p>

    <h3>I. Customer acknowledgments</h3>
    <ul>
      <li>You have read and understand this disclosure.</li>
      <li>You authorize the dealer to open and begin preparing your DealSeal transaction file.</li>
      <li>All pre-approval terms are estimates only and may change during lender review.</li>
      <li>No binding purchase or financing contract is created by signing this initial disclosure.</li>
      <li>The final lender-approved contract controls the transaction if you choose to sign it.</li>
      <li>The transaction is not consummated until final lender-approved documents are signed.</li>
    </ul>
    <table class="table">
      <thead>
        <tr>
          <th>Signature Field</th>
          <th>Entry / Signature</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Customer Printed Name</td><td>______________________________________________</td></tr>
        <tr><td>Customer Signature</td><td>______________________________________________</td></tr>
        <tr><td>Date</td><td>______________________________________________</td></tr>
        <tr><td>Dealer Representative</td><td>______________________________________________</td></tr>
        <tr><td>Dealership Name</td><td>${dealerName}</td></tr>
        <tr><td>DealSeal File / Deal ID</td><td>______________________________________________</td></tr>
      </tbody>
    </table>

    <h2>2. DealSeal Change Summary Disclosure</h2>
    <p>This Change Summary Disclosure is intended to be generated at final signature whenever final lender-approved terms differ from preliminary submitted or estimated terms.</p>
    <p><strong>Use Trigger:</strong> Generate this disclosure whenever there is any material difference in selling price, down payment, financed amount, APR, term, payment, taxes, fees, add-ons, trade treatment, payoff, collateral, buyer/co-buyer info, lender, or document package.</p>
    <h3>C. Change comparison table</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Field / Term</th>
          <th>Preliminary Submitted / Estimated Term</th>
          <th>Final Lender-Approved Term</th>
          <th>Changed?</th>
          <th>Explanation / Source</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Vehicle cash price / selling price</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Taxes</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Dealer fees</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Down payment / cash due</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Amount financed</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>APR / finance charge</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Contract term</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Monthly payment</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Lender / assignee</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>GAP / protection products</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Collateral / VIN</td><td></td><td></td><td></td><td></td></tr>
        <tr><td>Buyer / co-buyer information</td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    <h3>D. System certification fields</h3>
    <ul>
      <li>DealSeal File / Deal ID</li>
      <li>Initial Disclosure upload timestamp and hash</li>
      <li>Preliminary submission timestamp</li>
      <li>Lender approval timestamp or reference</li>
      <li>Final contract generation timestamp and hash</li>
      <li>User or system actor responsible for each change</li>
      <li>State and lender compliance profile used for the transaction</li>
      <li>Final contract package version number</li>
    </ul>
    <h3>E. Final acknowledgment</h3>
    <p>By signing below, you acknowledge this Change Summary Disclosure was provided before or at final signing, and that you had the opportunity to review final lender-approved terms.</p>
    <table class="table">
      <thead>
        <tr>
          <th>Signature Field</th>
          <th>Entry / Signature</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Customer Printed Name</td><td>______________________________________________</td></tr>
        <tr><td>Customer Signature</td><td>______________________________________________</td></tr>
        <tr><td>Date</td><td>______________________________________________</td></tr>
        <tr><td>Dealer Representative</td><td>______________________________________________</td></tr>
        <tr><td>Dealership Name</td><td>${dealerName}</td></tr>
        <tr><td>DealSeal File / Deal ID</td><td>______________________________________________</td></tr>
      </tbody>
    </table>
    <div class="sign">
      <p class="small">Legal note: This template should be reviewed by qualified counsel before production use in any state.</p>
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
