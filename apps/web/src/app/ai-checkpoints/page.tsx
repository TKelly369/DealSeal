"use client";

import { useMemo, useState } from "react";
import {
  DealSealComplianceOrchestrator,
  type AuthoritativeContract,
  type DealInput,
  type PostFundingCheckpointResult,
  type PreConsummationCheckpointResult,
} from "@/lib/ai/dealseal-compliance-orchestrator";

const SAMPLE_DEAL_INPUT: DealInput = {
  state: "CA",
  dealerId: "dealer-demo-001",
  lenderId: "lender-demo-001",
  buyer: {
    name: "Demo Buyer",
    address: "123 Demo Street, Los Angeles, CA 90001",
    email: "buyer@demo.example",
  },
  vehicle: {
    year: 2021,
    make: "Demo",
    model: "Vehicle LX",
    vin: "DEMO123456789",
    mileage: 15422,
  },
  financialTerms: {
    cashPrice: 44000,
    downPayment: 3500,
    amountFinanced: 49457.93,
    apr: 8.52,
    termMonths: 72,
    monthlyPayment: 879.77,
    taxes: 3400,
    fees: 620,
    serviceContracts: 1195,
  },
};

function createSampleAuthoritativeContract(): AuthoritativeContract {
  const now = new Date().toISOString();
  return {
    recordId: "auth-record-demo-001",
    dealId: "deal-demo-001",
    state: "CA",
    version: 1,
    status: "LOCKED",
    hash: "sample-authoritative-hash",
    signedAt: now,
    lockedAt: now,
    contractData: {
      dealerId: "dealer-demo-001",
      dealerName: "DealSeal Demo Dealer",
      lenderId: "lender-demo-001",
      lenderName: "DealSeal Demo Lender",
      buyerName: "Demo Buyer",
      buyerAddress: "123 Demo Street, Los Angeles, CA 90001",
      buyerEmail: "buyer@demo.example",
      vin: "DEMO123456789",
      vehicleYear: 2021,
      vehicleMake: "Demo",
      vehicleModel: "Vehicle LX",
      mileage: 15422,
      cashPrice: 44000,
      downPayment: 3500,
      amountFinanced: 49457.93,
      apr: 8.52,
      termMonths: 72,
      monthlyPayment: 879.77,
      taxes: 3400,
      fees: 620,
      serviceContracts: 1195,
      financeCharge: 13885.51,
      assignmentAgreementId: "asg-001",
      lienholderName: "DealSeal Demo Lender",
      lenderAssignmentReference: "assign-ref-001",
    },
  };
}

function StatusBadge({ status }: { status: "GREEN" | "YELLOW" | "RED" }) {
  const cls =
    status === "GREEN" ? "badge ds-badge--verified" : status === "YELLOW" ? "badge ds-badge--warning" : "badge ds-badge--error";
  return <span className={cls}>{status}</span>;
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="ds-checkpoint-list">
      <p className="ds-checkpoint-list__title">{title}</p>
      {items.length === 0 ? (
        <p className="ds-checkpoint-list__empty">None</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiCheckpointsPage() {
  const orchestrator = useMemo(() => new DealSealComplianceOrchestrator(), []);
  const [preResult, setPreResult] = useState<PreConsummationCheckpointResult | null>(null);
  const [postResult, setPostResult] = useState<PostFundingCheckpointResult | null>(null);
  const [runningPre, setRunningPre] = useState(false);
  const [runningPost, setRunningPost] = useState(false);

  const runPreConsummation = async () => {
    setRunningPre(true);
    try {
      const response = await fetch("/api/ai/pre-consummation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE_DEAL_INPUT),
      });
      const payload = (await response.json()) as { checkpoint?: PreConsummationCheckpointResult };
      if (payload.checkpoint) {
        setPreResult(payload.checkpoint);
      }
    } finally {
      setRunningPre(false);
    }
  };

  const runPostFunding = async () => {
    setRunningPost(true);
    try {
      const contract = createSampleAuthoritativeContract();
      const docs = orchestrator.generateRequiredDealerDocs(SAMPLE_DEAL_INPUT);
      const populated = orchestrator.populateDocsFromAuthoritativeContract(contract, docs);

      const response = await fetch("/api/ai/post-funding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contract),
      });
      const payload = (await response.json()) as {
        checkpoint?: PostFundingCheckpointResult;
      };
      if (payload.checkpoint) {
        setPostResult({
          ...payload.checkpoint,
          warnings:
            payload.checkpoint.warnings.length > 0
              ? payload.checkpoint.warnings
              : populated.filter((doc) => doc.missingFields.length > 0).map((doc) => `${doc.docType} has missing fields`),
        });
      }
    } finally {
      setRunningPost(false);
    }
  };

  return (
    <main className="ds-ai-checkpoints">
      <header className="ds-ai-checkpoints__header">
        <h1>AI Deal Checkpoints</h1>
        <p>Deterministic compliance checkpoint orchestration for pre-consummation and post-funding lifecycle controls.</p>
      </header>

      <section className="card ds-ai-checkpoint-card">
        <div className="ds-ai-checkpoint-card__head">
          <h2>Pre-Consummation Green Check</h2>
          {preResult ? <StatusBadge status={preResult.status} /> : <span className="badge">NOT RUN</span>}
        </div>
        <p className="ds-ai-checkpoint-card__sub">Review contract readiness and required remediation before signing/consummation.</p>
        <button className="btn" type="button" onClick={() => void runPreConsummation()} disabled={runningPre}>
          {runningPre ? "Running Checkpoint..." : "Run Checkpoint"}
        </button>

        <ListBlock title="Issues" items={preResult?.issues ?? []} />
        <ListBlock title="Required Fixes" items={preResult?.requiredFixes ?? []} />
        <ListBlock title="Warnings" items={preResult?.warnings ?? []} />
      </section>

      <section className="card ds-ai-checkpoint-card">
        <div className="ds-ai-checkpoint-card__head">
          <h2>Post-Funding Green Check</h2>
          {postResult ? <StatusBadge status={postResult.status} /> : <span className="badge">NOT RUN</span>}
        </div>
        <p className="ds-ai-checkpoint-card__sub">
          Validate funding package completeness, chain-of-custody integrity, and downstream drift prevention.
        </p>
        <button className="btn" type="button" onClick={() => void runPostFunding()} disabled={runningPost}>
          {runningPost ? "Running Checkpoint..." : "Run Checkpoint"}
        </button>

        <ListBlock title="Blockers" items={postResult?.blockers ?? []} />
        <ListBlock title="Warnings" items={postResult?.warnings ?? []} />
        <ListBlock title="Audit Summary" items={postResult?.auditSummary ?? []} />
      </section>
    </main>
  );
}
