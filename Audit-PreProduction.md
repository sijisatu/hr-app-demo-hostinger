# Audit Pre-Production Checklist

Tanggal audit awal: 2026-04-15  
Scope: Frontend (`Next.js`), Backend (`NestJS + Prisma`), auth/session, upload, export, DB schema, dependency, operasional aplikasi.
Out of scope: konfigurasi/health machine lokal (laptop dev), service OS lokal, dan issue environment spesifik device.

## Ringkasan Risiko Saat Ini
- `P0 (Blocker)`: 6 item
- `P1 (High)`: 10 item
- `P2 (Medium)`: 8 item
- `P3 (Low)`: 4 item

Status saat ini: **Checklist only (belum fixing)**.

## A. Security Checklist
- [x] `A1` `P0` Terapkan autentikasi backend berbasis token/session yang tervalidasi untuk semua endpoint sensitif.
  Evidence: [backend/src/common/authz.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/authz.ts), [backend/src/common/session-token.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/session-token.ts), [backend/src/app.module.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.module.ts).
- [x] `A2` `P0` Terapkan otorisasi berbasis role di backend (RBAC), jangan hanya di frontend.
  Evidence: [backend/src/common/authz.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/authz.ts), [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) menggunakan `@Roles(...)` pada endpoint mutasi.
- [x] `A3` `P0` Hardening cookie session: `httpOnly=true`, `secure=true`, signed/encrypted cookie/JWT.
  Evidence: [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts), [app/api/auth/logout/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/logout/route.ts), [lib/auth-config.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/auth-config.ts).
- [ ] `A4` `P0` Hilangkan mekanisme login demo/backdoor di production.
  Evidence: [lib/auth-config.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/auth-config.ts) menyimpan `demoUsers`, [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts) menerima `sessionKey`.
- [x] `A5` `P0` Tutup open-redirect pada endpoint login GET.
  Evidence: [app/api/auth/login/route.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/app/api/auth/login/route.ts) `sanitizeRedirectPath()` membatasi redirect internal path saja.
- [x] `A6` `P0` Batasi eksposur file private (selfie attendance, receipt reimbursement, dokumen karyawan).
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) blok akses publik ke `/storage/attendance-selfies`, `/storage/reimbursements/receipts`, dan `/storage/documents/employee-files`.

- [x] `A7` `P1` Lockdown CORS per domain origin production (bukan `cors: true`).
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) memakai allowlist `CORS_ORIGINS` + `credentials`.
- [x] `A8` `P1` Tambahkan rate-limit khusus login + endpoint write-heavy.
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) `rateLimit` untuk `/api/auth/employee-login` dan mutasi `/api`.
- [x] `A9` `P1` Tambahkan proteksi upload: `fileFilter`, `limits.fileSize`, validasi MIME + ekstensi, malware scan hook.
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) `FileInterceptor` sudah pakai `fileFilter` + `limits.fileSize`.
- [x] `A10` `P1` Sanitasi nama file export terhadap path traversal.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `safeFileBaseName()` untuk report/payslip filename.
- [x] `A11` `P1` Wajibkan HTTPS end-to-end dan HSTS di production.
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) enforce `x-forwarded-proto=https` di production, [next.config.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/next.config.ts) HSTS header.
- [x] `A12` `P1` Tambahkan security headers (`helmet`, CSP, X-Frame-Options, Referrer-Policy).
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) `helmet`, [next.config.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/next.config.ts) CSP + headers.
- [ ] `A13` `P1` Ganti default credential DB sample sebelum deploy.
  Evidence: [backend/.env.example](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/.env.example) gunakan `postgres:postgres`.
- [x] `A14` `P1` Buat audit logging untuk aksi sensitif (approve/reject payroll/reimbursement, perubahan employee).
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `writeAuditLog()` untuk aksi employee/overtime/leave/reimbursement/payroll.

## B. Dependency & Supply Chain Checklist
- [x] `B1` `P0` Upgrade `next` ke versi patched (audit temukan `high` DoS).
  Evidence: [package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/package.json) `next@15.5.15`, hasil `npm audit --omit=dev` root: 0 vulnerability.
- [x] `B2` `P1` Upgrade `multer` ke versi aman (`>=2.1.1`) + review compatibility.
  Evidence: [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json) `multer@2.1.1`, hasil `npm audit --omit=dev` backend: 0 vulnerability.
