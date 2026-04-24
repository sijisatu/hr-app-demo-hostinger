# Backup & Restore Drill Plan

## Objective
- Keep recovery target clear before production go-live.
- Validate database backup and restore flow is runnable by any on-call engineer.

## Target
- `RPO`: 24 hours (maximum acceptable data loss).
- `RTO`: 2 hours (maximum acceptable service recovery time).

## Scope
- PostgreSQL application database only.
- Excludes local machine-level backup.

## Schedule
- Backup: daily (automated).
- Restore drill: bi-weekly on staging clone.
- Full recovery simulation: monthly.

## Execution Commands
- Backup:
  - `npm run db:backup` (run from `backend/`)
- Restore:
  - `npm run db:restore` (run from `backend/`)

## Restore Drill Checklist
1. Create fresh target database for drill environment.
2. Run latest backup restore using `db:restore`.
3. Run `npm run db:migrate:deploy` to ensure schema state is current.
4. Start API and run smoke test:
   - `npm run build`
   - `npm run start`
   - `npm run smoke:api`
5. Validate business-critical data samples:
   - employee count
   - latest attendance rows
   - latest reimbursement and payroll records
6. Record elapsed time and compare against RTO.

## Acceptance Criteria
- Restore completes without manual SQL edits.
- API health check returns success.
- Smoke test passes.
- Critical entity counts match backup source.
- Total recovery time is within `RTO <= 2 hours`.

## Evidence Template
- Drill date:
- Backup file:
- Operator:
- Restore duration:
- RTO met (`yes/no`):
- Data verification result:
- Follow-up actions:

