import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  BillableEventType,
  DocumentIngestStatus,
  DocumentType,
  PackageFormat,
  PackageJobStatus,
  RuleType,
  RuleSeverity,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Auditor-demo-1!", 12);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-dealer" },
    create: { name: "Demo Dealer", slug: "demo-dealer" },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.dealseal" },
    create: {
      email: "admin@demo.dealseal",
      passwordHash,
      displayName: "Demo Admin",
    },
    update: {},
  });

  const auditor = await prisma.user.upsert({
    where: { email: "auditor@demo.dealseal" },
    create: {
      email: "auditor@demo.dealseal",
      passwordHash,
      displayName: "Demo Auditor",
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    create: { userId: admin.id, orgId: org.id, roles: ["ADMIN"] },
    update: { roles: ["ADMIN"] },
  });

  const dealer = await prisma.user.upsert({
    where: { email: "dealer@demo.dealseal" },
    create: { email: "dealer@demo.dealseal", passwordHash, displayName: "Demo Dealer" },
    update: {},
  });
  const compliance = await prisma.user.upsert({
    where: { email: "compliance@demo.dealseal" },
    create: {
      email: "compliance@demo.dealseal",
      passwordHash,
      displayName: "Demo Compliance",
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: auditor.id, orgId: org.id } },
    create: { userId: auditor.id, orgId: org.id, roles: ["AUDITOR"] },
    update: { roles: ["AUDITOR"] },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: dealer.id, orgId: org.id } },
    create: { userId: dealer.id, orgId: org.id, roles: ["DEALER_USER"] },
    update: { roles: ["DEALER_USER"] },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: compliance.id, orgId: org.id } },
    create: { userId: compliance.id, orgId: org.id, roles: ["COMPLIANCE_OFFICER"] },
    update: { roles: ["COMPLIANCE_OFFICER"] },
  });

  await prisma.billingSubscription.upsert({
    where: { orgId: org.id },
    create: {
      orgId: org.id,
      tier: "PROFESSIONAL",
      status: "active",
    },
    update: { tier: "PROFESSIONAL", status: "active" },
  });

  const pLend = await prisma.integrationProvider.upsert({
    where: { key: "MOCK_LENDER" },
    create: {
      key: "MOCK_LENDER",
      name: "Mock Lender (demo)",
      category: "LENDER",
      configSchemaJson: {},
    },
    update: {},
  });
  await prisma.integrationProvider.upsert({
    where: { key: "MOCK_CREDIT" },
    create: { key: "MOCK_CREDIT", name: "Mock Credit", category: "CREDIT", configSchemaJson: {} },
    update: {},
  });
  await prisma.integrationProvider.upsert({
    where: { key: "MOCK_IDENTITY" },
    create: { key: "MOCK_IDENTITY", name: "Mock Identity", category: "IDENTITY", configSchemaJson: {} },
    update: {},
  });
  const hasInteg = await prisma.integrationConfig.findFirst({
    where: { orgId: org.id, name: "default-lender" },
  });
  if (!hasInteg) {
    await prisma.integrationConfig.create({
      data: {
        orgId: org.id,
        providerId: pLend.id,
        name: "default-lender",
        configJson: { demo: true },
        inboundSecret: "seed-inbound-secret-rotate-me",
      },
    });
  }

  const demoApiSecret = "dsk_seeddemopartnerkey00000000";
  const keyHash = createHash("sha256").update(demoApiSecret, "utf-8").digest("hex");
  const existingKey = await prisma.apiKey.findFirst({ where: { orgId: org.id, name: "seed-partner" } });
  if (!existingKey) {
    await prisma.apiKey.create({
      data: {
        orgId: org.id,
        name: "seed-partner",
        keyPrefix: demoApiSecret.slice(0, 12),
        keyHash,
        scopes: ["read:transactions", "read:packages", "read:status"],
        createdByUserId: admin.id,
      },
    });
  }

  await prisma.packageTemplate.upsert({
    where: { key: "default-v1" },
    create: {
      key: "default-v1",
      name: "Default export",
      description: "Deterministic manifest + JSON/XML/PDF outputs",
      specJson: { selection: "authoritative_first" },
      version: 1,
      active: true,
    },
    update: {},
  });

  const rMax = await prisma.rule.upsert({
    where: { ruleId: "DEMO-MAX-FINANCE" },
    create: {
      ruleId: "DEMO-MAX-FINANCE",
      ruleType: RuleType.FINANCIAL,
      conditionExpression: `{"kind":"max_finance","maxAmount":150000}`,
      evaluationOutput: {},
      severity: RuleSeverity.BLOCKING,
      overrideFlag: false,
      active: true,
    },
    update: {},
  });
  const rLend = await prisma.rule.upsert({
    where: { ruleId: "DEMO-LENDER-CODE" },
    create: {
      ruleId: "DEMO-LENDER-CODE",
      ruleType: RuleType.LENDER,
      conditionExpression: `{"kind":"lender_required","code":"DEMO-LND"}`,
      evaluationOutput: {},
      severity: RuleSeverity.CONDITIONAL,
      overrideFlag: true,
      active: true,
    },
    update: {},
  });

  const lender = await prisma.lender.upsert({
    where: { code: "DEMO-LND" },
    create: { code: "DEMO-LND", name: "Demo National Lender" },
    update: {},
  });
  const program = await prisma.lenderProgram.upsert({
    where: { lenderId_key: { lenderId: lender.id, key: "retail-2026" } },
    create: {
      lenderId: lender.id,
      key: "retail-2026",
      name: "Retail 2026",
      minAmountFinanced: 5000,
      maxAmountFinanced: 150000,
    },
    update: {},
  });
  const existingLpr = await prisma.lenderProgramRule.findFirst({
    where: { programId: program.id, ruleDbId: rMax.id },
  });
  if (!existingLpr) {
    await prisma.lenderProgramRule.create({
      data: { programId: program.id, ruleDbId: rMax.id, sortOrder: 0 },
    });
  }
  const existingLendRule = await prisma.lenderProgramRule.findFirst({
    where: { programId: program.id, ruleDbId: rLend.id },
  });
  if (!existingLendRule) {
    await prisma.lenderProgramRule.create({
      data: { programId: program.id, ruleDbId: rLend.id, sortOrder: 1 },
    });
  }
  if (
    (await prisma.lenderDocumentRequirement.count({ where: { programId: program.id } })) === 0
  ) {
    await prisma.lenderDocumentRequirement.create({
      data: {
        programId: program.id,
        documentType: DocumentType.SUPPORTING,
        required: true,
      },
    });
  }

  const tx = await prisma.transaction.create({
    data: {
      orgId: org.id,
      state: "YELLOW",
      selectedLenderProgramId: program.id,
    },
  });

  await prisma.governingAgreement.create({
    data: {
      transactionId: tx.id,
      referenceCode: `DEMO-${tx.id.slice(0, 8)}`,
      title: "Demo governing agreement",
    },
  });

  await prisma.transactionAuthorityFile.create({
    data: {
      transactionId: tx.id,
      manifestJson: { demo: true },
    },
  });

  const buyer = await prisma.buyerProfile.create({
    data: {
      transactionId: tx.id,
      legalName: "Jane Buyer",
      dob: new Date("1988-05-01"),
      addressJson: { line1: "1 Main St" },
      identifiersJson: { license: "X123" },
      version: 1,
    },
  });

  await prisma.buyerProfileVersion.create({
    data: {
      buyerProfileId: buyer.id,
      transactionId: tx.id,
      version: 1,
      legalName: buyer.legalName,
      dob: buyer.dob,
      addressJson: buyer.addressJson,
      identifiersJson: buyer.identifiersJson,
      fromVersion: null,
      sourceState: "DRAFT",
      materialChange: true,
      changeReason: "seed",
      diffJson: { initial: true },
      editorUserId: admin.id,
    },
  });

  const vehicle = await prisma.vehicleRecord.create({
    data: {
      transactionId: tx.id,
      vin: "DEMO1234567890123",
      year: 2023,
      make: "Demo",
      model: "Sedan",
      trim: "LX",
      mileage: 12000,
      rawJson: {},
      version: 1,
    },
  });

  await prisma.vehicleRecordVersion.create({
    data: {
      vehicleRecordId: vehicle.id,
      transactionId: tx.id,
      version: 1,
      vin: vehicle.vin,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      mileage: vehicle.mileage,
      rawJson: vehicle.rawJson,
      fromVersion: null,
      sourceState: "DRAFT",
      materialChange: true,
      changeReason: "seed",
      diffJson: { initial: true },
      editorUserId: admin.id,
    },
  });

  const financials = await prisma.dealFinancials.create({
    data: {
      transactionId: tx.id,
      amountFinanced: 25000,
      aprBps: 599,
      termMonths: 60,
      paymentJson: { monthly: 449 },
      lenderCode: "DEMO-LND",
      version: 1,
    },
  });

  await prisma.dealFinancialsVersion.create({
    data: {
      dealFinancialsId: financials.id,
      transactionId: tx.id,
      version: 1,
      amountFinanced: financials.amountFinanced,
      aprBps: financials.aprBps,
      termMonths: financials.termMonths,
      paymentJson: financials.paymentJson,
      lenderCode: financials.lenderCode,
      fromVersion: null,
      sourceState: "DRAFT",
      materialChange: true,
      changeReason: "seed",
      diffJson: { initial: true },
      editorUserId: admin.id,
    },
  });

  const doc = await prisma.document.create({
    data: {
      transactionId: tx.id,
      type: DocumentType.SUPPORTING,
      ingestStatus: DocumentIngestStatus.ACCEPTED,
    },
  });

  await prisma.documentVersion.create({
    data: {
      documentId: doc.id,
      version: 1,
      storageKey: `${org.id}/${tx.id}/documents/${doc.id}/seed`,
      mimeType: "application/pdf",
      byteSize: 128n,
      sha256: "a".repeat(64),
      isImmutable: false,
      authoritative: true,
      derivedRenderKey: `${org.id}/${tx.id}/documents/${doc.id}/seed#render-placeholder`,
    },
  });

  const pkgId = randomUUID();
  const pkg = await prisma.packageJob.create({
    data: {
      id: pkgId,
      transactionId: tx.id,
      formats: [PackageFormat.JSON],
      status: PackageJobStatus.SUCCEEDED,
      templateKey: "default-v1",
      outputKeys: [`${org.id}/${tx.id}/packages/${pkgId}/manifest.json`],
      manifestStorageKey: `${org.id}/${tx.id}/packages/${pkgId}/manifest.json`,
      bundleSha256: "b".repeat(64),
      requestedById: admin.id,
      completedAt: new Date(),
    },
  });

  await prisma.generatedPackage.create({
    data: {
      packageJobId: pkg.id,
      format: PackageFormat.JSON,
      storageKey: `${org.id}/${tx.id}/packages/${pkgId}/bundle.json`,
      byteSize: 256n,
      sha256: "c".repeat(64),
      manifestJson: { seeded: true },
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        organizationId: org.id,
        transactionId: tx.id,
        actorUserId: admin.id,
        eventType: "SEED",
        action: "SEED",
        entityType: "Transaction",
        entityId: tx.id,
        resource: "Transaction",
        resourceId: tx.id,
        payloadJson: { note: "seed data" },
      },
      {
        organizationId: org.id,
        transactionId: tx.id,
        actorUserId: auditor.id,
        eventType: "AUDIT_VIEW",
        action: "AUDIT_VIEW",
        entityType: "Transaction",
        entityId: tx.id,
        resource: "Transaction",
        resourceId: tx.id,
        payloadJson: { readOnly: true },
      },
    ],
  });

  const txG = await prisma.transaction.create({
    data: {
      orgId: org.id,
      state: "GREEN_STAGE_1",
      selectedLenderProgramId: program.id,
    },
  });
  await prisma.governingAgreement.create({
    data: {
      transactionId: txG.id,
      referenceCode: `DEMO-G-${txG.id.slice(0, 8)}`,
      title: "Green stage demo",
    },
  });
  await prisma.transactionAuthorityFile.create({
    data: { transactionId: txG.id, manifestJson: { demo: "green" } },
  });
  await prisma.buyerProfile.create({
    data: {
      transactionId: txG.id,
      legalName: "G Stage",
      addressJson: {},
      identifiersJson: {},
      version: 1,
    },
  });
  await prisma.vehicleRecord.create({
    data: { transactionId: txG.id, year: 2022, make: "X", model: "Y", rawJson: {}, version: 1 },
  });
  await prisma.dealFinancials.create({
    data: {
      transactionId: txG.id,
      amountFinanced: 18000,
      aprBps: 500,
      termMonths: 60,
      paymentJson: {},
      lenderCode: "DEMO-LND",
      version: 1,
    },
  });

  const txL = await prisma.transaction.create({
    data: {
      orgId: org.id,
      state: "LOCKED",
      selectedLenderProgramId: program.id,
    },
  });
  await prisma.governingAgreement.create({
    data: {
      transactionId: txL.id,
      referenceCode: `DEMO-LK-${txL.id.slice(0, 8)}`,
      title: "Locked + billing demo",
    },
  });
  await prisma.transactionAuthorityFile.create({
    data: { transactionId: txL.id, manifestJson: { demo: "locked" } },
  });
  const unit = 2.5;
  await prisma.usageEvent.create({
    data: {
      orgId: org.id,
      transactionId: txL.id,
      eventType: BillableEventType.DEAL_SEALED,
      quantity: 1,
      unitAmountUsd: unit,
      amountUsd: unit * 1,
      idempotencyKey: `seed:seal:${txL.id}`,
    },
  });
  await prisma.invoice.create({
    data: {
      orgId: org.id,
      status: "DRAFT",
      totalCents: Math.max(0, Math.round(unit * 100)),
      lines: {
        create: {
          description: "Sealed deal (seed)",
          amountCents: Math.max(0, Math.round(unit * 100)),
        },
      },
    },
  });
  await prisma.completionTask.create({
    data: {
      transactionId: txL.id,
      key: "seed:demo_blocker",
      title: "Resolve demo blocker (seed)",
      description: "A blocker task to verify protocol gating in UI",
      source: "STATE",
      isBlocker: true,
      assigneeRole: "COMPLIANCE_OFFICER",
      status: "PENDING",
    },
  });

  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const snapN = await prisma.analyticsSnapshot.count({ where: { orgId: org.id } });
  if (snapN === 0) {
    await prisma.analyticsSnapshot.create({
      data: {
        orgId: org.id,
        periodStart: from,
        periodEnd: to,
        metricsJson: { version: 1, seed: true, note: "Demo snapshot" },
      },
    });
  }

  console.log("Seed complete. Demo org slug: demo-dealer");
  console.log("Users: admin@demo.dealseal / auditor@demo.dealseal / dealer@demo.dealseal /");
  console.log("       compliance@demo.dealseal  —  password: Auditor-demo-1!");
  console.log("Transaction YELLOW:", tx.id, "| GREEN_STAGE_1:", txG.id, "| LOCKED:", txL.id);
  console.log("Lender", lender.code, "program", program.key);
  console.log("Partner API key (X-API-Key):", demoApiSecret);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
