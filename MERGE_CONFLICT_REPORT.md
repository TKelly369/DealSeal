# Merge Conflict Report

## Context
- `git fetch origin main` completed successfully.
- `git merge origin/main` aborted before merge/conflict generation.
- Blocking files reported by git:
  - Modified files would be overwritten: `apps/web/src/app/page.tsx`, `apps/web/src/components/ConditionalLayout.tsx`, `package.json`
  - Untracked file would be overwritten: `apps/web/src/app/records/[recordId]/page.tsx`
- No conflicted files were generated (`git diff --name-only --diff-filter=U` returned no output).

## Complicated Conflicts
No complicated conflicts were produced in this run because merge did not enter a conflict state.
