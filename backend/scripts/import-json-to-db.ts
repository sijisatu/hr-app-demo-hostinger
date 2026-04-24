import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedData } from "../src/data/seed";
import { DatabaseShape } from "../src/common/types";

const prisma = new PrismaClient();

function toDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00.000Z` : normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

async function loadSourceData() {
  const dataPath = path.resolve(process.cwd(), "storage", "data.json");

  try {
    const raw = await readFile(dataPath, "utf8");
    return JSON.parse(raw) as DatabaseShape;
  } catch {
    return seedData;
  }
}

function normalizeDepartments(source: DatabaseShape) {
  const provided = Array.isArray((source as Partial<DatabaseShape>).departments)
    ? (source as Partial<DatabaseShape>).departments!
    : [];
  const names = new Set(provided.map((entry) => entry.name.trim().toLowerCase()));
  const inferred = source.employees
    .map((entry) => entry.department.trim())
    .filter((entry) => entry.length > 0 && !names.has(entry.toLowerCase()));
  const now = new Date().toISOString();
  return [
    ...provided,
    ...inferred.map((name, index) => ({
      id: `dept-import-${index + 1}`,
      name,
      active: true,
      createdAt: now,
      updatedAt: now
    }))
  ];
}

async function main() {
  const source = await loadSourceData();
  const departments = normalizeDepartments(source);

  await prisma.$connect();

  await prisma.$transaction(async (tx) => {
    await tx.reimbursementRequest.deleteMany();
    await tx.reimbursementClaimType.deleteMany();
    await tx.payslip.deleteMany();
    await tx.payRun.deleteMany();
    await tx.attendanceLog.deleteMany();
    await tx.leaveRequest.deleteMany();
    await tx.overtimeRequest.deleteMany();
    await tx.payrollComponent.deleteMany();
    await tx.compensationProfile.deleteMany();
    await tx.taxProfile.deleteMany();
    await tx.employee.deleteMany();
    await tx.department.deleteMany();

    await tx.department.createMany({
      data: departments.map((department) => ({
        id: department.id,
        name: department.name,
        active: department.active,
        createdAt: toDate(department.createdAt) ?? new Date(),
        updatedAt: toDate(department.updatedAt) ?? new Date()
      }))
    });

    await tx.employee.createMany({
      data: source.employees.map((employee) => ({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        nik: employee.nik,
        name: employee.name,
        email: employee.email,
        birthPlace: employee.birthPlace,
        birthDate: toDateOnly(employee.birthDate) ?? new Date(),
        gender: employee.gender,
        maritalStatus: employee.maritalStatus,
        marriageDate: toDateOnly(employee.marriageDate),
        address: employee.address,
        idCardNumber: employee.idCardNumber,
        education: employee.education,
        workExperience: employee.workExperience,
        educationHistory: employee.educationHistory,
        workExperiences: employee.workExperiences,
        department: employee.department,
        position: employee.position,
        role: employee.role,
        status: employee.status,
        phone: employee.phone,
        joinDate: toDateOnly(employee.joinDate) ?? new Date(),
        workLocation: employee.workLocation,
        workType: employee.workType,
        managerName: employee.managerName,
        employmentType: employee.employmentType,
        contractStatus: employee.contractStatus,
        contractStart: toDateOnly(employee.contractStart) ?? new Date(),
        contractEnd: toDateOnly(employee.contractEnd),
        baseSalary: employee.baseSalary,
        allowance: employee.allowance,
        positionSalaryId: employee.positionSalaryId,
        financialComponentIds: employee.financialComponentIds,
        taxProfileId: employee.taxProfileId,
        taxProfile: employee.taxProfile,
        bankName: employee.bankName,
        bankAccountMasked: employee.bankAccountMasked,
        appLoginEnabled: employee.appLoginEnabled,
        loginUsername: employee.loginUsername,
        loginPassword: employee.loginPassword,
        documents: employee.documents,
        leaveBalances: employee.leaveBalances
      }))
    });

    await tx.taxProfile.createMany({
      data: source.taxProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        rate: profile.rate,
        active: profile.active,
        description: profile.description
      }))
    });

    await tx.compensationProfile.createMany({
      data: source.compensationProfiles.map((profile) => ({
        id: profile.id,
        position: profile.position,
        baseSalary: profile.baseSalary,
        active: profile.active,
        notes: profile.notes
      }))
    });

    await tx.payrollComponent.createMany({
      data: source.payrollComponents.map((component) => ({
        id: component.id,
        code: component.code,
        name: component.name,
        type: component.type,
        calculationType: component.calculationType,
        amount: component.amount,
        percentage: component.percentage,
        taxable: component.taxable,
        active: component.active,
        appliesToAll: component.appliesToAll,
        employeeIds: component.employeeIds,
        description: component.description
      }))
    });

    await tx.attendanceLog.createMany({
      data: source.attendanceLogs.map((record) => ({
        id: record.id,
        userId: record.userId,
        employeeName: record.employeeName,
        department: record.department,
        timestamp: toDate(record.timestamp) ?? new Date(),
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        location: record.location,
        latitude: record.latitude,
        longitude: record.longitude,
        description: record.description,
        gpsValidated: record.gpsValidated,
        gpsDistanceMeters: record.gpsDistanceMeters,
        photoUrl: record.photoUrl,
        status: record.status,
        overtimeMinutes: record.overtimeMinutes
      }))
    });

    await tx.overtimeRequest.createMany({
      data: source.overtimeRequests.map((record) => ({
        id: record.id,
        userId: record.userId,
        employeeName: record.employeeName,
        department: record.department,
        date: toDateOnly(record.date) ?? new Date(),
        minutes: record.minutes,
        reason: record.reason,
        status: record.status
      }))
    });

    await tx.leaveRequest.createMany({
      data: source.leaveRequests.map((record) => ({
        id: record.id,
        userId: record.userId,
        employeeName: record.employeeName,
        type: record.type,
        startDate: toDateOnly(record.startDate) ?? new Date(),
        endDate: toDateOnly(record.endDate) ?? new Date(),
        reason: record.reason,
        status: record.status,
        approverFlow: record.approverFlow,
        balanceLabel: record.balanceLabel,
        requestedAt: toDate(record.requestedAt) ?? new Date(),
        daysRequested: record.daysRequested,
        autoApproved: record.autoApproved
      }))
    });

    await tx.payRun.createMany({
      data: source.payRuns.map((run) => ({
        id: run.id,
        periodLabel: run.periodLabel,
        periodStart: toDateOnly(run.periodStart) ?? new Date(),
        periodEnd: toDateOnly(run.periodEnd) ?? new Date(),
        payDate: toDateOnly(run.payDate) ?? new Date(),
        status: run.status,
        totalGross: run.totalGross,
        totalNet: run.totalNet,
        totalTax: run.totalTax,
        employeeCount: run.employeeCount,
        createdAt: toDate(run.createdAt) ?? new Date(),
        publishedAt: toDate(run.publishedAt)
      }))
    });

    await tx.payslip.createMany({
      data: source.payslips.map((slip) => ({
        id: slip.id,
        payRunId: slip.payRunId,
        userId: slip.userId,
        employeeName: slip.employeeName,
        employeeNumber: slip.employeeNumber,
        department: slip.department,
        position: slip.position,
        periodLabel: slip.periodLabel,
        periodStart: toDateOnly(slip.periodStart) ?? new Date(),
        periodEnd: toDateOnly(slip.periodEnd) ?? new Date(),
        payDate: toDateOnly(slip.payDate) ?? new Date(),
        status: slip.status,
        baseSalary: slip.baseSalary,
        allowance: slip.allowance,
        overtimePay: slip.overtimePay,
        additionalEarnings: slip.additionalEarnings,
        grossPay: slip.grossPay,
        taxDeduction: slip.taxDeduction,
        otherDeductions: slip.otherDeductions,
        netPay: slip.netPay,
        bankName: slip.bankName,
        bankAccountMasked: slip.bankAccountMasked,
        taxProfile: slip.taxProfile,
        components: slip.components,
        generatedFileUrl: slip.generatedFileUrl
      }))
    });

    await tx.reimbursementClaimType.createMany({
      data: source.reimbursementClaimTypes.map((claimType) => ({
        id: claimType.id,
        employeeId: claimType.employeeId,
        employeeName: claimType.employeeName,
        department: claimType.department,
        designation: claimType.designation,
        category: claimType.category,
        claimType: claimType.claimType,
        subType: claimType.subType,
        currency: claimType.currency,
        annualLimit: claimType.annualLimit,
        remainingBalance: claimType.remainingBalance,
        active: claimType.active,
        notes: claimType.notes,
        createdAt: toDate(claimType.createdAt) ?? new Date(),
        updatedAt: toDate(claimType.updatedAt) ?? new Date()
      }))
    });

    await tx.reimbursementRequest.createMany({
      data: source.reimbursementRequests.map((request) => ({
        id: request.id,
        userId: request.userId,
        employeeName: request.employeeName,
        department: request.department,
        designation: request.designation,
        claimTypeId: request.claimTypeId,
        claimType: request.claimType,
        subType: request.subType,
        category: request.category,
        currency: request.currency,
        amount: request.amount,
        receiptDate: toDateOnly(request.receiptDate) ?? new Date(),
        remarks: request.remarks,
        receiptFileName: request.receiptFileName,
        receiptFileUrl: request.receiptFileUrl,
        status: request.status,
        submittedAt: toDate(request.submittedAt),
        approvedAt: toDate(request.approvedAt),
        processedAt: toDate(request.processedAt),
        createdAt: toDate(request.createdAt) ?? new Date(),
        updatedAt: toDate(request.updatedAt) ?? new Date(),
        approverFlow: request.approverFlow,
        balanceSnapshot: request.balanceSnapshot
      }))
    });
  });

  console.log(
    JSON.stringify(
      {
        imported: true,
        employees: source.employees.length,
        attendanceLogs: source.attendanceLogs.length,
        overtimeRequests: source.overtimeRequests.length,
        leaveRequests: source.leaveRequests.length,
        reimbursementClaimTypes: source.reimbursementClaimTypes.length,
        reimbursementRequests: source.reimbursementRequests.length,
        compensationProfiles: source.compensationProfiles.length,
        taxProfiles: source.taxProfiles.length,
        payrollComponents: source.payrollComponents.length,
        payRuns: source.payRuns.length,
        payslips: source.payslips.length
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