- [x] `B3` `P1` Upgrade stack NestJS (`@nestjs/core`, `@nestjs/platform-express`, `@nestjs/common`) sesuai advisori.
  Evidence: [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json) `@nestjs/common/core/platform-express@11.1.19`.
- [x] `B4` `P1` Upgrade Prisma (`prisma`, `@prisma/config`) ke versi patched.
  Evidence: [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json) `prisma@6.19.3` + `@prisma/client@6.19.3`.
- [x] `B5` `P1` Evaluasi/ganti `xlsx` library (ada advisory high tanpa fix available di versi saat ini).
  Evidence: [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json) migrasi ke `exceljs`, implementasi export di [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts).
- [x] `B6` `P2` Tambahkan dependency scanning di CI (fail build pada severity threshold).
  Evidence: workflow [dependency-audit.yml](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/.github/workflows/dependency-audit.yml) dengan `npm audit --audit-level=high` untuk root dan backend.

## C. Performance Checklist
- [x] `C1` `P1` Implement pagination/filtering server-side untuk list besar (`employees`, `attendance`, `reimbursement`, `payslips`).
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts), [backend/src/common/dtos.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/dtos.ts), [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts), [lib/api.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/api.ts), [lib/payroll.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/payroll.ts).
- [x] `C2` `P1` Optimasi persist DB: hindari `upsert` satu per satu dalam loop besar, gunakan batch strategy.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `persistSnapshotToDatabase()` sudah pakai `deleteMany + createMany` batched transaction.
- [x] `C3` `P1` Pisahkan job berat (export/generate report) ke async worker queue.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) `enqueueExportJob()/processExportQueue()`, [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) endpoint status job, [lib/reporting.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/reporting.ts), [lib/payroll.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/lib/payroll.ts) polling status.
- [x] `C4` `P2` Tambahkan response compression di backend.
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts), [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json).
- [x] `C5` `P2` Definisikan caching strategy (server/API/browser) untuk endpoint read-only.
  Evidence: [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) `setShortCache()/setNoStore()` diterapkan per endpoint.
- [x] `C6` `P2` Tambahkan index query sesuai pola filter real production (cek dengan EXPLAIN ANALYZE).
  Evidence: [backend/prisma/schema.prisma](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/schema.prisma), [backend/prisma/migrations/20260416093000_performance_indexes/migration.sql](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/migrations/20260416093000_performance_indexes/migration.sql).

## D. Reliability & Data Integrity Checklist
- [x] `D1` `P1` Ganti field tanggal/jam kritis dari `String` ke tipe date/time native DB.
  Evidence: [backend/prisma/schema.prisma](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/schema.prisma) kolom kritis sudah `DateTime` (`Employee`, `AttendanceLog`, `OvertimeRequest`, `LeaveRequest`, `PayRun`, `Payslip`, `ReimbursementRequest`), migration [20260416170000_datetime_refactor_d1/migration.sql](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/prisma/migrations/20260416170000_datetime_refactor_d1/migration.sql), adapter baca/tulis di [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts).
- [x] `D2` `P1` Tambahkan idempotency guard untuk endpoint aksi mutable (approve/publish/generate).
  Evidence: [backend/src/common/idempotency.interceptor.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/idempotency.interceptor.ts), diterapkan pada endpoint approve/publish/generate/export di [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts).
- [x] `D3` `P1` Tambahkan global exception filter + error contract konsisten (`4xx/5xx`) untuk observability klien.
  Evidence: [backend/src/common/api-exception.filter.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/api-exception.filter.ts), diregistrasi di [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts).
- [x] `D4` `P2` Pisahkan data seed/demo dari runtime production bootstrap.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts) menambahkan `BOOTSTRAP_DEMO_DATA` gate + empty snapshot bootstrap untuk non-demo runtime, [backend/.env.example](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/.env.example).
- [x] `D5` `P2` Rancang backup/restore drill berkala + RPO/RTO target.
  Evidence: runbook [docs/backup-restore-drill.md](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/docs/backup-restore-drill.md), memanfaatkan script [backend/scripts/db-backup.ps1](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/scripts/db-backup.ps1) dan [backend/scripts/db-restore.ps1](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/scripts/db-restore.ps1).
- [x] `D6` `P2` Tambahkan migration verification gate sebelum release (`prisma migrate deploy` + smoke test).
  Evidence: workflow [migration-verification.yml](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/.github/workflows/migration-verification.yml), smoke script [backend/scripts/smoke-api.js](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/scripts/smoke-api.js), script `smoke:api` di [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json).

