-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DEALER_USER', 'FINANCE_MANAGER', 'COMPLIANCE_OFFICER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "TransactionState" AS ENUM ('DRAFT', 'INVALID', 'CONDITIONAL', 'APPROVED', 'EXECUTED', 'RED', 'YELLOW', 'GREEN_STAGE_1', 'EXECUTED_PENDING_VERIFICATION', 'LOCKED', 'POST_FUNDING_PENDING', 'COMPLETED', 'GREEN_STAGE_2', 'DISCREPANCY_RESTRICTED', 'HOLD', 'ARCHIVED', 'PURGED');

-- CreateEnum
CREATE TYPE "ContractLifecyclePhase" AS ENUM ('CANDIDATE', 'APPROVED', 'EXECUTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CANDIDATE_CONTRACT', 'EXECUTED_CONTRACT', 'SUPPORTING', 'PACKAGE_EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentIngestStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'CLASSIFIED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentUploadIntentStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('LENDER', 'JURISDICTION', 'FINANCIAL', 'SEQUENCING');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('INFO', 'CONDITIONAL', 'BLOCKING');

-- CreateEnum
CREATE TYPE "RuleEvalOutcome" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "DiscrepancyStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "OverrideStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HoldScope" AS ENUM ('TRANSACTION', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CompletionTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PostFundingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SATISFIED', 'WAIVED');

-- CreateEnum
CREATE TYPE "LenderRuleLineOutcome" AS ENUM ('PASS', 'FAIL', 'WARN', 'INFO');

-- CreateEnum
CREATE TYPE "ExecutedContractVerificationState" AS ENUM ('PENDING_UPLOAD', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ExecutionVerificationResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "PostFundingSeverity" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PackageFormat" AS ENUM ('JSON', 'XML', 'PDF_BUNDLE');

-- CreateEnum
CREATE TYPE "PackageJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillableEventType" AS ENUM ('DEAL_SEALED', 'DOCUMENT_EXPORT', 'CERTIFIED_PACKAGE', 'API_CALL', 'PRIORITY_PROCESSING', 'ANALYTICS_DASHBOARD', 'ANALYTICS_REPORT', 'ADDON_RISK_SCORING', 'ADDON_STRUCTURING', 'ADDON_ERROR_DETECTION', 'SUBSCRIPTION_PERIOD', 'SUBSCRIPTION_PLAN_ASSIGNED', 'PREMIUM_COMPLIANCE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roles" "UserRole"[],

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "state" "TransactionState" NOT NULL DEFAULT 'DRAFT',
    "lifecyclePhase" "ContractLifecyclePhase" NOT NULL DEFAULT 'CANDIDATE',
    "validationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "selectedLenderProgramId" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoverningAgreement" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "candidateVersion" INTEGER NOT NULL DEFAULT 1,
    "executedVersion" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoverningAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executed_contracts" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT,
    "governingCandidateVersion" INTEGER,
    "candidateReference" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "verifiedByUserId" TEXT,
    "verificationStatus" "ExecutedContractVerificationState" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "authoritative" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executed_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_verifications" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "executedContractId" TEXT NOT NULL,
    "candidateReference" TEXT NOT NULL,
    "comparedFieldsJson" JSONB NOT NULL DEFAULT '{}',
    "mismatchesJson" JSONB NOT NULL DEFAULT '[]',
    "result" "ExecutionVerificationResult" NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'RULES_ENGINE_V1',
    "actorUserId" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authoritative_embodiments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "executedContractId" TEXT NOT NULL,
    "representationType" TEXT NOT NULL DEFAULT 'STRUCTURED_DEALSEAL',
    "outputFormat" TEXT NOT NULL DEFAULT 'json',
    "storageKey" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "generatedByUserId" TEXT,
    "serviceName" TEXT NOT NULL DEFAULT 'authoritative-embodiment',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authoritative_embodiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_manifests" (
    "id" TEXT NOT NULL,
    "packageJobId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "packageTemplateId" TEXT,
    "packageType" TEXT NOT NULL,
    "includedRefsJson" JSONB NOT NULL DEFAULT '{}',
    "stateSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "manifestJson" JSONB NOT NULL DEFAULT '{}',
    "contentDigest" TEXT NOT NULL,
    "packageDigest" TEXT NOT NULL,
    "certificationStatement" TEXT NOT NULL DEFAULT '',
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_verifications" (
    "id" TEXT NOT NULL,
    "packageManifestId" TEXT NOT NULL,
    "verificationDigest" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'sha256+canonical-json',
    "detailsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAuthorityFile" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL DEFAULT '{}',
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionAuthorityFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "addressJson" JSONB NOT NULL DEFAULT '{}',
    "identifiersJson" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer_profile_versions" (
    "id" TEXT NOT NULL,
    "buyerProfileId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "legalName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "addressJson" JSONB NOT NULL DEFAULT '{}',
    "identifiersJson" JSONB NOT NULL DEFAULT '{}',
    "fromVersion" INTEGER,
    "sourceState" "TransactionState",
    "materialChange" BOOLEAN NOT NULL DEFAULT false,
    "changeReason" TEXT,
    "diffJson" JSONB NOT NULL DEFAULT '{}',
    "editorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyer_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRecord" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "vin" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "mileage" INTEGER,
    "rawJson" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_record_versions" (
    "id" TEXT NOT NULL,
    "vehicleRecordId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "vin" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "mileage" INTEGER,
    "rawJson" JSONB NOT NULL DEFAULT '{}',
    "fromVersion" INTEGER,
    "sourceState" "TransactionState",
    "materialChange" BOOLEAN NOT NULL DEFAULT false,
    "changeReason" TEXT,
    "diffJson" JSONB NOT NULL DEFAULT '{}',
    "editorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_record_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFinancials" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amountFinanced" DECIMAL(14,2) NOT NULL,
    "aprBps" INTEGER,
    "termMonths" INTEGER,
    "paymentJson" JSONB NOT NULL DEFAULT '{}',
    "lenderCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFinancials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_versions" (
    "id" TEXT NOT NULL,
    "dealFinancialsId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "amountFinanced" DECIMAL(14,2) NOT NULL,
    "aprBps" INTEGER,
    "termMonths" INTEGER,
    "paymentJson" JSONB NOT NULL DEFAULT '{}',
    "lenderCode" TEXT,
    "fromVersion" INTEGER,
    "sourceState" "TransactionState",
    "materialChange" BOOLEAN NOT NULL DEFAULT false,
    "changeReason" TEXT,
    "diffJson" JSONB NOT NULL DEFAULT '{}',
    "editorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "ingestStatus" "DocumentIngestStatus" NOT NULL DEFAULT 'UPLOADED',
    "requirementKey" TEXT,
    "lineageParentId" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "blurScore" DOUBLE PRECISION,
    "hasSignature" BOOLEAN,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentUploadIntent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "stagingKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "maxBytes" BIGINT NOT NULL,
    "sha256Declared" TEXT,
    "status" "DocumentUploadIntentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentUploadIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "authoritative" BOOLEAN NOT NULL DEFAULT false,
    "derivedRenderKey" TEXT,
    "parentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleType" "RuleType" NOT NULL,
    "conditionExpression" TEXT NOT NULL,
    "evaluationOutput" JSONB NOT NULL DEFAULT '{}',
    "overrideFlag" BOOLEAN NOT NULL DEFAULT false,
    "severity" "RuleSeverity" NOT NULL,
    "lenderCode" TEXT,
    "jurisdiction" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleEvaluation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "ruleDbId" TEXT NOT NULL,
    "outcome" "RuleEvalOutcome" NOT NULL,
    "detailJson" JSONB NOT NULL DEFAULT '{}',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateTransitionLog" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromState" "TransactionState",
    "toState" "TransactionState" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateTransitionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "transactionId" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discrepancy" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeUserId" TEXT,
    "resolutionJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Discrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverrideRecord" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "ruleId" TEXT,
    "status" "OverrideStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "OverrideRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "scope" "HoldScope" NOT NULL,
    "transactionId" TEXT,
    "orgId" TEXT,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "placedByUserId" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionTask" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "taskType" TEXT NOT NULL DEFAULT 'GENERAL',
    "source" TEXT NOT NULL DEFAULT 'STATE',
    "isBlocker" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "CompletionTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "assigneeRole" "UserRole",
    "dependsOnKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompletionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_templates" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "specJson" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageJob" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "formats" "PackageFormat"[],
    "status" "PackageJobStatus" NOT NULL DEFAULT 'QUEUED',
    "templateKey" TEXT NOT NULL DEFAULT 'default-v1',
    "outputKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "manifestStorageKey" TEXT,
    "bundleSha256" TEXT,
    "error" TEXT,
    "requestedById" TEXT NOT NULL,
    "packageKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "stateSnapshotJson" JSONB NOT NULL DEFAULT '{}',
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PackageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_packages" (
    "id" TEXT NOT NULL,
    "packageJobId" TEXT NOT NULL,
    "format" "PackageFormat" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostFundingItem" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "status" "PostFundingStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "PostFundingSeverity" NOT NULL DEFAULT 'NORMAL',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "assigneeRole" "UserRole",
    "completedByUserId" TEXT,
    "isBlocker" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "satisfiedAt" TIMESTAMP(3),
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostFundingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "eventType" "BillableEventType" NOT NULL,
    "unitAmountUsd" DECIMAL(10,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "transactionId" TEXT,
    "eventType" "BillableEventType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountUsd" DECIMAL(10,4) NOT NULL,
    "amountUsd" DECIMAL(12,4) NOT NULL,
    "idempotencyKey" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "stripeInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lender" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderProgram" (
    "id" TEXT NOT NULL,
    "lenderId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "minAmountFinanced" DECIMAL(14,2),
    "maxAmountFinanced" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LenderProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderProgramRule" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "ruleDbId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LenderProgramRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderDocumentRequirement" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LenderDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderRuleEvaluation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "lenderProgramId" TEXT NOT NULL,
    "ruleDbId" TEXT NOT NULL,
    "lineOutcome" "LenderRuleLineOutcome" NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "isOverrideable" BOOLEAN NOT NULL,
    "detailJson" JSONB NOT NULL DEFAULT '{}',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LenderRuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurgeJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL,
    "residualAuditRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PurgeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_providers" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "configSchemaJson" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "lenderId" TEXT,
    "name" TEXT NOT NULL,
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "inboundSecret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "transactionId" TEXT,
    "kind" TEXT NOT NULL,
    "requestSummaryJson" JSONB NOT NULL DEFAULT '{}',
    "responseSummaryJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metricsJson" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_publicId_key" ON "Transaction"("publicId");

-- CreateIndex
CREATE INDEX "Transaction_orgId_state_idx" ON "Transaction"("orgId", "state");

-- CreateIndex
CREATE INDEX "Transaction_publicId_idx" ON "Transaction"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "GoverningAgreement_transactionId_key" ON "GoverningAgreement"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "GoverningAgreement_referenceCode_key" ON "GoverningAgreement"("referenceCode");

-- CreateIndex
CREATE INDEX "executed_contracts_transactionId_verificationStatus_idx" ON "executed_contracts"("transactionId", "verificationStatus");

-- CreateIndex
CREATE INDEX "executed_contracts_documentId_idx" ON "executed_contracts"("documentId");

-- CreateIndex
CREATE INDEX "execution_verifications_transactionId_verifiedAt_idx" ON "execution_verifications"("transactionId", "verifiedAt");

-- CreateIndex
CREATE INDEX "execution_verifications_executedContractId_idx" ON "execution_verifications"("executedContractId");

-- CreateIndex
CREATE INDEX "authoritative_embodiments_transactionId_active_idx" ON "authoritative_embodiments"("transactionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "package_manifests_packageJobId_key" ON "package_manifests"("packageJobId");

-- CreateIndex
CREATE INDEX "package_manifests_transactionId_createdAt_idx" ON "package_manifests"("transactionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "package_verifications_packageManifestId_key" ON "package_verifications"("packageManifestId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionAuthorityFile_transactionId_key" ON "TransactionAuthorityFile"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerProfile_transactionId_key" ON "BuyerProfile"("transactionId");

-- CreateIndex
CREATE INDEX "buyer_profile_versions_transactionId_createdAt_idx" ON "buyer_profile_versions"("transactionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_profile_versions_buyerProfileId_version_key" ON "buyer_profile_versions"("buyerProfileId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleRecord_transactionId_key" ON "VehicleRecord"("transactionId");

-- CreateIndex
CREATE INDEX "vehicle_record_versions_transactionId_createdAt_idx" ON "vehicle_record_versions"("transactionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_record_versions_vehicleRecordId_version_key" ON "vehicle_record_versions"("vehicleRecordId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DealFinancials_transactionId_key" ON "DealFinancials"("transactionId");

-- CreateIndex
CREATE INDEX "financial_versions_transactionId_createdAt_idx" ON "financial_versions"("transactionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "financial_versions_dealFinancialsId_version_key" ON "financial_versions"("dealFinancialsId", "version");

-- CreateIndex
CREATE INDEX "Document_transactionId_type_idx" ON "Document"("transactionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentUploadIntent_stagingKey_key" ON "DocumentUploadIntent"("stagingKey");

-- CreateIndex
CREATE INDEX "DocumentUploadIntent_documentId_status_idx" ON "DocumentUploadIntent"("documentId", "status");

-- CreateIndex
CREATE INDEX "DocumentUploadIntent_transactionId_idx" ON "DocumentUploadIntent"("transactionId");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_sha256_idx" ON "DocumentVersion"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Rule_ruleId_key" ON "Rule"("ruleId");

-- CreateIndex
CREATE INDEX "RuleEvaluation_transactionId_idx" ON "RuleEvaluation"("transactionId");

-- CreateIndex
CREATE INDEX "StateTransitionLog_transactionId_createdAt_idx" ON "StateTransitionLog"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "Discrepancy_transactionId_status_idx" ON "Discrepancy"("transactionId", "status");

-- CreateIndex
CREATE INDEX "OverrideRecord_transactionId_status_idx" ON "OverrideRecord"("transactionId", "status");

-- CreateIndex
CREATE INDEX "Hold_transactionId_active_idx" ON "Hold"("transactionId", "active");

-- CreateIndex
CREATE INDEX "Hold_orgId_active_idx" ON "Hold"("orgId", "active");

-- CreateIndex
CREATE INDEX "CompletionTask_transactionId_isBlocker_status_idx" ON "CompletionTask"("transactionId", "isBlocker", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompletionTask_transactionId_key_key" ON "CompletionTask"("transactionId", "key");

-- CreateIndex
CREATE INDEX "package_templates_orgId_active_idx" ON "package_templates"("orgId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "package_templates_key_key" ON "package_templates"("key");

-- CreateIndex
CREATE INDEX "PackageJob_transactionId_idx" ON "PackageJob"("transactionId");

-- CreateIndex
CREATE INDEX "generated_packages_packageJobId_idx" ON "generated_packages"("packageJobId");

-- CreateIndex
CREATE INDEX "PostFundingItem_transactionId_status_idx" ON "PostFundingItem"("transactionId", "status");

-- CreateIndex
CREATE INDEX "PostFundingItem_transactionId_isBlocker_status_idx" ON "PostFundingItem"("transactionId", "isBlocker", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_orgId_key" ON "BillingSubscription"("orgId");

-- CreateIndex
CREATE INDEX "PricingRule_orgId_eventType_active_idx" ON "PricingRule"("orgId", "eventType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEvent_orgId_recordedAt_idx" ON "UsageEvent"("orgId", "recordedAt");

-- CreateIndex
CREATE INDEX "UsageEvent_transactionId_recordedAt_idx" ON "UsageEvent"("transactionId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_orgId_status_idx" ON "Invoice"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Lender_code_key" ON "Lender"("code");

-- CreateIndex
CREATE INDEX "LenderProgram_lenderId_active_idx" ON "LenderProgram"("lenderId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LenderProgram_lenderId_key_key" ON "LenderProgram"("lenderId", "key");

-- CreateIndex
CREATE INDEX "LenderProgramRule_programId_sortOrder_idx" ON "LenderProgramRule"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "LenderProgramRule_ruleDbId_idx" ON "LenderProgramRule"("ruleDbId");

-- CreateIndex
CREATE INDEX "LenderDocumentRequirement_programId_idx" ON "LenderDocumentRequirement"("programId");

-- CreateIndex
CREATE INDEX "LenderRuleEvaluation_transactionId_evaluatedAt_idx" ON "LenderRuleEvaluation"("transactionId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "LenderRuleEvaluation_runId_idx" ON "LenderRuleEvaluation"("runId");

-- CreateIndex
CREATE INDEX "LenderRuleEvaluation_lenderProgramId_evaluatedAt_idx" ON "LenderRuleEvaluation"("lenderProgramId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "LenderRuleEvaluation_orgId_evaluatedAt_idx" ON "LenderRuleEvaluation"("orgId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "PurgeJob_orgId_idx" ON "PurgeJob"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_providers_key_key" ON "integration_providers"("key");

-- CreateIndex
CREATE INDEX "integration_providers_category_active_idx" ON "integration_providers"("category", "active");

-- CreateIndex
CREATE INDEX "integration_configs_orgId_active_idx" ON "integration_configs"("orgId", "active");

-- CreateIndex
CREATE INDEX "integration_logs_configId_createdAt_idx" ON "integration_logs"("configId", "createdAt");

-- CreateIndex
CREATE INDEX "integration_logs_transactionId_createdAt_idx" ON "integration_logs"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_snapshots_orgId_periodStart_idx" ON "analytics_snapshots"("orgId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_orgId_active_idx" ON "api_keys"("orgId", "active");

-- CreateIndex
CREATE INDEX "api_usage_logs_orgId_recordedAt_idx" ON "api_usage_logs"("orgId", "recordedAt");

-- CreateIndex
CREATE INDEX "api_usage_logs_apiKeyId_recordedAt_idx" ON "api_usage_logs"("apiKeyId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_selectedLenderProgramId_fkey" FOREIGN KEY ("selectedLenderProgramId") REFERENCES "LenderProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoverningAgreement" ADD CONSTRAINT "GoverningAgreement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_contracts" ADD CONSTRAINT "executed_contracts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_contracts" ADD CONSTRAINT "executed_contracts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executed_contracts" ADD CONSTRAINT "executed_contracts_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_verifications" ADD CONSTRAINT "execution_verifications_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_verifications" ADD CONSTRAINT "execution_verifications_executedContractId_fkey" FOREIGN KEY ("executedContractId") REFERENCES "executed_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authoritative_embodiments" ADD CONSTRAINT "authoritative_embodiments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authoritative_embodiments" ADD CONSTRAINT "authoritative_embodiments_executedContractId_fkey" FOREIGN KEY ("executedContractId") REFERENCES "executed_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_manifests" ADD CONSTRAINT "package_manifests_packageJobId_fkey" FOREIGN KEY ("packageJobId") REFERENCES "PackageJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_manifests" ADD CONSTRAINT "package_manifests_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_verifications" ADD CONSTRAINT "package_verifications_packageManifestId_fkey" FOREIGN KEY ("packageManifestId") REFERENCES "package_manifests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuthorityFile" ADD CONSTRAINT "TransactionAuthorityFile_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_profile_versions" ADD CONSTRAINT "buyer_profile_versions_buyerProfileId_fkey" FOREIGN KEY ("buyerProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRecord" ADD CONSTRAINT "VehicleRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_record_versions" ADD CONSTRAINT "vehicle_record_versions_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "VehicleRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealFinancials" ADD CONSTRAINT "DealFinancials_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_versions" ADD CONSTRAINT "financial_versions_dealFinancialsId_fkey" FOREIGN KEY ("dealFinancialsId") REFERENCES "DealFinancials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentUploadIntent" ADD CONSTRAINT "DocumentUploadIntent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleEvaluation" ADD CONSTRAINT "RuleEvaluation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleEvaluation" ADD CONSTRAINT "RuleEvaluation_ruleDbId_fkey" FOREIGN KEY ("ruleDbId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateTransitionLog" ADD CONSTRAINT "StateTransitionLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discrepancy" ADD CONSTRAINT "Discrepancy_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverrideRecord" ADD CONSTRAINT "OverrideRecord_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionTask" ADD CONSTRAINT "CompletionTask_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_templates" ADD CONSTRAINT "package_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageJob" ADD CONSTRAINT "PackageJob_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_packages" ADD CONSTRAINT "generated_packages_packageJobId_fkey" FOREIGN KEY ("packageJobId") REFERENCES "PackageJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostFundingItem" ADD CONSTRAINT "PostFundingItem_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderProgram" ADD CONSTRAINT "LenderProgram_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "Lender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderProgramRule" ADD CONSTRAINT "LenderProgramRule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LenderProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderProgramRule" ADD CONSTRAINT "LenderProgramRule_ruleDbId_fkey" FOREIGN KEY ("ruleDbId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderDocumentRequirement" ADD CONSTRAINT "LenderDocumentRequirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LenderProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderRuleEvaluation" ADD CONSTRAINT "LenderRuleEvaluation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderRuleEvaluation" ADD CONSTRAINT "LenderRuleEvaluation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderRuleEvaluation" ADD CONSTRAINT "LenderRuleEvaluation_lenderProgramId_fkey" FOREIGN KEY ("lenderProgramId") REFERENCES "LenderProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderRuleEvaluation" ADD CONSTRAINT "LenderRuleEvaluation_ruleDbId_fkey" FOREIGN KEY ("ruleDbId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurgeJob" ADD CONSTRAINT "PurgeJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "integration_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_configId_fkey" FOREIGN KEY ("configId") REFERENCES "integration_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_logs" ADD CONSTRAINT "integration_logs_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
