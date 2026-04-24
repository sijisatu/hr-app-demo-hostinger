-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "maritalStatus" TEXT NOT NULL,
    "marriageDate" TEXT,
    "address" TEXT NOT NULL,
    "idCardNumber" TEXT NOT NULL,
    "education" TEXT NOT NULL,
    "workExperience" TEXT NOT NULL,
    "educationHistory" JSONB NOT NULL,
    "workExperiences" JSONB NOT NULL,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "joinDate" TEXT NOT NULL,
    "workLocation" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "managerName" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "contractStatus" TEXT NOT NULL,
    "contractStart" TEXT NOT NULL,
    "contractEnd" TEXT,
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "allowance" DECIMAL(18,2) NOT NULL,
    "positionSalaryId" TEXT,
    "financialComponentIds" TEXT[],
    "taxProfileId" TEXT,
    "taxProfile" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountMasked" TEXT NOT NULL,
    "appLoginEnabled" BOOLEAN NOT NULL DEFAULT false,
    "loginUsername" TEXT,
    "loginPassword" TEXT,
    "documents" JSONB NOT NULL,
    "leaveBalances" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AttendanceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "checkIn" TEXT NOT NULL,
    "checkOut" TEXT,
    "location" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "description" TEXT NOT NULL,
    "gpsValidated" BOOLEAN NOT NULL,
    "gpsDistanceMeters" DECIMAL(10,2) NOT NULL,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OvertimeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "approverFlow" TEXT[],
    "balanceLabel" TEXT NOT NULL,
    "requestedAt" TEXT NOT NULL,
    "daysRequested" DECIMAL(10,2) NOT NULL,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayrollComponent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "percentage" DECIMAL(8,4),
    "taxable" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL,
    "appliesToAll" BOOLEAN NOT NULL,
    "employeeIds" TEXT[],
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompensationProfile" (
    "id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaxProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PayRun" (
    "id" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "payDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalGross" DECIMAL(18,2) NOT NULL,
    "totalNet" DECIMAL(18,2) NOT NULL,
    "totalTax" DECIMAL(18,2) NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payslip" (
    "id" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "payDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "baseSalary" DECIMAL(18,2) NOT NULL,
    "allowance" DECIMAL(18,2) NOT NULL,
    "overtimePay" DECIMAL(18,2) NOT NULL,
    "additionalEarnings" DECIMAL(18,2) NOT NULL,
    "grossPay" DECIMAL(18,2) NOT NULL,
    "taxDeduction" DECIMAL(18,2) NOT NULL,
    "otherDeductions" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankAccountMasked" TEXT NOT NULL,
    "taxProfile" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "generatedFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReimbursementClaimType" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "subType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "annualLimit" DECIMAL(18,2) NOT NULL,
    "remainingBalance" DECIMAL(18,2) NOT NULL,
    "active" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReimbursementClaimType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReimbursementRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "claimTypeId" TEXT NOT NULL,
    "claimType" TEXT NOT NULL,
    "subType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "receiptDate" TEXT NOT NULL,
    "remarks" TEXT NOT NULL,
    "receiptFileName" TEXT,
    "receiptFileUrl" TEXT,
    "status" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approverFlow" TEXT[],
    "balanceSnapshot" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ReimbursementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "public"."Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_nik_key" ON "public"."Employee"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "public"."Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_idCardNumber_key" ON "public"."Employee"("idCardNumber");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "public"."Employee"("department");

-- CreateIndex
CREATE INDEX "Employee_role_idx" ON "public"."Employee"("role");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "public"."Employee"("status");

-- CreateIndex
CREATE INDEX "AttendanceLog_userId_idx" ON "public"."AttendanceLog"("userId");

-- CreateIndex
CREATE INDEX "AttendanceLog_timestamp_idx" ON "public"."AttendanceLog"("timestamp");

-- CreateIndex
CREATE INDEX "AttendanceLog_department_idx" ON "public"."AttendanceLog"("department");

-- CreateIndex
CREATE INDEX "OvertimeRequest_userId_idx" ON "public"."OvertimeRequest"("userId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_date_idx" ON "public"."OvertimeRequest"("date");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "public"."OvertimeRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "public"."LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "public"."LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "public"."LeaveRequest"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponent_code_key" ON "public"."PayrollComponent"("code");

-- CreateIndex
CREATE INDEX "CompensationProfile_position_idx" ON "public"."CompensationProfile"("position");

-- CreateIndex
CREATE UNIQUE INDEX "TaxProfile_name_key" ON "public"."TaxProfile"("name");

-- CreateIndex
CREATE INDEX "PayRun_periodStart_periodEnd_idx" ON "public"."PayRun"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PayRun_status_idx" ON "public"."PayRun"("status");

-- CreateIndex
CREATE INDEX "Payslip_userId_idx" ON "public"."Payslip"("userId");

-- CreateIndex
CREATE INDEX "Payslip_payRunId_idx" ON "public"."Payslip"("payRunId");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "public"."Payslip"("status");

-- CreateIndex
CREATE INDEX "ReimbursementClaimType_employeeId_idx" ON "public"."ReimbursementClaimType"("employeeId");

-- CreateIndex
CREATE INDEX "ReimbursementClaimType_category_idx" ON "public"."ReimbursementClaimType"("category");

-- CreateIndex
CREATE INDEX "ReimbursementClaimType_active_idx" ON "public"."ReimbursementClaimType"("active");

-- CreateIndex
CREATE INDEX "ReimbursementRequest_userId_idx" ON "public"."ReimbursementRequest"("userId");

-- CreateIndex
CREATE INDEX "ReimbursementRequest_claimTypeId_idx" ON "public"."ReimbursementRequest"("claimTypeId");

-- CreateIndex
CREATE INDEX "ReimbursementRequest_status_idx" ON "public"."ReimbursementRequest"("status");

-- AddForeignKey
ALTER TABLE "public"."AttendanceLog" ADD CONSTRAINT "AttendanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payslip" ADD CONSTRAINT "Payslip_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "public"."PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReimbursementClaimType" ADD CONSTRAINT "ReimbursementClaimType_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReimbursementRequest" ADD CONSTRAINT "ReimbursementRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReimbursementRequest" ADD CONSTRAINT "ReimbursementRequest_claimTypeId_fkey" FOREIGN KEY ("claimTypeId") REFERENCES "public"."ReimbursementClaimType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

