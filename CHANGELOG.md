# Changelog

## 2026-04-23
- Add operational activity logs UI, approval notifications, and supporting backend audit/session updates for HR and manager workflows.
- Continue production-readiness cleanup across attendance, employee, reimbursement, payroll, reporting, and authentication flows.
- Refresh the login experience with a cleaner themed layout, Pralux HR-App branding, and demo account access improvements.
- Add Help Center guide assets, downloadable PDF documentation, and fresh module screenshots for dashboard, employee management, and attendance workflows.

## 2026-04-22
- Stabilize local production-mode frontend auth, proxy routing, and POST forwarding so login/logout and form submissions work reliably again.
- Fix employee self-service data loading for attendance, leave balances, employee lookup, and newly created employee leave allocations.
- Restore asset and document lookup flow used by attendance evidence and employee document preview/download.
- Improve attendance quick action and modal behavior so clock-in/clock-out status refreshes correctly after submission.
- Replace legacy ESLint config with flat config to remove the circular configuration issue blocking lint/build workflows.
- Continue pre-production hardening across dashboard, reports, and session handling after recent regression fixes.

## 2026-04-02
- Initial HR app prototype.

## 2026-04-05
- Complete HRIS foundation and reporting modules.
- Add README app previews.

## 2026-04-08
- Unify employee attendance workspace.

## 2026-04-09
- Implement attendance request hub and compact dashboard.
- Update roadmap.
- Add system flow diagram.
- Add HR attendance reporting workspace.

## 2026-04-10
- Refine HR attendance and employee management.
- Improve employee list module.

## 2026-04-11
- Improve employee auth and attendance quick action.
- Update roadmap notes.
- Implement leave, attendance, HR dashboard, and service control updates.
- Remove stray backend artifacts.

## 2026-04-12
- Stabilize service control and improve mobile responsiveness.
- Revamp HR reports export flow and XLSX generation.
- Update roadmap.

## 2026-04-13
- Add reimbursement module with approvals and claim allocations.

## 2026-04-14
- Migrate app storage to PostgreSQL.
- Improve HR form actions and roadmap notes.

## 2026-04-15
- Polish production UI and mobile responsiveness.

## 2026-04-16
- Complete pre-production performance hardening (`C1`-`C6`) and update audit checklist.
- Implement server-side pagination/filtering for employees, attendance history, reimbursement requests, and payslips.
- Optimize database snapshot persistence from row-by-row upsert to batched transaction writes.
- Add async export worker queue with status polling for HR reports and payslip export.
- Enable backend response compression and endpoint cache-control strategy.
- Add production query indexes via Prisma schema + migration.
- Improve report and payroll export flow with async polling and stable `.xlsx` output.
- Fix employee login regression by preventing password wipe on employee profile update and restore affected account access.
- Harden manager approval scope by enforcing same-department + assigned-manager validation in leave/overtime approval flow.
- Replace payroll report export in HR Reports with reimbursement report dataset and Excel export.
- Add report period selector (`Current Period`, `Last Month`, `Last 3 Months`, `Year to Date`, `All Time`) and apply period filtering to preview + export.
- Add attendance date column to attendance report preview and exported Excel file.
- Complete observability & operations checklist (`E1`-`E5`): JSON request logging + correlation ID, metrics/alerts endpoint, liveness/readiness probes, production deployment blueprint, and CI quality gate workflow.
- Update pre-production audit document with completed checklist evidence and references.
