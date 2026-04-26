# DealSeal AI Infrastructure Layer (v1)

This module provides deterministic, auditable AI compliance orchestration for:

- lender and dealer onboarding intake normalization
- state-law requirement resolution
- contract package generation planning
- authoritative governing record chain-of-custody enforcement guidance

This is not a chatbot surface and does not produce free-form legal text.  
All outputs are structured JSON suitable for workflow engines, audit logs, and downstream document generation.

## API Routes

- `POST /api/ai/onboarding`
  - validates onboarding intake
  - returns full compliance evaluation and package planning output

- `POST /api/ai/contract-compliance`
  - returns a compliance-focused projection of onboarding output
  - includes decision, gates, required forms/disclosures, prohibited clauses,
    authoritative record plan, package plan, and audit metadata

## Determinism and auditability

- evaluation IDs are SHA-256 deterministic hashes over constrained metadata
- requirements come from a versioned state-law rule pack
- responses include:
  - `engineVersion`
  - `rulePackVersion`
  - `generatedAt`
  - `evaluationId`

## Safety posture

- no external model calls
- no persistence side effects
- no mutation of governing records
- strict typed request parsing and validation
