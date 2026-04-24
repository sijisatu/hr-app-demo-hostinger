-- Performance indexes for frequently filtered/sorted endpoints
CREATE INDEX IF NOT EXISTS "AttendanceLog_userId_timestamp_idx" ON "AttendanceLog"("userId", "timestamp");
CREATE INDEX IF NOT EXISTS "AttendanceLog_status_timestamp_idx" ON "AttendanceLog"("status", "timestamp");

CREATE INDEX IF NOT EXISTS "LeaveRequest_requestedAt_idx" ON "LeaveRequest"("requestedAt");
CREATE INDEX IF NOT EXISTS "LeaveRequest_userId_requestedAt_idx" ON "LeaveRequest"("userId", "requestedAt");

CREATE INDEX IF NOT EXISTS "PayRun_periodEnd_idx" ON "PayRun"("periodEnd");

CREATE INDEX IF NOT EXISTS "Payslip_payDate_idx" ON "Payslip"("payDate");
CREATE INDEX IF NOT EXISTS "Payslip_userId_payDate_idx" ON "Payslip"("userId", "payDate");

CREATE INDEX IF NOT EXISTS "ReimbursementClaimType_updatedAt_idx" ON "ReimbursementClaimType"("updatedAt");
CREATE INDEX IF NOT EXISTS "ReimbursementClaimType_employeeId_updatedAt_idx" ON "ReimbursementClaimType"("employeeId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ReimbursementRequest_updatedAt_idx" ON "ReimbursementRequest"("updatedAt");
CREATE INDEX IF NOT EXISTS "ReimbursementRequest_userId_updatedAt_idx" ON "ReimbursementRequest"("userId", "updatedAt");
