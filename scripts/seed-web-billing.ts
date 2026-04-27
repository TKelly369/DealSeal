import crypto from "node:crypto";
import { config } from "dotenv";
import { resolve } from "node:path";
import {
  PrismaClient,
  UserRole,
  MembershipRole,
  SubscriptionStatus,
  WorkspaceType,
  DealerLenderLinkStatus,
  LenderEntityType,
  AssignmentType,
  VehicleTypeSelection,
  SigningMethod,
  DealStatus,
  VehicleCondition,
  CustodyEventType,
  DocumentType,
  GeneratedDocumentType,
  ContractTransactionEventType,
  LoanPoolType,
  LoanPoolStatus,
  SecondaryMarketStatus,
  RecourseStatus,
  NegotiableInstrumentType,
  InstrumentTransferType,
} from "../apps/web/src/generated/prisma";

config({ path: resolve(process.cwd(), "apps/web/.env.local") });
config({ path: resolve(process.cwd(), ".env"), override: false });

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: "dealseal-demo-workspace" },
    update: { name: "DealSeal Demo Workspace", type: WorkspaceType.DEALERSHIP },
    create: {
      id: "workspace-main",
      slug: "dealseal-demo-workspace",
      name: "DealSeal Demo Workspace",
      type: WorkspaceType.DEALERSHIP,
    },
  });

  const lenderWorkspace = await prisma.workspace.upsert({
    where: { slug: "dealseal-lender-demo" },
    update: { name: "Demo Lender", type: WorkspaceType.LENDER },
    create: {
      id: "ws-lender-demo",
      slug: "dealseal-lender-demo",
      name: "Demo Lender",
      type: WorkspaceType.LENDER,
    },
  });

  await prisma.dealerProfile.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      legalName: "Demo Dealer LLC",
      stateOfFormation: "TX",
      operatingStates: ["TX"],
      addOnsOffered: ["GAP"],
      vehicleTypes: VehicleTypeSelection.BOTH,
      signingMethod: SigningMethod.HYBRID,
      licenseNumber: "DL-1000",
    },
  });

  await prisma.lenderProfile.upsert({
    where: { workspaceId: lenderWorkspace.id },
    update: {},
    create: {
      workspaceId: lenderWorkspace.id,
      legalName: "Demo Lender Capital",
      entityType: LenderEntityType.FINANCE,
      licensedStates: ["TX"],
      acceptedDealerTypes: ["FRANCHISE", "INDEPENDENT"],
      assignmentType: AssignmentType.IMMEDIATE,
    },
  });

  const link = await prisma.dealerLenderLink.upsert({
    where: {
      dealerId_lenderId: {
        dealerId: workspace.id,
        lenderId: lenderWorkspace.id,
      },
    },
    update: { status: DealerLenderLinkStatus.APPROVED },
    create: {
      dealerId: workspace.id,
      lenderId: lenderWorkspace.id,
      status: DealerLenderLinkStatus.APPROVED,
      approvedStates: ["TX"],
      allowedDealTypes: ["NEW", "USED"],
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@dealseal1.com" },
    update: { name: "DealSeal Admin", role: UserRole.ADMIN },
    create: {
      id: "admin-001",
      email: "admin@dealseal1.com",
      name: "DealSeal Admin",
      role: UserRole.ADMIN,
    },
  });

  const standardUser = await prisma.user.upsert({
    where: { email: "user@dealseal1.com" },
    update: { name: "DealSeal User", role: UserRole.USER },
    create: {
      id: "user-001",
      email: "user@dealseal1.com",
      name: "DealSeal User",
      role: UserRole.USER,
    },
  });

  const lenderAdmin = await prisma.user.upsert({
    where: { email: "lender.admin@dealseal1.com" },
    update: { name: "Lender Admin", role: UserRole.LENDER_ADMIN },
    create: {
      id: "lender-admin-001",
      email: "lender.admin@dealseal1.com",
      name: "Lender Admin",
      role: UserRole.LENDER_ADMIN,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: admin.id,
        workspaceId: workspace.id,
      },
    },
    update: { role: MembershipRole.OWNER },
    create: {
      userId: admin.id,
      workspaceId: workspace.id,
      role: MembershipRole.OWNER,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: standardUser.id,
        workspaceId: workspace.id,
      },
    },
    update: { role: MembershipRole.MEMBER },
    create: {
      userId: standardUser.id,
      workspaceId: workspace.id,
      role: MembershipRole.MEMBER,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: lenderAdmin.id,
        workspaceId: lenderWorkspace.id,
      },
    },
    update: { role: MembershipRole.OWNER },
    create: {
      userId: lenderAdmin.id,
      workspaceId: lenderWorkspace.id,
      role: MembershipRole.OWNER,
    },
  });

  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {
      status: SubscriptionStatus.CANCELED,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    },
    create: {
      workspaceId: workspace.id,
      status: SubscriptionStatus.CANCELED,
      stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    },
  });

  const greenDealId = "seed-deal-green-stage";
  await prisma.deal.upsert({
    where: { id: greenDealId },
    update: {
      status: DealStatus.GREEN_STAGE,
    },
    create: {
      id: greenDealId,
      dealerId: workspace.id,
      lenderId: lenderWorkspace.id,
      dealerLenderLinkId: link.id,
      status: DealStatus.GREEN_STAGE,
      state: "TX",
      parties: {
        create: {
          role: "BUYER",
          firstName: "Seed",
          lastName: "Buyer",
          address: "100 Demo Rd, Austin TX",
          creditTier: "A",
        },
      },
      vehicle: {
        create: {
          year: 2023,
          make: "Honda",
          model: "Civic",
          vin: "SEEDVIN123456789",
          mileage: 5000,
          condition: VehicleCondition.USED,
        },
      },
      financials: {
        create: {
          amountFinanced: "22000.00",
          ltv: "0.8500",
          maxLtv: "0.9000",
          taxes: "1500.00",
          fees: "399.00",
          gap: "600.00",
          warranty: "0.00",
          totalSalePrice: "26000.00",
        },
      },
    },
  });

  const hasDisclosure = await prisma.generatedDocument.findFirst({
    where: { dealId: greenDealId, documentType: DocumentType.PROCESS_DISCLOSURE },
  });
  if (!hasDisclosure) {
    const doc = await prisma.generatedDocument.create({
      data: {
        dealId: greenDealId,
        authoritativeContractId: null,
        type: GeneratedDocumentType.DISCLOSURE,
        documentType: DocumentType.PROCESS_DISCLOSURE,
        fileUrl: `/mock-uploads/process-disclosure-${greenDealId}.pdf`,
        version: 1,
        valuesSnapshot: { seeded: true },
      },
    });
    await prisma.documentCustodyEvent.create({
      data: {
        dealId: greenDealId,
        documentId: doc.id,
        eventType: CustodyEventType.GENERATED,
        actorUserId: admin.id,
        actorRole: "ADMIN",
        metadata: { note: "Seed: disclosure acknowledged" },
      },
    });
  }

  const poolId = "seed-loan-pool-1";
  await prisma.loanPool.upsert({
    where: { id: poolId },
    update: {
      status: LoanPoolStatus.FORMING,
      recourseStatus: RecourseStatus.WITHOUT_RECOURSE,
    },
    create: {
      id: poolId,
      lenderId: lenderWorkspace.id,
      poolName: "Demo Securitization 2026-A",
      poolType: LoanPoolType.SECURITIZATION,
      recourseStatus: RecourseStatus.WITHOUT_RECOURSE,
      targetSize: 5_000_000,
      status: LoanPoolStatus.FORMING,
    },
  });

  const lockDealId = "seed-deal-authoritative-lock";
  await prisma.deal.upsert({
    where: { id: lockDealId },
    update: {
      status: DealStatus.AUTHORITATIVE_LOCK,
      secondaryMarketStatus: SecondaryMarketStatus.AVAILABLE_FOR_SALE,
      secondaryMarketGrade: "Prime",
    },
    create: {
      id: lockDealId,
      dealerId: workspace.id,
      lenderId: lenderWorkspace.id,
      dealerLenderLinkId: link.id,
      status: DealStatus.AUTHORITATIVE_LOCK,
      state: "TX",
      secondaryMarketStatus: SecondaryMarketStatus.AVAILABLE_FOR_SALE,
      secondaryMarketGrade: "Prime",
      parties: {
        create: {
          role: "BUYER",
          firstName: "Alex",
          lastName: "Investor",
          address: "200 Main St, Austin TX",
          creditTier: "A",
        },
      },
      vehicle: {
        create: {
          year: 2022,
          make: "Toyota",
          model: "Camry",
          vin: "LOCKVIN1234567890",
          mileage: 12000,
          condition: VehicleCondition.USED,
        },
      },
      financials: {
        create: {
          amountFinanced: "18000.00",
          ltv: "0.8200",
          maxLtv: "0.9500",
          taxes: "1200.00",
          fees: "299.00",
          gap: "0.00",
          warranty: "0.00",
          totalSalePrice: "22000.00",
        },
      },
    },
  });

  const lockAuthHash = crypto.createHash("sha256").update(`seed-auth-${lockDealId}`).digest("hex");
  const authRow = await prisma.authoritativeContract.upsert({
    where: { dealId: lockDealId },
    update: {
      uccDebtorName: "Alex Investor",
      uccCollateralDescription: {
        vin: "LOCKVIN1234567890",
        year: 2022,
        make: "Toyota",
        model: "Camry",
      },
      isTransferableRecord: true,
    },
    create: {
      dealId: lockDealId,
      version: 1,
      contentHash: lockAuthHash,
      governingLaw: "TX",
      signatureStatus: "EXECUTED_RISC",
      isTransferableRecord: true,
      uccCollateralDescription: {
        vin: "LOCKVIN1234567890",
        year: 2022,
        make: "Toyota",
        model: "Camry",
      },
      uccDebtorName: "Alex Investor",
    },
  });

  async function ensureDoc(
    dealId: string,
    documentType: DocumentType,
    type: GeneratedDocumentType,
    fileUrl: string,
    extra: Record<string, unknown> = {},
    authoritativeContractId: string | null = null,
    authoritativeContractHash: string | null = null,
  ) {
    const exists = await prisma.generatedDocument.findFirst({ where: { dealId, documentType } });
    if (exists) return exists;
    const agg = await prisma.generatedDocument.aggregate({
      where: { dealId, documentType },
      _max: { version: true },
    });
    const version = (agg._max.version ?? 0) + 1;
    const isSigned = documentType === DocumentType.RISC_SIGNED;
    const isAuthStamped =
      isSigned || documentType === DocumentType.UCSP_CLOSING_MANIFEST;
    return prisma.generatedDocument.create({
      data: {
        dealId,
        authoritativeContractId,
        type,
        documentType,
        fileUrl,
        version,
        isAuthoritative: isAuthStamped,
        authoritativeContractHash: isAuthStamped ? authoritativeContractHash : null,
        valuesSnapshot: { seeded: true, ...extra },
      },
    });
  }

  async function ensureInstrument(dealId: string, payToOrderOf: string) {
    return prisma.negotiableInstrument.upsert({
      where: { dealId },
      update: {
        payToOrderOf,
        eNoteControlLocation: "DealSeal Seed eVault",
      },
      create: {
        dealId,
        instrumentType: NegotiableInstrumentType.RISC_AS_NOTE,
        payToOrderOf,
        isBearerInstrument: false,
        isElectronicNote: true,
        eNoteControlLocation: "DealSeal Seed eVault",
      },
    });
  }

  async function ensureInstrumentTransfer(
    dealId: string,
    instrumentId: string,
    fromEntityId: string,
    toEntityId: string,
    transferType: InstrumentTransferType,
    endorsementLanguage: string,
  ) {
    const existing = await prisma.instrumentTransferEvent.findFirst({
      where: { dealId, fromEntityId, toEntityId, transferType },
    });
    if (existing) return existing;
    return prisma.instrumentTransferEvent.create({
      data: {
        dealId,
        instrumentId,
        fromEntityId,
        toEntityId,
        transferType,
        endorsementLanguage,
      },
    });
  }

  await ensureDoc(
    lockDealId,
    DocumentType.RISC_LENDER_FINAL,
    GeneratedDocumentType.CONTRACT,
    `/mock-uploads/${lockDealId}/risc-lender-final-v1.pdf`,
    { securityAgreementPresent: true, securityAgreementSummary: "Seed lender-final RISC." },
  );

  const lockInstrument = await ensureInstrument(lockDealId, lenderWorkspace.id);
  await ensureDoc(
    lockDealId,
    DocumentType.RISC_SIGNED,
    GeneratedDocumentType.CONTRACT,
    `/mock-uploads/${lockDealId}/risc-signed-v1.pdf`,
    { originalFileName: "seed-signed.pdf" },
    authRow.id,
    lockAuthHash,
  );

  const assignHash = crypto.createHash("sha256").update(`${lockDealId}|assign`).digest("hex");
  const hasAssign = await prisma.contractTransactionEvent.findFirst({
    where: { dealId: lockDealId, eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER },
  });
  if (!hasAssign) {
    const transfer = await ensureInstrumentTransfer(
      lockDealId,
      lockInstrument.id,
      workspace.id,
      lenderWorkspace.id,
      InstrumentTransferType.ENDORSEMENT,
      `Pay to the order of ${lenderWorkspace.id}.`,
    );
    await prisma.contractTransactionEvent.create({
      data: {
        dealId: lockDealId,
        eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER,
        fromEntityId: workspace.id,
        toEntityId: lenderWorkspace.id,
        considerationAmount: 18000,
        auditHash: assignHash,
        instrumentTransferEventId: transfer.id,
      },
    });
  }

  const closingDealId = "seed-deal-closing-ready";
  const closingHash = crypto.createHash("sha256").update(`seed-closing-${closingDealId}`).digest("hex");
  await prisma.deal.upsert({
    where: { id: closingDealId },
    update: {
      status: DealStatus.CLOSING_PACKAGE_READY,
      secondaryMarketStatus: SecondaryMarketStatus.AVAILABLE_FOR_SALE,
      secondaryMarketGrade: "Subprime",
    },
    create: {
      id: closingDealId,
      dealerId: workspace.id,
      lenderId: lenderWorkspace.id,
      dealerLenderLinkId: link.id,
      status: DealStatus.CLOSING_PACKAGE_READY,
      state: "TX",
      secondaryMarketStatus: SecondaryMarketStatus.AVAILABLE_FOR_SALE,
      secondaryMarketGrade: "Subprime",
      consummatedData: {
        parties: [{ role: "BUYER", firstName: "Jamie", lastName: "Close", address: "300 Oak", creditTier: "C" }],
        vehicle: {
          year: 2021,
          make: "Ford",
          model: "F-150",
          vin: "CLOSVIN9876543210",
          mileage: 45000,
          condition: "USED",
        },
        financials: {
          amountFinanced: 35000,
          ltv: 0.88,
          maxLtv: 0.95,
          taxes: 2100,
          fees: 499,
          gap: 0,
          warranty: 0,
          totalSalePrice: 40000,
        },
      },
      parties: {
        create: {
          role: "BUYER",
          firstName: "Jamie",
          lastName: "Close",
          address: "300 Oak, Austin TX",
          creditTier: "C",
        },
      },
      vehicle: {
        create: {
          year: 2021,
          make: "Ford",
          model: "F-150",
          vin: "CLOSVIN9876543210",
          mileage: 45000,
          condition: VehicleCondition.USED,
        },
      },
      financials: {
        create: {
          amountFinanced: "35000.00",
          ltv: "0.8800",
          maxLtv: "0.9500",
          taxes: "2100.00",
          fees: "499.00",
          gap: "0.00",
          warranty: "0.00",
          totalSalePrice: "40000.00",
        },
      },
    },
  });

  const closingAuth = await prisma.authoritativeContract.upsert({
    where: { dealId: closingDealId },
    update: {},
    create: {
      dealId: closingDealId,
      version: 1,
      contentHash: closingHash,
      governingLaw: "TX",
      signatureStatus: "EXECUTED_RISC",
      isTransferableRecord: true,
      uccCollateralDescription: {
        vin: "CLOSVIN9876543210",
        year: 2021,
        make: "Ford",
        model: "F-150",
      },
      uccDebtorName: "Jamie Close",
    },
  });

  await ensureDoc(
    closingDealId,
    DocumentType.RISC_LENDER_FINAL,
    GeneratedDocumentType.CONTRACT,
    `/mock-uploads/${closingDealId}/risc-lender-final-v1.pdf`,
    { securityAgreementPresent: true },
  );

  const closingInstrument = await ensureInstrument(closingDealId, lenderWorkspace.id);
  await ensureDoc(
    closingDealId,
    DocumentType.RISC_SIGNED,
    GeneratedDocumentType.CONTRACT,
    `/mock-uploads/${closingDealId}/risc-signed-v1.pdf`,
    {},
    closingAuth.id,
    closingHash,
  );
  await ensureDoc(
    closingDealId,
    DocumentType.UCSP_CLOSING_MANIFEST,
    GeneratedDocumentType.FUNDING_PACKET,
    `/mock-uploads/${closingDealId}/ucsp-closing-manifest-v1.json`,
    { sealed: true, authoritativeContractHash: closingHash },
    closingAuth.id,
    closingHash,
  );

  const hasClosingAssign = await prisma.contractTransactionEvent.findFirst({
    where: { dealId: closingDealId, eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER },
  });
  if (!hasClosingAssign) {
    const transfer = await ensureInstrumentTransfer(
      closingDealId,
      closingInstrument.id,
      workspace.id,
      lenderWorkspace.id,
      InstrumentTransferType.ENDORSEMENT,
      `Pay to the order of ${lenderWorkspace.id}.`,
    );
    await prisma.contractTransactionEvent.create({
      data: {
        dealId: closingDealId,
        eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER,
        fromEntityId: workspace.id,
        toEntityId: lenderWorkspace.id,
        considerationAmount: 35000,
        auditHash: crypto.createHash("sha256").update(`${closingDealId}|assign`).digest("hex"),
        instrumentTransferEventId: transfer.id,
      },
    });
  }

  const pooledDealId = "seed-deal-in-pool";
  await prisma.deal.upsert({
    where: { id: pooledDealId },
    update: {
      poolId,
      secondaryMarketStatus: SecondaryMarketStatus.SOLD,
    },
    create: {
      id: pooledDealId,
      dealerId: workspace.id,
      lenderId: lenderWorkspace.id,
      dealerLenderLinkId: link.id,
      poolId,
      status: DealStatus.CONSUMMATED,
      state: "TX",
      secondaryMarketStatus: SecondaryMarketStatus.SOLD,
      secondaryMarketGrade: "Prime",
      parties: {
        create: {
          role: "BUYER",
          firstName: "Pat",
          lastName: "Pooled",
          address: "400 Pool Ln, Austin TX",
          creditTier: "A",
        },
      },
      vehicle: {
        create: {
          year: 2023,
          make: "Subaru",
          model: "Outback",
          vin: "POOLVIN1234567890",
          mileage: 8000,
          condition: VehicleCondition.USED,
        },
      },
      financials: {
        create: {
          amountFinanced: "28000.00",
          ltv: "0.8000",
          maxLtv: "0.9500",
          taxes: "1800.00",
          fees: "350.00",
          gap: "0.00",
          warranty: "0.00",
          totalSalePrice: "32000.00",
        },
      },
    },
  });

  const poolAuthHash = crypto.createHash("sha256").update(`seed-pool-${pooledDealId}`).digest("hex");
  const poolAuth = await prisma.authoritativeContract.upsert({
    where: { dealId: pooledDealId },
    update: {},
    create: {
      dealId: pooledDealId,
      version: 1,
      contentHash: poolAuthHash,
      governingLaw: "TX",
      signatureStatus: "EXECUTED_RISC",
      isTransferableRecord: true,
      uccCollateralDescription: {
        vin: "POOLVIN1234567890",
        year: 2023,
        make: "Subaru",
        model: "Outback",
      },
      uccDebtorName: "Pat Pooled",
    },
  });

  await ensureDoc(
    pooledDealId,
    DocumentType.RISC_LENDER_FINAL,
    GeneratedDocumentType.CONTRACT,
    `/mock-uploads/${pooledDealId}/risc-lender-final-v1.pdf`,
    { securityAgreementPresent: true },
  );

  const pooledInstrument = await ensureInstrument(pooledDealId, lenderWorkspace.id);
  await ensureDoc(
    pooledDealId,
    DocumentType.RISC_SIGNED,
    GeneratedDocumentType.CONTRACT,
    `/mock-uploads/${pooledDealId}/risc-signed-v1.pdf`,
    {},
    poolAuth.id,
    poolAuthHash,
  );

  const hasPoolAssign = await prisma.contractTransactionEvent.findFirst({
    where: { dealId: pooledDealId, eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER },
  });
  if (!hasPoolAssign) {
    const transfer = await ensureInstrumentTransfer(
      pooledDealId,
      pooledInstrument.id,
      workspace.id,
      lenderWorkspace.id,
      InstrumentTransferType.ENDORSEMENT,
      `Pay to the order of ${lenderWorkspace.id}.`,
    );
    await prisma.contractTransactionEvent.create({
      data: {
        dealId: pooledDealId,
        eventType: ContractTransactionEventType.DEALER_ASSIGNMENT_TO_LENDER,
        fromEntityId: workspace.id,
        toEntityId: lenderWorkspace.id,
        considerationAmount: 28000,
        auditHash: crypto.createHash("sha256").update(`${pooledDealId}|assign`).digest("hex"),
        instrumentTransferEventId: transfer.id,
      },
    });
  }
  const hasPoolSale = await prisma.contractTransactionEvent.findFirst({
    where: { dealId: pooledDealId, eventType: ContractTransactionEventType.LENDER_SALE_TO_TRUST },
  });
  if (!hasPoolSale) {
    const transfer = await ensureInstrumentTransfer(
      pooledDealId,
      pooledInstrument.id,
      lenderWorkspace.id,
      poolId,
      InstrumentTransferType.SALE_WITHOUT_RECOURSE,
      `Pay to the order of ${poolId} WITHOUT RECOURSE.`,
    );
    await prisma.contractTransactionEvent.create({
      data: {
        dealId: pooledDealId,
        eventType: ContractTransactionEventType.LENDER_SALE_TO_TRUST,
        fromEntityId: lenderWorkspace.id,
        toEntityId: poolId,
        auditHash: crypto.createHash("sha256").update(`${pooledDealId}|pool`).digest("hex"),
        instrumentTransferEventId: transfer.id,
      },
    });
  }

  console.log("Seed complete:");
  console.log(`- Dealer workspace: ${workspace.name} (${workspace.id})`);
  console.log(`- Lender workspace: ${lenderWorkspace.name} (${lenderWorkspace.id})`);
  console.log(`- GREEN_STAGE demo deal id: ${greenDealId}`);
  console.log(`- AUTHORITATIVE_LOCK demo deal id: ${lockDealId}`);
  console.log(`- CLOSING_PACKAGE_READY demo deal id: ${closingDealId}`);
  console.log(`- Pooled / consummated demo deal id: ${pooledDealId}`);
  console.log(`- Loan pool id: ${poolId}`);
  console.log(`- Admin user: ${admin.email} (${admin.id})`);
  console.log(`- Standard user: ${standardUser.email} (${standardUser.id})`);
  console.log(`- Lender admin: ${lenderAdmin.email} — use for lender intake workflow`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