## E. Observability & Operations Checklist
- [x] `E1` `P1` Structured logging (JSON), correlation ID, dan request logging middleware.
  Evidence: [backend/src/main.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/main.ts) menambahkan middleware request logging JSON + `X-Request-Id` correlation ID.
- [x] `E2` `P1` Metrics + alerting (latency, error rate, DB connection, queue depth).
  Evidence: [backend/src/common/metrics.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/metrics.service.ts), endpoint [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) `GET /api/ops/metrics`, queue metric [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts), threshold env [backend/.env.example](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/.env.example).
- [x] `E3` `P2` Readiness/liveness probe terpisah untuk deployment orchestration.
  Evidence: endpoint [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts) `GET /api/health/live` dan `GET /api/health/ready`.
- [x] `E4` `P2` Buat deployment blueprint production (reverse proxy, TLS, secret injection, env matrix).
  Evidence: runbook [docs/deployment-blueprint-production.md](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/docs/deployment-blueprint-production.md).
- [x] `E5` `P2` Siapkan CI/CD minimum: lint, typecheck, audit, test, build, migrate check.
  Evidence: workflow [ci-quality.yml](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/.github/workflows/ci-quality.yml), script lint/test/typecheck di [package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/package.json) dan [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json).

## F. Quality Assurance Checklist
- [x] `F1` `P0` Buat automated test minimal untuk alur kritis: auth login, check-in/out, payroll run, reimbursement submit-approve-process.
  Evidence: [backend/scripts/test-critical-flows.js](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/scripts/test-critical-flows.js), [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json).
- [x] `F2` `P1` Tambahkan integration test API untuk validasi role access dan constraint bisnis.
  Evidence: [backend/scripts/test-role-access.js](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/scripts/test-role-access.js), [backend/package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/package.json).
- [x] `F3` `P1` Tambahkan E2E smoke test frontend (login per role, dashboard, flow utama).
  Evidence: [scripts/smoke-frontend.js](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/scripts/smoke-frontend.js), [package.json](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/package.json), [ci-quality.yml](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/.github/workflows/ci-quality.yml).
- [x] `F4` `P2` Tetapkan performance baseline (p95 endpoint utama + target SLA).
  Evidence: [docs/performance-baseline.md](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/docs/performance-baseline.md).

## G. Compliance & Privacy Checklist
- [x] `G1` `P1` Data classification & retention policy untuk PII/financial/biometric-like media (selfie, receipt).
  Evidence: [docs/data-privacy-governance.md](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/docs/data-privacy-governance.md), [backend/.env.example](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/.env.example).
- [x] `G2` `P1` Access control untuk dokumen sensitif per role dan per owner.
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts), [backend/src/app.controller.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/app.controller.ts), [backend/src/common/authz.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/authz.ts).
- [x] `G3` `P2` Audit trail immutable untuk approval chain (manager/HR/payroll).
  Evidence: [backend/src/common/app.service.ts](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/backend/src/common/app.service.ts), [docs/approval-audit-trail.md](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/docs/approval-audit-trail.md).
- [x] `G4` `P2` Consent/notice policy untuk penyimpanan dokumen personal.
  Evidence: [docs/data-privacy-governance.md](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/docs/data-privacy-governance.md), [components/providers/attendance-modal-provider.tsx](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/components/providers/attendance-modal-provider.tsx), [components/reimbursement/reimbursement-workspace.tsx](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/components/reimbursement/reimbursement-workspace.tsx), [components/employees/employee-management-workspace.tsx](/d:/Projek%20Sampingan/Praluxstd/Aplikasi%20Absensi/Project%20File%20Absensi/components/employees/employee-management-workspace.tsx).

---

## Urutan Eksekusi Rekomendasi (Sprint Fix)
1. `P0 Security`: auth backend + RBAC + cookie hardening + matikan demo login + tutup open redirect + proteksi file private.
2. `P0/P1 Dependency`: upgrade paket high risk (`next`, `multer`, NestJS, Prisma) + mitigasi `xlsx`.
3. `P1 Reliability`: refactor date/time schema + error handling + idempotency.
4. `P1/P2 Performance`: pagination, batch write, caching/compression, async jobs export.
5. `P1/P2 Ops & QA`: logging/metrics/alerts + CI/CD + automated tests.
