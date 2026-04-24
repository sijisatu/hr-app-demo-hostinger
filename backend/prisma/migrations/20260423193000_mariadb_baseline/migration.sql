-- MariaDB baseline created after replacing PostgreSQL-only scalar arrays with JSON fields.

CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `employeeNumber` VARCHAR(191) NOT NULL,
    `nik` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `birthPlace` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NOT NULL,
    `gender` VARCHAR(191) NOT NULL,
    `maritalStatus` VARCHAR(191) NOT NULL,
    `marriageDate` DATETIME(3) NULL,
    `address` VARCHAR(191) NOT NULL,
    `idCardNumber` VARCHAR(191) NOT NULL,
    `education` VARCHAR(191) NOT NULL,
    `workExperience` VARCHAR(191) NOT NULL,
    `educationHistory` JSON NOT NULL,
    `workExperiences` JSON NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `joinDate` DATETIME(3) NOT NULL,
    `workLocation` VARCHAR(191) NOT NULL,
    `workType` VARCHAR(191) NOT NULL,
    `managerName` VARCHAR(191) NOT NULL,
    `employmentType` VARCHAR(191) NOT NULL,
    `contractStatus` VARCHAR(191) NOT NULL,
    `contractStart` DATETIME(3) NOT NULL,
    `contractEnd` DATETIME(3) NULL,
    `baseSalary` DECIMAL(18, 2) NOT NULL,
    `allowance` DECIMAL(18, 2) NOT NULL,
    `positionSalaryId` VARCHAR(191) NULL,
    `financialComponentIds` JSON NOT NULL,
    `taxProfileId` VARCHAR(191) NULL,
    `taxProfile` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `bankAccountMasked` VARCHAR(191) NOT NULL,
    `appLoginEnabled` BOOLEAN NOT NULL DEFAULT false,
    `loginUsername` VARCHAR(191) NULL,
    `loginPassword` VARCHAR(191) NULL,
    `documents` JSON NOT NULL,
    `leaveBalances` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_employeeNumber_key`(`employeeNumber`),
    UNIQUE INDEX `Employee_nik_key`(`nik`),
    UNIQUE INDEX `Employee_email_key`(`email`),
    UNIQUE INDEX `Employee_idCardNumber_key`(`idCardNumber`),
    INDEX `Employee_department_idx`(`department`),
    INDEX `Employee_role_idx`(`role`),
    INDEX `Employee_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AppSession` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sessionKey` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` VARCHAR(191) NULL,

    INDEX `AppSession_userId_revokedAt_lastActivityAt_idx`(`userId`, `revokedAt`, `lastActivityAt`),
    INDEX `AppSession_expiresAt_idx`(`expiresAt`),
    INDEX `AppSession_sessionKey_idx`(`sessionKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `actorName` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `actorDepartment` VARCHAR(191) NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `targetLabel` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NOT NULL,
    `beforeData` JSON NULL,
    `afterData` JSON NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_module_occurredAt_idx`(`module`, `occurredAt`),
    INDEX `AuditLog_actorUserId_occurredAt_idx`(`actorUserId`, `occurredAt`),
    INDEX `AuditLog_targetType_targetId_occurredAt_idx`(`targetType`, `targetId`, `occurredAt`),
    INDEX `AuditLog_eventKey_occurredAt_idx`(`eventKey`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Department_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AttendanceLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `checkIn` VARCHAR(191) NOT NULL,
    `checkOut` VARCHAR(191) NULL,
    `location` VARCHAR(191) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `gpsValidated` BOOLEAN NOT NULL,
    `gpsDistanceMeters` DECIMAL(10, 2) NOT NULL,
    `photoUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `overtimeMinutes` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceLog_userId_idx`(`userId`),
    INDEX `AttendanceLog_timestamp_idx`(`timestamp`),
    INDEX `AttendanceLog_department_idx`(`department`),
    INDEX `AttendanceLog_userId_timestamp_idx`(`userId`, `timestamp`),
    INDEX `AttendanceLog_status_timestamp_idx`(`status`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OvertimeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `minutes` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OvertimeRequest_userId_idx`(`userId`),
    INDEX `OvertimeRequest_date_idx`(`date`),
    INDEX `OvertimeRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LeaveRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `approverFlow` JSON NOT NULL,
    `balanceLabel` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL,
    `daysRequested` DECIMAL(10, 2) NOT NULL,
    `autoApproved` BOOLEAN NOT NULL DEFAULT false,
    `supportingDocumentName` VARCHAR(191) NULL,
    `supportingDocumentUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeaveRequest_userId_idx`(`userId`),
    INDEX `LeaveRequest_status_idx`(`status`),
    INDEX `LeaveRequest_startDate_idx`(`startDate`),
    INDEX `LeaveRequest_requestedAt_idx`(`requestedAt`),
    INDEX `LeaveRequest_userId_requestedAt_idx`(`userId`, `requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayrollComponent` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `calculationType` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `percentage` DECIMAL(8, 4) NULL,
    `taxable` BOOLEAN NOT NULL,
    `active` BOOLEAN NOT NULL,
    `appliesToAll` BOOLEAN NOT NULL,
    `employeeIds` JSON NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayrollComponent_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CompensationProfile` (
    `id` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `baseSalary` DECIMAL(18, 2) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `notes` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompensationProfile_position_idx`(`position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TaxProfile` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(8, 4) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaxProfile_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PayRun` (
    `id` VARCHAR(191) NOT NULL,
    `periodLabel` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `payDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `totalGross` DECIMAL(18, 2) NOT NULL,
    `totalNet` DECIMAL(18, 2) NOT NULL,
    `totalTax` DECIMAL(18, 2) NOT NULL,
    `employeeCount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PayRun_periodStart_periodEnd_idx`(`periodStart`, `periodEnd`),
    INDEX `PayRun_status_idx`(`status`),
    INDEX `PayRun_periodEnd_idx`(`periodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Payslip` (
    `id` VARCHAR(191) NOT NULL,
    `payRunId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `employeeNumber` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `periodLabel` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `payDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `baseSalary` DECIMAL(18, 2) NOT NULL,
    `allowance` DECIMAL(18, 2) NOT NULL,
    `overtimePay` DECIMAL(18, 2) NOT NULL,
    `additionalEarnings` DECIMAL(18, 2) NOT NULL,
    `grossPay` DECIMAL(18, 2) NOT NULL,
    `taxDeduction` DECIMAL(18, 2) NOT NULL,
    `otherDeductions` DECIMAL(18, 2) NOT NULL,
    `netPay` DECIMAL(18, 2) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `bankAccountMasked` VARCHAR(191) NOT NULL,
    `taxProfile` VARCHAR(191) NOT NULL,
    `components` JSON NOT NULL,
    `generatedFileUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payslip_userId_idx`(`userId`),
    INDEX `Payslip_payRunId_idx`(`payRunId`),
    INDEX `Payslip_status_idx`(`status`),
    INDEX `Payslip_payDate_idx`(`payDate`),
    INDEX `Payslip_userId_payDate_idx`(`userId`, `payDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReimbursementClaimType` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `claimType` VARCHAR(191) NOT NULL,
    `subType` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `annualLimit` DECIMAL(18, 2) NOT NULL,
    `remainingBalance` DECIMAL(18, 2) NOT NULL,
    `active` BOOLEAN NOT NULL,
    `notes` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReimbursementClaimType_employeeId_idx`(`employeeId`),
    INDEX `ReimbursementClaimType_category_idx`(`category`),
    INDEX `ReimbursementClaimType_active_idx`(`active`),
    INDEX `ReimbursementClaimType_updatedAt_idx`(`updatedAt`),
    INDEX `ReimbursementClaimType_employeeId_updatedAt_idx`(`employeeId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReimbursementRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeName` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `claimTypeId` VARCHAR(191) NOT NULL,
    `claimType` VARCHAR(191) NOT NULL,
    `subType` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `receiptDate` DATETIME(3) NOT NULL,
    `remarks` VARCHAR(191) NOT NULL,
    `receiptFileName` VARCHAR(191) NULL,
    `receiptFileUrl` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `approverFlow` JSON NOT NULL,
    `balanceSnapshot` DECIMAL(18, 2) NOT NULL,

    INDEX `ReimbursementRequest_userId_idx`(`userId`),
    INDEX `ReimbursementRequest_claimTypeId_idx`(`claimTypeId`),
    INDEX `ReimbursementRequest_status_idx`(`status`),
    INDEX `ReimbursementRequest_updatedAt_idx`(`updatedAt`),
    INDEX `ReimbursementRequest_userId_updatedAt_idx`(`userId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AppSession` ADD CONSTRAINT `AppSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AttendanceLog` ADD CONSTRAINT `AttendanceLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OvertimeRequest` ADD CONSTRAINT `OvertimeRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_payRunId_fkey` FOREIGN KEY (`payRunId`) REFERENCES `PayRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReimbursementClaimType` ADD CONSTRAINT `ReimbursementClaimType_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReimbursementRequest` ADD CONSTRAINT `ReimbursementRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReimbursementRequest` ADD CONSTRAINT `ReimbursementRequest_claimTypeId_fkey` FOREIGN KEY (`claimTypeId`) REFERENCES `ReimbursementClaimType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
