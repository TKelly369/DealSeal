# Merge Conflict Report

## Context
- Local work was committed, then merge was run.
- Merge produced conflicts in:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/records/[recordId]/page.tsx`
  - `apps/web/src/components/ConditionalLayout.tsx`
- `ConditionalLayout` conflict was SIMPLE and resolved by keeping equivalent record-route bypass logic.

## Complicated Conflicts

### 1) `apps/web/src/app/page.tsx`
- **What ours has:** Dashboard-style homepage listing demo governing records, includes "DealSeal is Live", links to `/records/demo-record-001`, and AI Compliance navigation.
- **What theirs has:** Marketing/production hero homepage with direct links to `/records/demo-record-001` and `/api/health`.
- **Why conflict exists:** Both branches changed the same root route component with different homepage architecture and UX intent.
- **Recommended resolution direction:** Keep dashboard implementation as primary (`ours`) while preserving key operational CTA from `theirs` only if needed as additive content.

### 2) `apps/web/src/app/records/[recordId]/page.tsx`
- **What ours has:** Full record detail workflow using `RecordDetailClient`, designed for certified rendering and non-authoritative generation flow.
- **What theirs has:** Minimal route-health/demo record page focused on basic record existence and static content.
- **Why conflict exists:** Both branches independently introduced the same route file with incompatible page responsibilities and component structures.
- **Recommended resolution direction:** Keep full certified rendering flow (`ours`) because it preserves required route and business behavior; merge any lightweight guard clauses from `theirs` only if still useful.
