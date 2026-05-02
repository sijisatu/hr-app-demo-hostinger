import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { DatabaseService } from "./database.service";
import { EmployeeLoginResult, EmployeeSessionPayload } from "./auth.types";
import type { AuthenticatedActor } from "./authz";
import { hashPassword, isPasswordHash, verifyPassword } from "./password.service";
import { writeSystemLog } from "./system-log";
import { seedData } from "../data/seed";
import {
  AuditLogRecord,
  AttendanceRecord,
  CompensationProfileRecord,
  DepartmentRecord,
  DatabaseShape,
  EducationRecord,
  EmployeeDocumentRecord,
  EmployeeRecord,
  LeaveBalanceAllocation,
  LeaveRecord,
  LeaveType,
  OvertimeRecord,
  PayRunRecord,
  PayslipLineItem,
  PayslipRecord,
  PayrollComponentRecord,
  ReimbursementClaimTypeRecord,
  ReimbursementRequestRecord,
  TaxProfileRecord,
  WorkExperienceRecord
} from "./types";
import {
  AttendanceHistoryQueryDto,
  AuditLogListQueryDto,
  CheckInDto,
  CheckOutDto,
  ChangePasswordDto,
  CreateCompensationProfileDto,
  CreateDepartmentDto,
  CreateEmployeeDto,
  CreateExportDto,
  EmployeeListQueryDto,
  CreateOvertimeDto,
  PayslipListQueryDto,
  ReimbursementRequestListQueryDto,
  CreatePayrollComponentDto,
  CreateReimbursementClaimTypeDto,
  CreateReimbursementRequestDto,
  CreateTaxProfileDto,
  OvertimeApproveDto,
  ExportPayslipDto,
  GeneratePayrollRunDto,
  LeaveApproveDto,
  LeaveRequestDto,
  PublishPayrollRunDto,
  ReimbursementApproveDto,
  ReimbursementProcessDto,
  ResetEmployeePasswordDto,
  UploadEmployeeDocumentDto,
  UpdateCompensationProfileDto,
  UpdateDepartmentDto,
  UpdateReimbursementClaimTypeDto,
  UpdateReimbursementRequestDto,
  UpdateTaxProfileDto,
  UpdateEmployeeDto,
  UpdatePayrollComponentDto
} from "./dtos";

type SiteConfig = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const siteDirectory: Record<string, SiteConfig> = {
  "Jakarta HQ": { latitude: -6.2, longitude: 106.816666, radiusMeters: 150 },
  "Bandung Hub": { latitude: -6.917464, longitude: 107.619123, radiusMeters: 150 },
  "Surabaya Office": { latitude: -7.257472, longitude: 112.752088, radiusMeters: 150 },
  "Remote - Yogyakarta": { latitude: -7.797068, longitude: 110.370529, radiusMeters: 500 }
};

const NON_SHIFT_START = "09:00";
const NON_SHIFT_END = "17:00";
const currentBalanceYear = new Date().getFullYear();
const legacyLeaveAllocationTemplates = [
  { legacyKey: "annual", code: "annual-leave", label: "Annual Leave", defaultDays: 12 },
  { legacyKey: "religious", code: "religious-leave", label: "Religious Leave", defaultDays: 2 },
  { legacyKey: "maternity", code: "maternity-leave", label: "Maternity Leave", defaultDays: 90 },
  { legacyKey: "paternity", code: "paternity-leave", label: "Paternity Leave", defaultDays: 2 },
  { legacyKey: "marriage", code: "marriage-leave", label: "Marriage Leave", defaultDays: 3 },
  { legacyKey: "bereavement", code: "bereavement-leave", label: "Bereavement Leave", defaultDays: 2 },
  { legacyKey: "permission", code: "permission", label: "Permission", defaultDays: 4 }
] as const;

type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

type ExportJobStatus = "queued" | "processing" | "done" | "failed";
type ExportJobPayload = { type: "report"; payload: CreateExportDto } | { type: "payslip"; payload: ExportPayslipDto };
type ExportJobResult = { fileName: string; fileUrl: string; payslipId?: string };
type ExportJob = {
  id: string;
  status: ExportJobStatus;
  createdAt: string;
  updatedAt: string;
  payload: ExportJobPayload;
  result: ExportJobResult | null;
  error: string | null;
};

  type SessionRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuditLogTarget = {
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
};

const HEALTH_STATS_CACHE_TTL_MS = 15_000;
const HEALTH_DATABASE_CACHE_TTL_MS = 15_000;
const AUDIT_LOG_FIRST_PAGE_CACHE_TTL_MS = 30_000;
const DASHBOARD_SUMMARY_CACHE_TTL_MS = 15_000;
const EMPLOYEE_FIRST_PAGE_CACHE_TTL_MS = 20_000;
const PAYSLIP_FIRST_PAGE_CACHE_TTL_MS = 20_000;
const PAYROLL_OVERVIEW_CACHE_TTL_MS = 20_000;
const PAYROLL_MASTERDATA_CACHE_TTL_MS = 30_000;
const ATTENDANCE_SELFIE_ASSET_CACHE_TTL_MS = 60_000;

const prismaAuditLogListSelect = {
  id: true,
  eventKey: true,
  module: true,
  action: true,
  actorName: true,
  actorRole: true,
  actorDepartment: true,
  targetType: true,
  targetId: true,
  targetLabel: true,
  summary: true,
  ipAddress: true,
  occurredAt: true
} as const;

const prismaEmployeeSelect = {
  id: true,
  employeeNumber: true,
  nik: true,
  name: true,
  email: true,
  birthPlace: true,
  birthDate: true,
  gender: true,
  maritalStatus: true,
  marriageDate: true,
  address: true,
  idCardNumber: true,
  education: true,
  workExperience: true,
  educationHistory: true,
  workExperiences: true,
  department: true,
  position: true,
  role: true,
  status: true,
  phone: true,
  joinDate: true,
  workLocation: true,
  workType: true,
  managerName: true,
  employmentType: true,
  contractStatus: true,
  contractStart: true,
  contractEnd: true,
  baseSalary: true,
  allowance: true,
  positionSalaryId: true,
  financialComponentIds: true,
  taxProfileId: true,
  taxProfile: true,
  bankName: true,
  bankAccountMasked: true,
  appLoginEnabled: true,
  loginUsername: true,
  documents: true,
  leaveBalances: true,
  createdAt: true,
  updatedAt: true
} as const;

const prismaEmployeeListSelect = {
  id: true,
  employeeNumber: true,
  nik: true,
  name: true,
  email: true,
  department: true,
  position: true,
  role: true,
  status: true,
  joinDate: true,
  workLocation: true,
  workType: true,
  managerName: true,
  employmentType: true,
  contractStatus: true,
  contractStart: true,
  contractEnd: true,
  appLoginEnabled: true,
  loginUsername: true
} as const;

const prismaPayslipListSelect = {
  id: true,
  payRunId: true,
  userId: true,
  employeeName: true,
  employeeNumber: true,
  department: true,
  position: true,
  periodLabel: true,
  periodStart: true,
  periodEnd: true,
  payDate: true,
  status: true,
  grossPay: true,
  taxDeduction: true,
  otherDeductions: true,
  netPay: true,
  bankName: true,
  bankAccountMasked: true,
  generatedFileUrl: true
} as const;

const prismaAttendanceSelect = {
  id: true,
  userId: true,
  employeeName: true,
  department: true,
  timestamp: true,
  checkIn: true,
  checkOut: true,
  location: true,
  latitude: true,
  longitude: true,
  description: true,
  gpsValidated: true,
  gpsDistanceMeters: true,
  photoUrl: true,
  status: true,
  overtimeMinutes: true
} as const;

const prismaEmployeeIdentitySelect = {
  id: true,
  name: true,
  department: true,
  position: true
} as const;

const prismaDepartmentWriteSelect = {
  id: true,
  name: true,
  active: true
} as const;

const prismaCompensationProfileWriteSelect = {
  id: true,
  position: true,
  baseSalary: true
} as const;

const prismaTaxProfileWriteSelect = {
  id: true,
  name: true
} as const;

const prismaPayrollComponentAllowanceSelect = {
  type: true,
  calculationType: true,
  amount: true,
  percentage: true
} as const;

@Injectable()
export class AppService {
  private readonly storageRoot = path.resolve(process.cwd(), "storage");
  private readonly dbPath = path.join(this.storageRoot, "data.json");
  private readonly auditLogPath = path.join(this.storageRoot, "audit.log");
  private readonly isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
  private readonly useDemoSeedData =
    (process.env.BOOTSTRAP_DEMO_DATA ?? "").toLowerCase() === "true" ||
    (!this.isProduction && (process.env.BOOTSTRAP_DEMO_DATA ?? "").toLowerCase() !== "false");
  private readonly maxPageSize = Math.max(
    25,
    Math.floor(this.parsePositiveNumber(process.env.APP_MAX_PAGE_SIZE, this.isProduction ? 100 : 200))
  );
  private readonly sessionIdleTimeoutMinutes = this.parsePositiveNumber(process.env.APP_SESSION_IDLE_TIMEOUT_MINUTES, 5);
  private readonly sessionMaxLifetimeHours = this.parsePositiveNumber(process.env.APP_SESSION_MAX_LIFETIME_HOURS, 168);
  private readonly sessionMaxConcurrentPerUser = Math.max(1, Math.floor(this.parsePositiveNumber(process.env.APP_SESSION_MAX_CONCURRENT_PER_USER, 3)));
  private readonly sessionTouchIntervalMinutes = this.parsePositiveNumber(process.env.APP_SESSION_TOUCH_INTERVAL_MINUTES, 5);
  private cache: DatabaseShape | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private auditQueue: Promise<void> = Promise.resolve();
  private exportQueue: ExportJob[] = [];
  private activeExportJob = false;
  private exportWorkerScheduled = false;
  private lastSessionCleanupAt = 0;
  private lastAuditSequence = 0;
  private lastAuditHash = "GENESIS";
  private cachedHealthStats:
    | {
        expiresAt: number;
        services: Record<string, unknown>;
      }
    | null = null;
  private lastKnownDatabaseHealth:
    | {
        checkedAt: number;
        result: Awaited<ReturnType<DatabaseService["healthcheck"]>>;
      }
    | null = null;
  private cachedAuditLogFirstPage:
    Map<number, {
      expiresAt: number;
      items: AuditLogRecord[];
    }> = new Map();
  private cachedAttendanceToday:
    | {
        dayKey: string;
        expiresAt: number;
        items: AttendanceRecord[];
      }
    | null = null;
  private cachedAttendanceOverview:
    | {
        dayKey: string;
        expiresAt: number;
        value: {
          checkedInToday: number;
          openCheckIns: number;
          gpsValidated: number;
          selfieCaptured: number;
          overtimeHours: number;
        };
      }
    | null = null;
  private cachedDashboardSummary:
    | {
        expiresAt: number;
        value: {
          employees: number;
          onTime: number;
          late: number;
          absent: number;
          leavePending: number;
          storageMode: string;
        };
      }
    | null = null;
  private cachedEmployeeFirstPage = new Map<string, {
    expiresAt: number;
    pageSize: number;
    total: number;
    items: EmployeeRecord[];
  }>();
  private cachedPayslipFirstPage = new Map<string, {
    expiresAt: number;
    pageSize: number;
    total: number;
    items: PayslipRecord[];
  }>();
  private cachedPayrollOverview:
    | {
        expiresAt: number;
        value: {
          latestRun: PayRunRecord | null;
          payrollComponents: number;
          activeEmployees: number;
          draftRuns: number;
          publishedPayslips: number;
        };
      }
    | null = null;
  private cachedPayrollComponents:
    | {
        expiresAt: number;
        items: PayrollComponentRecord[];
      }
    | null = null;
  private cachedPayRuns:
    | {
        expiresAt: number;
        items: PayRunRecord[];
      }
    | null = null;
  private cachedAttendanceSelfieAssets = new Map<string, {
    expiresAt: number;
    absolutePath: string;
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }>();

  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await mkdir(this.storageRoot, { recursive: true });
    await Promise.all([
      mkdir(path.join(this.storageRoot, "attendance-selfies"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "documents"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "documents", "employee-files"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "exports"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "leave"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "leave", "supporting-documents"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "reimbursements"), { recursive: true }),
      mkdir(path.join(this.storageRoot, "reimbursements", "receipts"), { recursive: true })
    ]);

    if (!existsSync(this.dbPath)) {
      const initialSnapshot = this.useDemoSeedData ? seedData : this.createEmptyDatabaseSnapshot();
      await writeFile(this.dbPath, JSON.stringify(initialSnapshot, null, 2), "utf8");
    }

    await this.initializeAuditLogState();

    const prisma = this.getPrisma();
    if (prisma) {
      const employeeCount = await prisma.employee.count();
      if (employeeCount === 0) {
        const raw = await readFile(this.dbPath, "utf8");
        const snapshot = this.normalizeSnapshot(JSON.parse(raw) as DatabaseShape);
        await this.writeDb(snapshot, { allowPrismaSnapshotSync: true });
        return;
      }

      await this.ensurePrismaEmployeePasswordsHashed();
      await this.primeAuditLogFirstPageCache();
      await this.primeAttendanceSelfieAssetCache();
      await this.getCurrentDatabaseHealth();
      return;
    }

    const raw = await readFile(this.dbPath, "utf8");
    const snapshot = this.normalizeSnapshot(JSON.parse(raw) as DatabaseShape);
    await this.writeDb(snapshot);
  }

  private createEmptyDatabaseSnapshot(): DatabaseShape {
    return {
      departments: [],
      employees: [],
      attendanceLogs: [],
      overtimeRequests: [],
      leaveRequests: [],
      reimbursementClaimTypes: [],
      reimbursementRequests: [],
      compensationProfiles: [],
      taxProfiles: [],
      payrollComponents: [],
      payRuns: [],
      payslips: []
    };
  }

  private async initializeAuditLogState() {
    if (!existsSync(this.auditLogPath)) {
      this.lastAuditSequence = 0;
      this.lastAuditHash = "GENESIS";
      return;
    }

    try {
      const content = await readFile(this.auditLogPath, "utf8");
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      this.lastAuditSequence = lines.length;

      const lastLine = lines.at(-1);
      if (!lastLine) {
        this.lastAuditHash = "GENESIS";
        return;
      }

      try {
        const parsed = JSON.parse(lastLine) as { entryHash?: unknown };
        this.lastAuditHash = typeof parsed.entryHash === "string" && parsed.entryHash.trim().length > 0
          ? parsed.entryHash
          : "GENESIS";
      } catch {
        this.lastAuditHash = "LEGACY";
      }
    } catch {
      this.lastAuditSequence = 0;
      this.lastAuditHash = "GENESIS";
    }
  }

  private async primeAuditLogFirstPageCache() {
    const prisma = this.getPrisma();
    if (!prisma?.auditLog?.findMany) {
      return;
    }

    for (const pageSize of [25, 50]) {
      const rows = await prisma.auditLog.findMany({
        orderBy: { occurredAt: "desc" },
        take: pageSize,
        select: prismaAuditLogListSelect
      });
      this.cachedAuditLogFirstPage.set(pageSize, {
        items: rows.map((record: any) => this.mapPrismaAuditLog(record, false)),
        expiresAt: Date.now() + AUDIT_LOG_FIRST_PAGE_CACHE_TTL_MS
      });
    }
  }

  private async primeAttendanceSelfieAssetCache() {
    const prisma = this.getPrisma();
    if (!prisma?.attendanceLog?.findMany) {
      return;
    }

    const rows = await prisma.attendanceLog.findMany({
      where: {
        photoUrl: {
          not: null
        }
      },
      orderBy: { timestamp: "desc" },
      take: 10,
      select: {
        id: true,
        photoUrl: true
      }
    });

    for (const row of rows) {
      if (!row.photoUrl) {
        continue;
      }

      const absolutePath = this.resolveStoragePath(String(row.photoUrl));
      if (!existsSync(absolutePath)) {
        continue;
      }

      const fileName = path.basename(absolutePath);
      const contentType = this.guessContentType(fileName);
      const buffer = await readFile(absolutePath);
      for (const role of ["admin", "hr"] as const) {
        this.cachedAttendanceSelfieAssets.set(`${role}:${String(row.id)}`, {
          absolutePath,
          fileName,
          contentType,
          buffer,
          expiresAt: Date.now() + ATTENDANCE_SELFIE_ASSET_CACHE_TTL_MS
        });
      }
    }
  }

  private normalizeSnapshot(current: DatabaseShape): DatabaseShape {
    current.departments = this.normalizeDepartments(current.departments, current.employees);
    current.employees = current.employees.map((employee, index) => this.normalizeEmployee(employee, index));
    current.attendanceLogs = (current.attendanceLogs ?? []).map((attendance, index) => this.normalizeAttendance(attendance, current.employees, index));
    current.overtimeRequests = (current.overtimeRequests?.length ? current.overtimeRequests : this.useDemoSeedData ? seedData.overtimeRequests : []).map((record, index) => this.normalizeOvertime(record, index));
    current.leaveRequests = (current.leaveRequests ?? []).map((record, index) => this.normalizeLeave(record, current.employees, index));
    current.reimbursementClaimTypes = (current.reimbursementClaimTypes?.length ? current.reimbursementClaimTypes : this.useDemoSeedData ? seedData.reimbursementClaimTypes : []).map((record, index) => this.normalizeReimbursementClaimType(record, current.employees, index));
    current.reimbursementRequests = (current.reimbursementRequests?.length ? current.reimbursementRequests : this.useDemoSeedData ? seedData.reimbursementRequests : []).map((record, index) => this.normalizeReimbursementRequest(record, current.employees, current.reimbursementClaimTypes, index));
    current.compensationProfiles = (current.compensationProfiles?.length ? current.compensationProfiles : this.useDemoSeedData ? seedData.compensationProfiles : []).map((profile, index) => this.normalizeCompensationProfile(profile, index));
    current.taxProfiles = (current.taxProfiles?.length ? current.taxProfiles : this.useDemoSeedData ? seedData.taxProfiles : []).map((profile, index) => this.normalizeTaxProfile(profile, index));
    current.payrollComponents = (current.payrollComponents?.length ? current.payrollComponents : this.useDemoSeedData ? seedData.payrollComponents : []).map((component, index) => this.normalizePayrollComponent(component, index));
    current.payRuns = (current.payRuns?.length ? current.payRuns : this.useDemoSeedData ? seedData.payRuns : []).map((run, index) => this.normalizePayRun(run, index));
    current.payslips = (current.payslips?.length ? current.payslips : this.useDemoSeedData ? seedData.payslips : []).map((slip, index) => this.normalizePayslip(slip, current.employees, index));
    return current;
  }

  private normalizeDepartment(
    record: Partial<DepartmentRecord> & Record<string, unknown>,
    index: number
  ): DepartmentRecord {
    return {
      id: String(record.id ?? `dept-${String(index + 1).padStart(3, "0")}`),
      name: String(record.name ?? `Department ${index + 1}`),
      active: Boolean(record.active ?? true),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? new Date().toISOString())
    };
  }

  private normalizeDepartments(rawDepartments: unknown, employees: EmployeeRecord[]) {
    const base = Array.isArray(rawDepartments)
      ? (rawDepartments as Array<Partial<DepartmentRecord> & Record<string, unknown>>)
      : [];
    const normalized = base.map((record, index) => this.normalizeDepartment(record, index));
    const names = new Set(normalized.map((entry) => entry.name.trim().toLowerCase()));
    const inferred = Array.from(new Set(
      employees
        .map((entry) => entry.department.trim())
        .filter((entry) => entry.length > 0)
    ));
    for (const name of inferred) {
      if (names.has(name.toLowerCase())) {
        continue;
      }
      normalized.push({
        id: `dept-${randomUUID().slice(0, 8)}`,
        name,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return normalized.sort((a, b) => a.name.localeCompare(b.name));
  }

  private normalizeEmployee(employee: Partial<EmployeeRecord> & Record<string, unknown>, index: number): EmployeeRecord {
    const padded = String(index + 1).padStart(3, "0");
    const leaveBalances = this.normalizeLeaveBalances(employee.leaveBalances as Partial<EmployeeRecord["leaveBalances"]> | undefined);
    const educationHistory = Array.isArray(employee.educationHistory) ? employee.educationHistory as EducationRecord[] : [];
    const workExperiences = Array.isArray(employee.workExperiences) ? employee.workExperiences as WorkExperienceRecord[] : [];
    const documents = Array.isArray(employee.documents) ? employee.documents as EmployeeDocumentRecord[] : [];
    return {
      id: String(employee.id ?? `emp-${padded}`),
      employeeNumber: String(employee.employeeNumber ?? `EMP-2024-${padded}`),
      nik: String(employee.nik ?? `PRX-${padded}`),
      name: String(employee.name ?? "Unnamed Employee"),
      email: String(employee.email ?? `employee${padded}@praluxstd.com`),
      birthPlace: String(employee.birthPlace ?? "Jakarta"),
      birthDate: String(employee.birthDate ?? "1995-01-01"),
      gender: (employee.gender as EmployeeRecord["gender"]) ?? "male",
      maritalStatus: (employee.maritalStatus as EmployeeRecord["maritalStatus"]) ?? "single",
      marriageDate: employee.marriageDate == null ? null : String(employee.marriageDate),
      address: String(employee.address ?? "Address has not been provided"),
      idCardNumber: String(employee.idCardNumber ?? `3171${padded}0000000000`),
      education: String(employee.education ?? "Belum ada data pendidikan"),
      workExperience: String(employee.workExperience ?? "Belum ada data pengalaman kerja"),
      educationHistory: educationHistory.length > 0 ? educationHistory.map((entry) => ({
        level: String(entry.level ?? "Education"),
        institution: String(entry.institution ?? "-"),
        major: String(entry.major ?? "-"),
        startYear: String(entry.startYear ?? ""),
        endYear: String(entry.endYear ?? "")
      })) : [{ level: "Education", institution: String(employee.education ?? "-"), major: "-", startYear: "", endYear: "" }],
      workExperiences: workExperiences.length > 0 ? workExperiences.map((entry) => ({
        company: String(entry.company ?? "-"),
        role: String(entry.role ?? "-"),
        startDate: String(entry.startDate ?? ""),
        endDate: String(entry.endDate ?? ""),
        description: String(entry.description ?? "-")
      })) : [{ company: "-", role: String(employee.workExperience ?? "-"), startDate: "", endDate: "", description: String(employee.workExperience ?? "-") }],
      department: String(employee.department ?? "General Operations"),
      position: String(employee.position ?? "Staff"),
      role: (employee.role as EmployeeRecord["role"]) ?? "employee",
      status: (employee.status as EmployeeRecord["status"]) ?? "active",
      phone: String(employee.phone ?? "-"),
      joinDate: String(employee.joinDate ?? new Date().toISOString().slice(0, 10)),
      workLocation: String(employee.workLocation ?? "Jakarta HQ"),
      workType: (employee.workType as EmployeeRecord["workType"]) ?? "onsite",
      managerName: String(employee.managerName ?? "HR Lead"),
      employmentType: (employee.employmentType as EmployeeRecord["employmentType"]) ?? "permanent",
      contractStatus: (employee.contractStatus as EmployeeRecord["contractStatus"]) ?? "permanent",
      contractStart: String(employee.contractStart ?? employee.joinDate ?? new Date().toISOString().slice(0, 10)),
      contractEnd: employee.contractEnd == null ? null : String(employee.contractEnd),
      baseSalary: Number(employee.baseSalary ?? 12000000),
      allowance: Number(employee.allowance ?? 1000000),
      positionSalaryId: employee.positionSalaryId == null ? null : String(employee.positionSalaryId),
      financialComponentIds: Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds.map((entry) => String(entry)) : [],
      taxProfileId: employee.taxProfileId == null ? null : String(employee.taxProfileId),
      taxProfile: String(employee.taxProfile ?? "PPh 21 TK/0"),
      bankName: String(employee.bankName ?? "BCA"),
      bankAccountMasked: String(employee.bankAccountMasked ?? "***0000"),
      appLoginEnabled: Boolean(employee.appLoginEnabled ?? true),
      loginUsername: employee.loginUsername == null ? String(employee.nik ?? `PRX-${padded}`) : String(employee.loginUsername),
      loginPassword: employee.loginPassword == null ? "employee123" : String(employee.loginPassword),
      documents: documents.map((entry, documentIndex) => ({
        id: String(entry.id ?? `doc-${padded}-${documentIndex + 1}`),
        employeeId: String(entry.employeeId ?? employee.id ?? `emp-${padded}`),
        type: (entry.type as EmployeeDocumentRecord["type"]) ?? "lainnya",
        title: String(entry.title ?? "Employee Document"),
        fileName: String(entry.fileName ?? "document.bin"),
        fileUrl: String(entry.fileUrl ?? `/storage/documents/employee-files/${employee.id ?? `emp-${padded}`}/document.bin`),
        uploadedAt: String(entry.uploadedAt ?? new Date().toISOString()),
        notes: String(entry.notes ?? "")
      })),
      leaveBalances
    };
  }

  private normalizeCompensationProfile(profile: Partial<CompensationProfileRecord> & Record<string, unknown>, index: number): CompensationProfileRecord {
    return {
      id: String(profile.id ?? `comp-${String(index + 1).padStart(3, "0")}`),
      position: String(profile.position ?? `Position ${index + 1}`),
      baseSalary: Number(profile.baseSalary ?? 0),
      active: Boolean(profile.active ?? true),
      notes: String(profile.notes ?? "Compensation profile")
    };
  }

  private normalizeTaxProfile(profile: Partial<TaxProfileRecord> & Record<string, unknown>, index: number): TaxProfileRecord {
    return {
      id: String(profile.id ?? `tax-${String(index + 1).padStart(3, "0")}`),
      name: String(profile.name ?? `Tax Profile ${index + 1}`),
      rate: Number(profile.rate ?? 5),
      active: Boolean(profile.active ?? true),
      description: String(profile.description ?? "Tax profile")
    };
  }

  private normalizeAttendance(attendance: Partial<AttendanceRecord> & Record<string, unknown>, employees: EmployeeRecord[], index: number): AttendanceRecord {
    const employee = employees.find((entry) => entry.id === String(attendance.userId ?? ""));
    const location = String(attendance.location ?? employee?.workLocation ?? "Jakarta HQ");
    
    const latitude = Number(attendance.latitude ?? siteDirectory[location]?.latitude ?? -6.2);
    const longitude = Number(attendance.longitude ?? siteDirectory[location]?.longitude ?? 106.816666);
    const gpsDistanceMeters = Number(attendance.gpsDistanceMeters ?? this.measureDistanceMeters(location, latitude, longitude));
    return {
      id: String(attendance.id ?? `att-${String(index + 1).padStart(3, "0")}`),
      userId: String(attendance.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(attendance.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(attendance.department ?? employee?.department ?? "General Operations"),
      timestamp: String(attendance.timestamp ?? new Date().toISOString()),
      checkIn: String(attendance.checkIn ?? NON_SHIFT_START),
      checkOut: attendance.checkOut == null ? null : String(attendance.checkOut),
      location,
      latitude,
      longitude,
      description: String(attendance.description ?? "Regular attendance check-in"),
      gpsValidated: typeof attendance.gpsValidated === "boolean" ? attendance.gpsValidated : gpsDistanceMeters <= this.getRadius(location),
      gpsDistanceMeters,
      photoUrl: attendance.photoUrl == null ? null : String(attendance.photoUrl),
      status: (attendance.status as AttendanceRecord["status"]) ?? "on-time",
      overtimeMinutes: Number(attendance.overtimeMinutes ?? 0)
    };
  }

  private normalizeOvertime(record: Partial<OvertimeRecord> & Record<string, unknown>, index: number): OvertimeRecord {
    return {
      id: String(record.id ?? `ot-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(record.employeeName ?? "Unknown Employee"),
      department: String(record.department ?? "General Operations"),
      date: String(record.date ?? new Date().toISOString().slice(0, 10)),
      minutes: Number(record.minutes ?? 0),
      reason: String(record.reason ?? "Operational support"),
      status: (record.status as OvertimeRecord["status"]) ?? "pending"
    };
  }

  private normalizeLeave(record: Partial<LeaveRecord> & Record<string, unknown>, employees: EmployeeRecord[], index: number): LeaveRecord {
    const employee = employees.find((entry) => entry.id === String(record.userId ?? ""));
    const rawType = (record.type as LeaveType | undefined) ?? "Leave Request";
    const type: LeaveType = rawType === "Leave Request" ? "Annual Leave" : rawType;
    const startDate = String(record.startDate ?? new Date().toISOString().slice(0, 10));
    const endDate = String(record.endDate ?? new Date().toISOString().slice(0, 10));
    const daysRequested = Number(record.daysRequested ?? this.getRequestedDays(type, startDate, endDate));
    return {
      id: String(record.id ?? `leave-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      type,
      startDate,
      endDate,
      reason: String(record.reason ?? "Operational request"),
      status: (record.status as LeaveRecord["status"]) ?? "pending-manager",
      approverFlow: Array.isArray(record.approverFlow) ? record.approverFlow.map((entry) => String(entry)) : ["Manager Pending", "HR Pending"],
      balanceLabel: String(record.balanceLabel ?? this.describeBalance(employee, type, daysRequested)),
      requestedAt: String(record.requestedAt ?? new Date().toISOString()),
      daysRequested,
      autoApproved: Boolean(record.autoApproved ?? false),
      supportingDocumentName: record.supportingDocumentName == null ? null : String(record.supportingDocumentName),
      supportingDocumentUrl: record.supportingDocumentUrl == null ? null : String(record.supportingDocumentUrl)
    };
  }

  private normalizePayrollComponent(component: Partial<PayrollComponentRecord> & Record<string, unknown>, index: number): PayrollComponentRecord {
    return {
      id: String(component.id ?? `paycomp-${String(index + 1).padStart(3, "0")}`),
      code: String(component.code ?? `COMP-${String(index + 1).padStart(3, "0")}`),
      name: String(component.name ?? `Component ${index + 1}`),
      type: (component.type as PayrollComponentRecord["type"]) ?? "earning",
      calculationType: (component.calculationType as PayrollComponentRecord["calculationType"]) ?? "fixed",
      amount: Number(component.amount ?? 0),
      percentage: component.percentage == null ? null : Number(component.percentage),
      taxable: Boolean(component.taxable ?? true),
      active: Boolean(component.active ?? true),
      appliesToAll: Boolean(component.appliesToAll ?? true),
      employeeIds: Array.isArray(component.employeeIds) ? component.employeeIds.map((entry) => String(entry)) : [],
      description: String(component.description ?? "Payroll component")
    };
  }
  private normalizePayRun(run: Partial<PayRunRecord> & Record<string, unknown>, index: number): PayRunRecord {
    return {
      id: String(run.id ?? `payrun-${String(index + 1).padStart(3, "0")}`),
      periodLabel: String(run.periodLabel ?? `Payroll ${index + 1}`),
      periodStart: String(run.periodStart ?? new Date().toISOString().slice(0, 10)),
      periodEnd: String(run.periodEnd ?? new Date().toISOString().slice(0, 10)),
      payDate: String(run.payDate ?? new Date().toISOString().slice(0, 10)),
      status: (run.status as PayRunRecord["status"]) ?? "draft",
      totalGross: Number(run.totalGross ?? 0),
      totalNet: Number(run.totalNet ?? 0),
      totalTax: Number(run.totalTax ?? 0),
      employeeCount: Number(run.employeeCount ?? 0),
      createdAt: String(run.createdAt ?? new Date().toISOString()),
      publishedAt: run.publishedAt == null ? null : String(run.publishedAt)
    };
  }

  private normalizePayslip(slip: Partial<PayslipRecord> & Record<string, unknown>, employees: EmployeeRecord[], index: number): PayslipRecord {
    const employee = employees.find((entry) => entry.id === String(slip.userId ?? ""));
    return {
      id: String(slip.id ?? `payslip-${String(index + 1).padStart(3, "0")}`),
      payRunId: String(slip.payRunId ?? "payrun-seed"),
      userId: String(slip.userId ?? employee?.id ?? `emp-${String(index + 1).padStart(3, "0")}`),
      employeeName: String(slip.employeeName ?? employee?.name ?? "Unknown Employee"),
      employeeNumber: String(slip.employeeNumber ?? employee?.employeeNumber ?? `EMP-2024-${String(index + 1).padStart(3, "0")}`),
      department: String(slip.department ?? employee?.department ?? "General Operations"),
      position: String(slip.position ?? employee?.position ?? "Staff"),
      periodLabel: String(slip.periodLabel ?? "Current Payroll"),
      periodStart: String(slip.periodStart ?? new Date().toISOString().slice(0, 10)),
      periodEnd: String(slip.periodEnd ?? new Date().toISOString().slice(0, 10)),
      payDate: String(slip.payDate ?? new Date().toISOString().slice(0, 10)),
      status: (slip.status as PayslipRecord["status"]) ?? "draft",
      baseSalary: Number(slip.baseSalary ?? employee?.baseSalary ?? 0),
      allowance: Number(slip.allowance ?? employee?.allowance ?? 0),
      overtimePay: Number(slip.overtimePay ?? 0),
      additionalEarnings: Number(slip.additionalEarnings ?? 0),
      grossPay: Number(slip.grossPay ?? 0),
      taxDeduction: Number(slip.taxDeduction ?? 0),
      otherDeductions: Number(slip.otherDeductions ?? 0),
      netPay: Number(slip.netPay ?? 0),
      bankName: String(slip.bankName ?? employee?.bankName ?? "BCA"),
      bankAccountMasked: String(slip.bankAccountMasked ?? employee?.bankAccountMasked ?? "***0000"),
      taxProfile: String(slip.taxProfile ?? employee?.taxProfile ?? "PPh 21 TK/0"),
      components: Array.isArray(slip.components)
        ? slip.components.map((entry, componentIndex) => this.normalizePayslipLine(entry as Partial<PayslipLineItem> & Record<string, unknown>, componentIndex))
        : [],
      generatedFileUrl: slip.generatedFileUrl == null ? null : String(slip.generatedFileUrl)
    };
  }

  private normalizePayslipLine(line: Partial<PayslipLineItem> & Record<string, unknown>, index: number): PayslipLineItem {
    return {
      code: String(line.code ?? `LINE-${index + 1}`),
      name: String(line.name ?? `Line ${index + 1}`),
      type: (line.type as PayslipLineItem["type"]) ?? "earning",
      amount: Number(line.amount ?? 0),
      taxable: Boolean(line.taxable ?? true),
      source: (line.source as PayslipLineItem["source"]) ?? "component"
    };
  }

  private normalizeReimbursementClaimType(
    record: Partial<ReimbursementClaimTypeRecord> & Record<string, unknown>,
    employees: EmployeeRecord[],
    index: number
  ): ReimbursementClaimTypeRecord {
    const employee = employees.find((entry) => entry.id === String(record.employeeId ?? ""));
    const annualLimit = Number(record.annualLimit ?? 0);
    const remainingBalance = Number(record.remainingBalance ?? annualLimit);

    return {
      id: String(record.id ?? `claim-${String(index + 1).padStart(3, "0")}`),
      employeeId: String(record.employeeId ?? employee?.id ?? ""),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(record.department ?? employee?.department ?? "General Operations"),
      designation: String(record.designation ?? employee?.position ?? "Staff"),
      category: (record.category as ReimbursementClaimTypeRecord["category"]) ?? "other",
      claimType: String(record.claimType ?? "General Reimbursement"),
      subType: String(record.subType ?? "General"),
      currency: String(record.currency ?? "IDR"),
      annualLimit,
      remainingBalance,
      active: Boolean(record.active ?? true),
      notes: String(record.notes ?? ""),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString())
    };
  }

  private normalizeReimbursementRequest(
    record: Partial<ReimbursementRequestRecord> & Record<string, unknown>,
    employees: EmployeeRecord[],
    claimTypes: ReimbursementClaimTypeRecord[],
    index: number
  ): ReimbursementRequestRecord {
    const employee = employees.find((entry) => entry.id === String(record.userId ?? ""));
    const claimType = claimTypes.find((entry) => entry.id === String(record.claimTypeId ?? ""));

    return {
      id: String(record.id ?? `reimb-${String(index + 1).padStart(3, "0")}`),
      userId: String(record.userId ?? employee?.id ?? ""),
      employeeName: String(record.employeeName ?? employee?.name ?? "Unknown Employee"),
      department: String(record.department ?? employee?.department ?? "General Operations"),
      designation: String(record.designation ?? employee?.position ?? "Staff"),
      claimTypeId: String(record.claimTypeId ?? claimType?.id ?? ""),
      claimType: String(record.claimType ?? claimType?.claimType ?? "General Reimbursement"),
      subType: String(record.subType ?? claimType?.subType ?? "General"),
      category: (record.category as ReimbursementRequestRecord["category"]) ?? claimType?.category ?? "other",
      currency: String(record.currency ?? claimType?.currency ?? "IDR"),
      amount: Number(record.amount ?? 0),
      receiptDate: String(record.receiptDate ?? new Date().toISOString().slice(0, 10)),
      remarks: String(record.remarks ?? ""),
      receiptFileName: record.receiptFileName == null ? null : String(record.receiptFileName),
      receiptFileUrl: record.receiptFileUrl == null ? null : String(record.receiptFileUrl),
      status: (record.status as ReimbursementRequestRecord["status"]) ?? "draft",
      submittedAt: record.submittedAt == null ? null : String(record.submittedAt),
      approvedAt: record.approvedAt == null ? null : String(record.approvedAt),
      processedAt: record.processedAt == null ? null : String(record.processedAt),
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString()),
      approverFlow: Array.isArray(record.approverFlow) ? record.approverFlow.map((entry) => String(entry)) : [],
      balanceSnapshot: Number(record.balanceSnapshot ?? claimType?.remainingBalance ?? 0)
    };
  }

  private async readDb() {
    const prisma = this.getPrisma();
    if (!prisma && this.cache) {
      return this.cache;
    }
    if (prisma) {
      const [
        departments,
        employees,
        attendanceLogs,
        overtimeRequests,
        leaveRequests,
        reimbursementClaimTypes,
        reimbursementRequests,
        compensationProfiles,
        taxProfiles,
        payrollComponents,
        payRuns,
        payslips
      ] = await Promise.all([
        prisma.department.findMany({ orderBy: { name: "asc" } }),
        prisma.employee.findMany({ orderBy: { name: "asc" } }),
        prisma.attendanceLog.findMany({ orderBy: { timestamp: "desc" } }),
        prisma.overtimeRequest.findMany({ orderBy: { date: "desc" } }),
        prisma.leaveRequest.findMany({ orderBy: { requestedAt: "desc" } }),
        prisma.reimbursementClaimType.findMany({ orderBy: { updatedAt: "desc" } }),
        prisma.reimbursementRequest.findMany({ orderBy: { updatedAt: "desc" } }),
        prisma.compensationProfile.findMany({ orderBy: { position: "asc" } }),
        prisma.taxProfile.findMany({ orderBy: { name: "asc" } }),
        prisma.payrollComponent.findMany({ orderBy: { code: "asc" } }),
        prisma.payRun.findMany({ orderBy: { periodEnd: "desc" } }),
        prisma.payslip.findMany({ orderBy: { payDate: "desc" } })
      ]);

      this.cache = {
        departments: departments.map((record: any) => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        employees: employees.map((employee: any) => ({
          ...employee,
          birthDate: this.toDateString(employee.birthDate),
          marriageDate: employee.marriageDate ? this.toDateString(employee.marriageDate) : null,
          joinDate: this.toDateString(employee.joinDate),
          contractStart: this.toDateString(employee.contractStart),
          contractEnd: employee.contractEnd ? this.toDateString(employee.contractEnd) : null,
          baseSalary: Number(employee.baseSalary),
          allowance: Number(employee.allowance),
          educationHistory: Array.isArray(employee.educationHistory) ? employee.educationHistory : [],
          workExperiences: Array.isArray(employee.workExperiences) ? employee.workExperiences : [],
          financialComponentIds: Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds : [],
          documents: Array.isArray(employee.documents) ? employee.documents : [],
          leaveBalances: employee.leaveBalances ?? this.normalizeLeaveBalances()
        })),
        attendanceLogs: attendanceLogs.map((record: any) => ({
          ...record,
          timestamp: this.toIsoString(record.timestamp),
          latitude: Number(record.latitude),
          longitude: Number(record.longitude),
          gpsDistanceMeters: Number(record.gpsDistanceMeters)
        })),
        overtimeRequests: overtimeRequests.map((record: any) => ({
          ...record,
          date: this.toDateString(record.date),
          minutes: Number(record.minutes)
        })),
        leaveRequests: leaveRequests.map((record: any) => ({
          ...record,
          startDate: this.toDateString(record.startDate),
          endDate: this.toDateString(record.endDate),
          requestedAt: this.toIsoString(record.requestedAt),
          daysRequested: Number(record.daysRequested),
          supportingDocumentName: record.supportingDocumentName ?? null,
          supportingDocumentUrl: record.supportingDocumentUrl ?? null
        })),
        reimbursementClaimTypes: reimbursementClaimTypes.map((record: any) => ({
          ...record,
          annualLimit: Number(record.annualLimit),
          remainingBalance: Number(record.remainingBalance),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        reimbursementRequests: reimbursementRequests.map((record: any) => ({
          ...record,
          receiptDate: this.toDateString(record.receiptDate),
          amount: Number(record.amount),
          balanceSnapshot: Number(record.balanceSnapshot),
          submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
          approvedAt: record.approvedAt ? record.approvedAt.toISOString() : null,
          processedAt: record.processedAt ? record.processedAt.toISOString() : null,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
        compensationProfiles: compensationProfiles.map((record: any) => ({
          ...record,
          baseSalary: Number(record.baseSalary)
        })),
        taxProfiles: taxProfiles.map((record: any) => ({
          ...record,
          rate: Number(record.rate)
        })),
        payrollComponents: payrollComponents.map((record: any) => ({
          ...record,
          amount: Number(record.amount),
          percentage: record.percentage == null ? null : Number(record.percentage)
        })),
        payRuns: payRuns.map((record: any) => ({
          ...record,
          periodStart: this.toDateString(record.periodStart),
          periodEnd: this.toDateString(record.periodEnd),
          payDate: this.toDateString(record.payDate),
          totalGross: Number(record.totalGross),
          totalNet: Number(record.totalNet),
          totalTax: Number(record.totalTax),
          createdAt: record.createdAt.toISOString(),
          publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null
        })),
        payslips: payslips.map((record: any) => ({
          ...record,
          periodStart: this.toDateString(record.periodStart),
          periodEnd: this.toDateString(record.periodEnd),
          payDate: this.toDateString(record.payDate),
          baseSalary: Number(record.baseSalary),
          allowance: Number(record.allowance),
          overtimePay: Number(record.overtimePay),
          additionalEarnings: Number(record.additionalEarnings),
          grossPay: Number(record.grossPay),
          taxDeduction: Number(record.taxDeduction),
          otherDeductions: Number(record.otherDeductions),
          netPay: Number(record.netPay),
          components: Array.isArray(record.components) ? record.components : []
        }))
      };

      return this.cache;
    }

    const raw = await readFile(this.dbPath, "utf8");
    this.cache = JSON.parse(raw) as DatabaseShape;
    return this.cache;
  }

  private async writeDb(next: DatabaseShape, options?: { allowPrismaSnapshotSync?: boolean }) {
    this.cache = next;
    this.invalidateReadCaches();
    const prisma = this.getPrisma();
    if (prisma) {
      if (!options?.allowPrismaSnapshotSync) {
        throw new Error("Legacy snapshot sync is blocked in PostgreSQL runtime. Move this code path to direct Prisma reads/writes.");
      }
      const run = this.writeQueue
        .catch(() => undefined)
        .then(() => this.persistSnapshotToDatabase(next));
      this.writeQueue = run.then(() => undefined, () => undefined);
      await run;
      return;
    }

    await writeFile(this.dbPath, JSON.stringify(next, null, 2), "utf8");
  }

  private getPrisma() {
    return this.databaseService.getClient() as any;
  }

  private parsePositiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private toDate(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateOnly(value: string | null | undefined) {
    if (!value) {
      return null;
    }
    const normalized = value.trim();
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00.000Z` : normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateString(value: Date | string | null | undefined) {
    if (!value) {
      return "";
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString().slice(0, 10);
  }

  private toIsoString(value: Date | string | null | undefined) {
    if (!value) {
      return "";
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString();
  }

  private toPageMeta(page?: number, pageSize?: number) {
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Math.min(this.maxPageSize, Number(pageSize) || 25));
    return {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      skip: (normalizedPage - 1) * normalizedPageSize
    };
  }

  private paginateArray<T>(items: T[], page?: number, pageSize?: number): PaginatedResult<T> {
    const meta = this.toPageMeta(page, pageSize);
    const total = items.length;
    const paged = items.slice(meta.skip, meta.skip + meta.pageSize);
    return {
      items: paged,
      total,
      page: meta.page,
      pageSize: meta.pageSize,
      hasNext: meta.skip + paged.length < total
    };
  }

  private async getEmployeeRows() {
    const prisma = this.getPrisma();
    if (prisma) {
      const employees = await prisma.employee.findMany({
        orderBy: { name: "asc" },
        select: prismaEmployeeSelect
      });
      return employees.map((employee: any) => this.sanitizeEmployee(this.mapPrismaEmployee(employee)));
    }

    const db = await this.readDb();
    return db.employees.map((employee) => this.sanitizeEmployee(employee));
  }

  private mapPrismaEmployee(employee: any): EmployeeRecord {
    return {
      ...employee,
      birthDate: this.toDateString(employee.birthDate),
      marriageDate: employee.marriageDate ? this.toDateString(employee.marriageDate) : null,
      joinDate: this.toDateString(employee.joinDate),
      contractStart: this.toDateString(employee.contractStart),
      contractEnd: employee.contractEnd ? this.toDateString(employee.contractEnd) : null,
      baseSalary: Number(employee.baseSalary),
      allowance: Number(employee.allowance),
      educationHistory: Array.isArray(employee.educationHistory) ? employee.educationHistory : [],
      workExperiences: Array.isArray(employee.workExperiences) ? employee.workExperiences : [],
      financialComponentIds: Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds : [],
      documents: Array.isArray(employee.documents) ? employee.documents : [],
      leaveBalances: employee.leaveBalances ?? this.normalizeLeaveBalances()
    } as EmployeeRecord;
  }

  private mapPrismaEmployeeListRecord(employee: any): EmployeeRecord {
    return {
      id: String(employee.id),
      employeeNumber: String(employee.employeeNumber),
      nik: String(employee.nik),
      name: String(employee.name),
      email: String(employee.email),
      department: String(employee.department),
      position: String(employee.position),
      role: employee.role,
      status: employee.status,
      joinDate: this.toDateString(employee.joinDate),
      workLocation: String(employee.workLocation),
      workType: employee.workType,
      managerName: String(employee.managerName),
      employmentType: employee.employmentType,
      contractStatus: employee.contractStatus,
      contractStart: this.toDateString(employee.contractStart),
      contractEnd: employee.contractEnd ? this.toDateString(employee.contractEnd) : null,
      appLoginEnabled: Boolean(employee.appLoginEnabled),
      loginUsername: employee.loginUsername ? String(employee.loginUsername) : null
    } as EmployeeRecord;
  }

  private toEmployeeSummary(employee: EmployeeRecord): EmployeeRecord {
    return {
      ...employee,
      birthPlace: "",
      birthDate: "",
      gender: "male",
      maritalStatus: "single",
      marriageDate: null,
      address: "",
      idCardNumber: "",
      education: "",
      workExperience: "",
      educationHistory: [],
      workExperiences: [],
      phone: "",
      baseSalary: 0,
      allowance: 0,
      positionSalaryId: null,
      financialComponentIds: [],
      taxProfileId: null,
      taxProfile: "",
      bankName: "",
      bankAccountMasked: "",
      documents: [],
      leaveBalances: this.normalizeLeaveBalances()
    };
  }

  private mapPrismaAttendanceRecord(record: any): AttendanceRecord {
    return {
      ...record,
      timestamp: this.toIsoString(record.timestamp),
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      gpsDistanceMeters: Number(record.gpsDistanceMeters)
    } as AttendanceRecord;
  }

  private mapPrismaLeaveRecord(record: any): LeaveRecord {
    return {
      ...record,
      startDate: this.toDateString(record.startDate),
      endDate: this.toDateString(record.endDate),
      requestedAt: this.toIsoString(record.requestedAt),
      daysRequested: Number(record.daysRequested),
      supportingDocumentName: record.supportingDocumentName ?? null,
      supportingDocumentUrl: record.supportingDocumentUrl ?? null
    } as LeaveRecord;
  }

  private mapPrismaOvertimeRecord(record: any): OvertimeRecord {
    return {
      ...record,
      date: this.toDateString(record.date),
      minutes: Number(record.minutes)
    } as OvertimeRecord;
  }

  private mapPrismaDepartment(record: any): DepartmentRecord {
    return {
      ...record,
      createdAt: this.toIsoString(record.createdAt),
      updatedAt: this.toIsoString(record.updatedAt)
    } as DepartmentRecord;
  }

  private mapPrismaCompensationProfile(record: any): CompensationProfileRecord {
    return {
      ...record,
      baseSalary: Number(record.baseSalary)
    } as CompensationProfileRecord;
  }

  private mapPrismaTaxProfile(record: any): TaxProfileRecord {
    return {
      ...record,
      rate: Number(record.rate)
    } as TaxProfileRecord;
  }

  private mapPrismaPayrollComponent(record: any): PayrollComponentRecord {
    return {
      ...record,
      amount: Number(record.amount),
      percentage: record.percentage == null ? null : Number(record.percentage),
      employeeIds: Array.isArray(record.employeeIds) ? record.employeeIds : []
    } as PayrollComponentRecord;
  }

  private mapPrismaPayRun(record: any): PayRunRecord {
    return {
      ...record,
      periodStart: this.toDateString(record.periodStart),
      periodEnd: this.toDateString(record.periodEnd),
      payDate: this.toDateString(record.payDate),
      totalGross: Number(record.totalGross),
      totalNet: Number(record.totalNet),
      totalTax: Number(record.totalTax),
      createdAt: this.toIsoString(record.createdAt),
      publishedAt: record.publishedAt ? this.toIsoString(record.publishedAt) : null
    } as PayRunRecord;
  }

  private mapPrismaPayslip(record: any): PayslipRecord {
    return {
      ...record,
      periodStart: this.toDateString(record.periodStart),
      periodEnd: this.toDateString(record.periodEnd),
      payDate: this.toDateString(record.payDate),
      baseSalary: Number(record.baseSalary),
      allowance: Number(record.allowance),
      overtimePay: Number(record.overtimePay),
      additionalEarnings: Number(record.additionalEarnings),
      grossPay: Number(record.grossPay),
      taxDeduction: Number(record.taxDeduction),
      otherDeductions: Number(record.otherDeductions),
      netPay: Number(record.netPay),
      components: Array.isArray(record.components) ? record.components : [],
      generatedFileUrl: record.generatedFileUrl ?? null
    } as PayslipRecord;
  }

  private mapPrismaPayslipListRecord(record: any): PayslipRecord {
    return {
      id: String(record.id),
      payRunId: String(record.payRunId),
      userId: String(record.userId),
      employeeName: String(record.employeeName),
      employeeNumber: String(record.employeeNumber),
      department: String(record.department),
      position: String(record.position),
      periodLabel: String(record.periodLabel),
      periodStart: this.toDateString(record.periodStart),
      periodEnd: this.toDateString(record.periodEnd),
      payDate: this.toDateString(record.payDate),
      status: record.status,
      baseSalary: 0,
      allowance: 0,
      overtimePay: 0,
      additionalEarnings: 0,
      grossPay: Number(record.grossPay),
      taxDeduction: Number(record.taxDeduction),
      otherDeductions: Number(record.otherDeductions),
      netPay: Number(record.netPay),
      bankName: String(record.bankName),
      bankAccountMasked: String(record.bankAccountMasked),
      taxProfile: "",
      components: [],
      generatedFileUrl: record.generatedFileUrl ?? null
    } as PayslipRecord;
  }

  private mapPrismaReimbursementClaimType(record: any): ReimbursementClaimTypeRecord {
    return {
      ...record,
      annualLimit: Number(record.annualLimit),
      remainingBalance: Number(record.remainingBalance),
      createdAt: this.toIsoString(record.createdAt),
      updatedAt: this.toIsoString(record.updatedAt)
    } as ReimbursementClaimTypeRecord;
  }

  private mapPrismaReimbursementRequest(record: any): ReimbursementRequestRecord {
    return {
      ...record,
      amount: Number(record.amount),
      balanceSnapshot: Number(record.balanceSnapshot),
      receiptDate: this.toDateString(record.receiptDate),
      submittedAt: record.submittedAt ? this.toIsoString(record.submittedAt) : null,
      approvedAt: record.approvedAt ? this.toIsoString(record.approvedAt) : null,
      processedAt: record.processedAt ? this.toIsoString(record.processedAt) : null,
      createdAt: this.toIsoString(record.createdAt),
      updatedAt: this.toIsoString(record.updatedAt)
    } as ReimbursementRequestRecord;
  }

  private sanitizeEmployee(employee: EmployeeRecord) {
    const educationHistory = Array.isArray(employee.educationHistory) ? employee.educationHistory : [];
    const workExperiences = Array.isArray(employee.workExperiences) ? employee.workExperiences : [];
    const financialComponentIds = Array.isArray(employee.financialComponentIds) ? employee.financialComponentIds : [];
    const documents = Array.isArray(employee.documents) ? employee.documents : [];

    return {
      ...employee,
      educationHistory,
      workExperiences,
      financialComponentIds,
      documents: documents.map((document) => this.toSafeEmployeeDocument(document)),
      leaveBalances: employee.leaveBalances ?? this.normalizeLeaveBalances(),
      loginPassword: null
    };
  }

  private toSafeEmployeeDocument(document: EmployeeDocumentRecord): EmployeeDocumentRecord {
    return {
      ...document,
      fileUrl: this.buildEmployeeDocumentAssetUrl(document.employeeId, document.id)
    };
  }

  private toSafeAttendanceRecord(record: AttendanceRecord): AttendanceRecord {
    return {
      ...record,
      photoUrl: record.photoUrl ? this.buildAttendanceSelfieAssetUrl(record.id) : null
    };
  }

  private toSafeReimbursementRequest(record: ReimbursementRequestRecord): ReimbursementRequestRecord {
    return {
      ...record,
      receiptFileUrl: record.receiptFileUrl ? this.buildReimbursementReceiptAssetUrl(record.id) : null
    };
  }

  private toSafeLeaveRecord(record: LeaveRecord): LeaveRecord {
    return {
      ...record,
      supportingDocumentUrl: record.supportingDocumentUrl ? this.buildLeaveSupportingDocumentAssetUrl(record.id) : null
    };
  }

  private buildEmployeeDocumentAssetUrl(employeeId: string, documentId: string) {
    return `/api/assets/employees/${employeeId}/documents/${documentId}`;
  }

  private buildAttendanceSelfieAssetUrl(attendanceId: string) {
    return `/api/assets/attendance/${attendanceId}/selfie`;
  }

  private buildReimbursementReceiptAssetUrl(reimbursementId: string) {
    return `/api/assets/reimbursements/${reimbursementId}/receipt`;
  }

  private buildLeaveSupportingDocumentAssetUrl(leaveId: string) {
    return `/api/assets/leave/${leaveId}/supporting-document`;
  }

  private resolveStoragePath(fileUrl: string) {
    return path.join(this.storageRoot, fileUrl.replace(/^\/storage\//, "").replace(/\//g, path.sep));
  }

  private assertSensitiveDocumentAccess(
    actor: AuthenticatedActor | undefined,
    employee: EmployeeRecord | undefined,
    contextLabel: string
  ) {
    if (!actor) {
      throw new ForbiddenException(`Session is required to access ${contextLabel}.`);
    }
    if (actor.role === "admin" || actor.role === "hr") {
      return;
    }
    if (!employee) {
      throw new NotFoundException("Employee not found for document access validation.");
    }
    if (actor.role === "employee" && actor.id === employee.id) {
      return;
    }
    if (actor.role === "manager") {
      this.assertManagerApprovalScope(actor, employee);
      return;
    }
    throw new ForbiddenException(`You are not allowed to access ${contextLabel}.`);
  }

  async getEmployeeDocumentAsset(employeeId: string, documentId: string, actor?: AuthenticatedActor) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          employeeNumber: true,
          nik: true,
          name: true,
          email: true,
          birthPlace: true,
          birthDate: true,
          gender: true,
          maritalStatus: true,
          marriageDate: true,
          address: true,
          idCardNumber: true,
          education: true,
          workExperience: true,
          educationHistory: true,
          workExperiences: true,
          department: true,
          position: true,
          role: true,
          status: true,
          phone: true,
          joinDate: true,
          workLocation: true,
          workType: true,
          managerName: true,
          employmentType: true,
          contractStatus: true,
          contractStart: true,
          contractEnd: true,
          baseSalary: true,
          allowance: true,
          positionSalaryId: true,
          financialComponentIds: true,
          taxProfileId: true,
          taxProfile: true,
          bankName: true,
          bankAccountMasked: true,
          appLoginEnabled: true,
          loginUsername: true,
          loginPassword: true,
          documents: true,
          leaveBalances: true
        }
      });
      const employee = employeeRow ? this.mapPrismaEmployee(employeeRow) : null;
      if (!employee) {
        throw new NotFoundException("Employee not found");
      }
      this.assertSensitiveDocumentAccess(actor, employee, "employee documents");

      const document = employee.documents.find((entry) => entry.id === documentId);
      if (!document) {
        throw new NotFoundException("Employee document not found");
      }
      const absolutePath = this.resolveStoragePath(document.fileUrl);
      if (!existsSync(absolutePath)) {
        throw new NotFoundException("Stored employee document file not found");
      }
      return {
        absolutePath,
        fileName: document.fileName
      };
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    this.assertSensitiveDocumentAccess(actor, employee, "employee documents");

    const document = employee.documents.find((entry) => entry.id === documentId);
    if (!document) {
      throw new NotFoundException("Employee document not found");
    }
    const absolutePath = this.resolveStoragePath(document.fileUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored employee document file not found");
    }
    return {
      absolutePath,
      fileName: document.fileName
    };
  }

  private guessContentType(fileName: string) {
    const extension = path.extname(fileName).toLowerCase();
    if (extension === ".jpg" || extension === ".jpeg") {
      return "image/jpeg";
    }
    if (extension === ".png") {
      return "image/png";
    }
    if (extension === ".webp") {
      return "image/webp";
    }
    if (extension === ".gif") {
      return "image/gif";
    }
    return "application/octet-stream";
  }

  async getAttendanceSelfieAsset(attendanceId: string, actor?: AuthenticatedActor) {
    const cacheKey = this.buildAttendanceSelfieAssetCacheKey(attendanceId, actor);
    const cachedAsset = this.cachedAttendanceSelfieAssets.get(cacheKey);
    if (cachedAsset && cachedAsset.expiresAt > Date.now() && existsSync(cachedAsset.absolutePath)) {
      return {
        absolutePath: cachedAsset.absolutePath,
        fileName: cachedAsset.fileName,
        contentType: cachedAsset.contentType,
        buffer: cachedAsset.buffer
      };
    }

    const prisma = this.getPrisma();
    if (prisma) {
      const attendanceRow = actor?.role === "admin" || actor?.role === "hr"
        ? await prisma.attendanceLog.findUnique({
            where: { id: attendanceId },
            select: {
              id: true,
              photoUrl: true
            }
          })
        : actor?.role === "employee"
          ? await prisma.attendanceLog.findUnique({
              where: { id: attendanceId },
              select: {
                id: true,
                userId: true,
                photoUrl: true
              }
            })
          : await prisma.attendanceLog.findUnique({
              where: { id: attendanceId },
              select: {
                id: true,
                userId: true,
                photoUrl: true,
                employee: {
                  select: {
                    id: true,
                    department: true,
                    managerName: true
                  }
                }
              }
            });
      if (!attendanceRow) {
        throw new NotFoundException("Attendance record not found");
      }

      const attendance = {
        photoUrl: attendanceRow.photoUrl ?? null
      };
      if (!attendance.photoUrl) {
        throw new NotFoundException("Attendance selfie not found");
      }
      if (!actor) {
        throw new ForbiddenException("Session is required to access attendance selfie.");
      }
      if (actor.role === "employee") {
        if (String(attendanceRow.userId) !== actor.id) {
          throw new ForbiddenException("You are not allowed to access attendance selfie.");
        }
      } else if (actor.role === "manager") {
        const employee = "employee" in attendanceRow && attendanceRow.employee
          ? {
              id: String(attendanceRow.employee.id),
              department: String(attendanceRow.employee.department),
              managerName: String(attendanceRow.employee.managerName)
            } as EmployeeRecord
          : undefined;
        this.assertSensitiveDocumentAccess(actor, employee, "attendance selfie");
      }

      const absolutePath = this.resolveStoragePath(attendance.photoUrl);
      if (!existsSync(absolutePath)) {
        throw new NotFoundException("Stored attendance selfie not found");
      }
      const fileName = path.basename(absolutePath);
      const result = {
        absolutePath,
        fileName,
        contentType: this.guessContentType(fileName),
        buffer: await readFile(absolutePath)
      };
      this.cachedAttendanceSelfieAssets.set(cacheKey, {
        ...result,
        expiresAt: Date.now() + ATTENDANCE_SELFIE_ASSET_CACHE_TTL_MS
      });
      return result;
    }

    const db = await this.readDb();
    const attendance = db.attendanceLogs.find((entry) => entry.id === attendanceId);
    if (!attendance) {
      throw new NotFoundException("Attendance record not found");
    }
    if (!attendance.photoUrl) {
      throw new NotFoundException("Attendance selfie not found");
    }
    const employee = db.employees.find((entry) => entry.id === attendance.userId);
    this.assertSensitiveDocumentAccess(actor, employee, "attendance selfie");

    const absolutePath = this.resolveStoragePath(attendance.photoUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored attendance selfie not found");
    }
    return {
      absolutePath,
      fileName: path.basename(absolutePath),
      contentType: this.guessContentType(path.basename(absolutePath)),
      buffer: await readFile(absolutePath)
    };
  }

  async getReimbursementReceiptAsset(reimbursementId: string, actor?: AuthenticatedActor) {
    const prisma = this.getPrisma();
    if (prisma) {
      const requestRow = await prisma.reimbursementRequest.findUnique({
        where: { id: reimbursementId },
        include: {
          employee: true
        }
      });
      if (!requestRow) {
        throw new NotFoundException("Reimbursement request not found");
      }

      const request = this.mapPrismaReimbursementRequest(requestRow);
      if (!request.receiptFileUrl) {
        throw new NotFoundException("Reimbursement receipt not found");
      }
      const employee = requestRow.employee ? this.mapPrismaEmployee(requestRow.employee) : undefined;
      this.assertSensitiveDocumentAccess(actor, employee, "reimbursement receipt");

      const absolutePath = this.resolveStoragePath(request.receiptFileUrl);
      if (!existsSync(absolutePath)) {
        throw new NotFoundException("Stored reimbursement receipt not found");
      }
      return {
        absolutePath,
        fileName: request.receiptFileName ?? path.basename(absolutePath)
      };
    }

    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === reimbursementId);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (!request.receiptFileUrl) {
      throw new NotFoundException("Reimbursement receipt not found");
    }
    const employee = db.employees.find((entry) => entry.id === request.userId);
    this.assertSensitiveDocumentAccess(actor, employee, "reimbursement receipt");

    const absolutePath = this.resolveStoragePath(request.receiptFileUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored reimbursement receipt not found");
    }
    return {
      absolutePath,
      fileName: request.receiptFileName ?? path.basename(absolutePath)
    };
  }

  async getLeaveSupportingDocumentAsset(leaveId: string, actor?: AuthenticatedActor) {
    const prisma = this.getPrisma();
    if (prisma) {
      const leaveRow = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        include: {
          employee: true
        }
      });
      if (!leaveRow) {
        throw new NotFoundException("Leave request not found");
      }

      const leave = this.mapPrismaLeaveRecord(leaveRow);
      if (!leave.supportingDocumentUrl) {
        throw new NotFoundException("Supporting document not found");
      }
      const employee = leaveRow.employee ? this.mapPrismaEmployee(leaveRow.employee) : undefined;
      this.assertSensitiveDocumentAccess(actor, employee, "leave supporting documents");

      const absolutePath = this.resolveStoragePath(leave.supportingDocumentUrl);
      if (!existsSync(absolutePath)) {
        throw new NotFoundException("Stored leave supporting document not found");
      }
      return {
        absolutePath,
        fileName: leave.supportingDocumentName ?? path.basename(absolutePath)
      };
    }

    const db = await this.readDb();
    const leave = db.leaveRequests.find((entry) => entry.id === leaveId);
    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }
    if (!leave.supportingDocumentUrl) {
      throw new NotFoundException("Supporting document not found");
    }
    const employee = db.employees.find((entry) => entry.id === leave.userId);
    this.assertSensitiveDocumentAccess(actor, employee, "leave supporting documents");

    const absolutePath = this.resolveStoragePath(leave.supportingDocumentUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException("Stored leave supporting document not found");
    }
    return {
      absolutePath,
      fileName: leave.supportingDocumentName ?? path.basename(absolutePath)
    };
  }

  private assertEmployeeUniqueness(db: DatabaseShape, candidate: {
    nik: string;
    email: string;
    idCardNumber: string;
    appLoginEnabled: boolean;
    loginUsername: string | null;
  }, existingEmployeeId?: string) {
    const conflicts = db.employees.find((entry) => {
      if (existingEmployeeId && entry.id === existingEmployeeId) {
        return false;
      }
      if (entry.nik.trim().toLowerCase() === candidate.nik.trim().toLowerCase()) {
        return true;
      }
      if (entry.email.trim().toLowerCase() === candidate.email.trim().toLowerCase()) {
        return true;
      }
      if (entry.idCardNumber.trim() === candidate.idCardNumber.trim()) {
        return true;
      }
      if (
        candidate.appLoginEnabled &&
        candidate.loginUsername &&
        entry.appLoginEnabled &&
        entry.loginUsername &&
        entry.loginUsername.trim().toLowerCase() === candidate.loginUsername.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (!conflicts) {
      return;
    }

    if (conflicts.nik.trim().toLowerCase() === candidate.nik.trim().toLowerCase()) {
      throw new BadRequestException("The NIK is already assigned to another employee.");
    }
    if (conflicts.email.trim().toLowerCase() === candidate.email.trim().toLowerCase()) {
      throw new BadRequestException("The email address is already assigned to another employee.");
    }
    if (conflicts.idCardNumber.trim() === candidate.idCardNumber.trim()) {
      throw new BadRequestException("The ID card number is already assigned to another employee.");
    }
    if (
      candidate.appLoginEnabled &&
      candidate.loginUsername &&
      conflicts.appLoginEnabled &&
      conflicts.loginUsername &&
      conflicts.loginUsername.trim().toLowerCase() === candidate.loginUsername.trim().toLowerCase()
    ) {
      throw new BadRequestException("The login username is already assigned to another employee.");
    }
  }

  private assertDepartmentExistsAndActive(db: DatabaseShape, departmentName: string) {
    const normalized = departmentName.trim().toLowerCase();
    const department = db.departments.find((entry) => entry.name.trim().toLowerCase() === normalized);
    if (!department) {
      throw new BadRequestException("The department has not been registered in the master data.");
    }
    if (!department.active) {
      throw new BadRequestException("The department is inactive.");
    }
  }

  private assertManagerAssignment(
    db: DatabaseShape,
    payload: { department: string; managerName: string; employeeId?: string }
  ) {
    const managerName = payload.managerName.trim();
    if (!managerName) {
      return;
    }
    const manager = db.employees.find((entry) =>
      entry.name.trim().toLowerCase() === managerName.toLowerCase() &&
      entry.role === "manager" &&
      entry.status === "active"
    );
    if (!manager) {
      throw new BadRequestException("The assigned manager approver was not found or is inactive.");
    }
    if (manager.department.trim().toLowerCase() !== payload.department.trim().toLowerCase()) {
      throw new BadRequestException("Manager approval harus berasal dari department yang sama.");
    }
    if (payload.employeeId && manager.id === payload.employeeId) {
      throw new BadRequestException("The assigned manager approver cannot be the same employee.");
    }
  }

  private assertManagerApprovalScope(actor: AuthenticatedActor | undefined, employee: EmployeeRecord | undefined) {
    if (!actor || actor.role !== "manager") {
      return;
    }
    if (!employee) {
      throw new NotFoundException("Employee not found for manager approval validation.");
    }
    if (employee.department.trim().toLowerCase() !== actor.department.trim().toLowerCase()) {
      throw new ForbiddenException("Manager can only approve requests within their own department.");
    }
    if (employee.managerName.trim().toLowerCase() !== actor.name.trim().toLowerCase()) {
      throw new ForbiddenException("Manager can only approve employees assigned to them.");
    }
  }

  private toEmployeeSessionPayload(employee: EmployeeRecord): EmployeeSessionPayload {
    return {
      sessionKey: `employee:${employee.id}`,
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      position: employee.position
    };
  }

  private getSessionCookieMaxAgeSeconds() {
    return Math.max(60, Math.floor(this.sessionMaxLifetimeHours * 60 * 60));
  }

  private getSessionIdleTimeoutMs() {
    return this.sessionIdleTimeoutMinutes * 60 * 1000;
  }

  private getSessionTouchIntervalMs() {
    return this.sessionTouchIntervalMinutes * 60 * 1000;
  }

  private getSessionCleanupIntervalMs() {
    return 15 * 60 * 1000;
  }

  private createSessionExpiry(now: Date) {
    return new Date(now.getTime() + this.sessionMaxLifetimeHours * 60 * 60 * 1000);
  }

  private normalizeSessionMetadata(metadata?: SessionRequestMetadata) {
    return {
      ipAddress: metadata?.ipAddress?.trim() || null,
      userAgent: metadata?.userAgent?.trim() || null
    };
  }

  private async cleanupStaleSessions(force = false) {
    const prisma = this.getPrisma();
    if (!prisma) {
      return;
    }

    const now = Date.now();
    if (!force && now - this.lastSessionCleanupAt < this.getSessionCleanupIntervalMs()) {
      return;
    }

    this.lastSessionCleanupAt = now;
    const cutoff = new Date(now - this.getSessionIdleTimeoutMs());
    await prisma.appSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date(now) } },
          { lastActivityAt: { lt: cutoff } },
          { revokedAt: { not: null } }
        ]
      }
    });
  }

  private async revokeSession(sessionId: string, reason: string) {
    const prisma = this.getPrisma();
    if (!prisma) {
      return false;
    }

    const now = new Date();
    const result = await prisma.appSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null
      },
      data: {
        revokedAt: now,
        revocationReason: reason
      }
    });

    if (result.count > 0) {
      await writeSystemLog({
        source: "backend",
        event: "auth.session.revoked",
        level: reason === "logout" ? "info" : "warn",
        details: {
          sessionId,
          reason
        }
      });
      return true;
    }

    return false;
  }

  private async createEmployeeSession(employee: EmployeeRecord, metadata?: SessionRequestMetadata): Promise<EmployeeLoginResult> {
    const prisma = this.getPrisma();
    if (!prisma) {
      throw new Error("Database-backed sessions require Prisma to be enabled.");
    }

    const now = new Date();
    await this.cleanupStaleSessions(true);
    const sessionId = randomUUID();
    const sessionKey = `employee:${employee.id}`;
    const normalizedMetadata = this.normalizeSessionMetadata(metadata);
    const expiresAt = this.createSessionExpiry(now);

    await prisma.appSession.create({
      data: {
        id: sessionId,
        userId: employee.id,
        sessionKey,
        role: employee.role,
        ipAddress: normalizedMetadata.ipAddress,
        userAgent: normalizedMetadata.userAgent,
        createdAt: now,
        lastActivityAt: now,
        expiresAt
      }
    });

    const activeSessions = await prisma.appSession.findMany({
      where: {
        userId: employee.id,
        revokedAt: null,
        expiresAt: { gt: now },
        lastActivityAt: { gte: new Date(now.getTime() - this.getSessionIdleTimeoutMs()) }
      },
      orderBy: [
        { lastActivityAt: "desc" },
        { createdAt: "desc" }
      ],
      select: {
        id: true
      }
    });

    const overflowSessions = activeSessions.slice(this.sessionMaxConcurrentPerUser).map((entry: { id: string }) => entry.id);
    if (overflowSessions.length > 0) {
      await prisma.appSession.updateMany({
        where: {
          id: { in: overflowSessions },
          revokedAt: null
        },
        data: {
          revokedAt: now,
          revocationReason: "concurrent-limit"
        }
      });
      await writeSystemLog({
        source: "backend",
        event: "auth.session.concurrent-limit",
        level: "warn",
        details: {
          employeeId: employee.id,
          sessionIds: overflowSessions,
          limit: this.sessionMaxConcurrentPerUser
        }
      });
    }

    await this.cleanupStaleSessions();
    await writeSystemLog({
      source: "backend",
      event: "auth.session.created",
      details: {
        employeeId: employee.id,
        sessionId,
        role: employee.role,
        expiresAt: expiresAt.toISOString(),
        maxConcurrentSessions: this.sessionMaxConcurrentPerUser
      }
    });

    return {
      sessionId,
      expiresAt: expiresAt.toISOString(),
      maxAgeSeconds: this.getSessionCookieMaxAgeSeconds(),
      idleTimeoutMinutes: this.sessionIdleTimeoutMinutes,
      maxConcurrentSessions: this.sessionMaxConcurrentPerUser,
      user: this.toEmployeeSessionPayload(employee)
    };
  }

  async resolveSessionActor(sessionSubject: string): Promise<AuthenticatedActor | null> {
    const demoUsers: AuthenticatedActor[] = [
      {
        sessionKey: "global-admin",
        id: "admin-001",
        name: "Global Admin",
        email: "admin@praluxstd.com",
        role: "admin",
        department: "Enterprise HQ",
        position: "Platform Owner"
      },
      {
        sessionKey: "elena-hr",
        id: "emp-003",
        name: "Elena Rodriguez",
        email: "e.rodriguez@praluxstd.com",
        role: "hr",
        department: "Logistics & Supply Chain",
        position: "Operations Manager / HR"
      },
      {
        sessionKey: "sarah-manager",
        id: "emp-001",
        name: "Sarah Jenkins",
        email: "s.jenkins@praluxstd.com",
        role: "manager",
        department: "Brand Identity & Strategy",
        position: "Creative Director"
      },
      {
        sessionKey: "james-employee",
        id: "emp-004",
        name: "James Wilson",
        email: "j.wilson@praluxstd.com",
        role: "employee",
        department: "Consumer Insights",
        position: "Product Strategist"
      }
    ];

    const demo = demoUsers.find((entry) => entry.sessionKey === sessionSubject);
    if (demo) {
      return demo;
    }

    const prisma = this.getPrisma();
    if (!prisma) {
      if (!sessionSubject.startsWith("employee:")) {
        return null;
      }

      const employeeId = sessionSubject.replace("employee:", "");
      let session: EmployeeSessionPayload | null = null;
      try {
        session = await this.getEmployeeSession(employeeId);
      } catch {
        session = null;
      }
      if (!session) {
        return null;
      }

      return {
        ...session,
        role: session.role as AuthenticatedActor["role"]
      };
    }

    await this.cleanupStaleSessions();
    const now = new Date();
    const session = await prisma.appSession.findUnique({
      where: { id: sessionSubject },
      include: {
        employee: true
      }
    });

    if (!session) {
      return null;
    }

    if (session.revokedAt) {
      return null;
    }

    if (session.expiresAt.getTime() <= now.getTime()) {
      await this.revokeSession(session.id, "absolute-timeout");
      return null;
    }

    if (session.lastActivityAt.getTime() + this.getSessionIdleTimeoutMs() <= now.getTime()) {
      await this.revokeSession(session.id, "idle-timeout");
      return null;
    }

    if (!session.employee || !session.employee.appLoginEnabled || session.employee.status !== "active") {
      await this.revokeSession(session.id, "employee-disabled");
      return null;
    }

    if (now.getTime() - session.lastActivityAt.getTime() >= this.getSessionTouchIntervalMs()) {
      await prisma.appSession.update({
        where: { id: session.id },
        data: {
          lastActivityAt: now
        }
      });
    }

    const payload = this.toEmployeeSessionPayload({
      ...session.employee,
      birthDate: this.toIsoString(session.employee.birthDate),
      marriageDate: session.employee.marriageDate ? this.toIsoString(session.employee.marriageDate) : null,
      joinDate: this.toDateString(session.employee.joinDate),
      contractStart: this.toDateString(session.employee.contractStart),
      contractEnd: session.employee.contractEnd ? this.toDateString(session.employee.contractEnd) : null,
      educationHistory: Array.isArray(session.employee.educationHistory) ? session.employee.educationHistory as any : [],
      workExperiences: Array.isArray(session.employee.workExperiences) ? session.employee.workExperiences as any : [],
      documents: Array.isArray(session.employee.documents) ? session.employee.documents as any : [],
      leaveBalances: session.employee.leaveBalances as any,
      baseSalary: Number(session.employee.baseSalary),
      allowance: Number(session.employee.allowance),
      financialComponentIds: Array.isArray(session.employee.financialComponentIds) ? session.employee.financialComponentIds : []
    } as EmployeeRecord);

    return {
      ...payload,
      role: payload.role as AuthenticatedActor["role"]
    };
  }

  private inferAuditLogTarget(details: Record<string, unknown>): AuditLogTarget {
    const targetMap = [
      { key: "employeeId", type: "employee" },
      { key: "departmentId", type: "department" },
      { key: "leaveId", type: "leave" },
      { key: "overtimeId", type: "overtime" },
      { key: "reimbursementId", type: "reimbursement" },
      { key: "payRunId", type: "pay-run" }
    ] as const;

    const labels = [
      details.targetLabel,
      details.name,
      details.employeeName,
      details.department,
      details.periodLabel,
      details.claimType
    ];

    for (const candidate of targetMap) {
      const value = details[candidate.key];
      if (typeof value === "string" && value.trim().length > 0) {
        const targetLabel = labels.find((entry) => typeof entry === "string" && entry.trim().length > 0);
        return {
          targetType: candidate.type,
          targetId: value,
          targetLabel: typeof targetLabel === "string" ? targetLabel : null
        };
      }
    }

    return {
      targetType: null,
      targetId: null,
      targetLabel: null
    };
  }

  private toAuditSafeJson(value: unknown) {
    if (value === undefined) {
      return null;
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return {
        serializationError: error instanceof Error ? error.message : "Unknown serialization error"
      };
    }
  }

  private buildAuditSummary(
    eventKey: string,
    moduleName: string,
    actionName: string,
    target: AuditLogTarget,
    actor?: AuthenticatedActor | null,
    details?: Record<string, unknown>
  ) {
    const actorName = actor?.name ?? (typeof details?.actor === "string" ? details.actor : null) ?? "System";
    const readableAction = actionName.replace(/-/g, " ");
    const readableModule = moduleName.replace(/-/g, " ");
    const targetLabel = target.targetLabel ?? target.targetId ?? readableModule;
    return `${actorName} ${readableAction} ${targetLabel}`.trim();
  }

  private mapPrismaAuditLog(record: any, includePayload = true): AuditLogRecord {
    return {
      id: record.id,
      eventKey: record.eventKey,
      module: record.module,
      action: record.action,
      actorUserId: record.actorUserId ?? null,
      actorName: record.actorName ?? null,
      actorRole: record.actorRole ?? null,
      actorDepartment: record.actorDepartment ?? null,
      targetType: record.targetType ?? null,
      targetId: record.targetId ?? null,
      targetLabel: record.targetLabel ?? null,
      summary: record.summary,
      beforeData: includePayload ? record.beforeData ?? null : null,
      afterData: includePayload ? record.afterData ?? null : null,
      metadata: includePayload ? record.metadata ?? null : null,
      ipAddress: record.ipAddress ?? null,
      userAgent: record.userAgent ?? null,
      occurredAt: this.toIsoString(record.occurredAt),
      createdAt: this.toIsoString(record.createdAt ?? record.occurredAt)
    };
  }

  private buildEmployeeNumberFromSequence(sequence: number) {
    return `EMP-2026-${String(Math.max(1, sequence)).padStart(3, "0")}`;
  }

  private getNextEmployeeNumber(previousEmployeeNumber?: string | null) {
    const matchedSequence = previousEmployeeNumber?.match(/(\d+)$/)?.[1];
    const nextSequence = matchedSequence ? Number.parseInt(matchedSequence, 10) + 1 : 1;
    return this.buildEmployeeNumberFromSequence(nextSequence);
  }

  private writeAuditLog(eventKey: string, details: Record<string, unknown>, actor?: AuthenticatedActor | null) {
    this.cachedAuditLogFirstPage.clear();
    this.invalidateReadCaches();
    this.auditQueue = this.auditQueue
      .catch(() => undefined)
      .then(async () => {
      const previousHash = this.lastAuditHash;
      const sequence = this.lastAuditSequence + 1;
      const timestamp = new Date().toISOString();
      const payload = {
        sequence,
        timestamp,
        action: eventKey,
        details
      };
      const entryHash = createHash("sha256")
        .update(JSON.stringify({ previousHash, ...payload }))
        .digest("hex");
      const entry = {
        ...payload,
        previousHash,
        entryHash,
        immutable: true,
        hashAlgorithm: "sha256"
      };
      await appendFile(this.auditLogPath, `${JSON.stringify(entry)}\n`, "utf8");
      this.lastAuditSequence = sequence;
      this.lastAuditHash = entryHash;

      const prisma = this.getPrisma();
      if (prisma?.auditLog?.create) {
        const [moduleName, ...actionParts] = eventKey.split(".");
        const actionName = actionParts.join(".") || "event";
        const target = this.inferAuditLogTarget(details);
        const metadata = this.toAuditSafeJson(details);
        const actorName = actor?.name ?? (typeof details.actor === "string" ? details.actor : null);
        const actorRole = actor?.role ?? (typeof details.actorRole === "string" ? details.actorRole : null);
        const actorDepartment = actor?.department ?? (typeof details.actorDepartment === "string" ? details.actorDepartment : null);
        const ipAddress = typeof details.ipAddress === "string" ? details.ipAddress : null;
        const userAgent = typeof details.userAgent === "string" ? details.userAgent : null;

        try {
          await prisma.auditLog.create({
            data: {
              id: `audit-${randomUUID().slice(0, 12)}`,
              eventKey,
              module: moduleName || "system",
              action: actionName,
              actorUserId: actor?.id ?? null,
              actorName,
              actorRole,
              actorDepartment,
              targetType: target.targetType,
              targetId: target.targetId,
              targetLabel: target.targetLabel,
              summary: this.buildAuditSummary(eventKey, moduleName || "system", actionName, target, actor, details),
              beforeData: null,
              afterData: null,
              metadata,
              ipAddress,
              userAgent,
              occurredAt: new Date(timestamp)
            }
          });
        } catch (error) {
          await writeSystemLog({
            source: "backend",
            event: "audit.persist-failed",
            level: "error",
            details: {
              eventKey,
              error: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
    })
      .catch(async (error) => {
        await writeSystemLog({
          source: "backend",
          event: "audit.queue-failed",
          level: "error",
          details: {
            eventKey,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      });
  }

  private invalidateReadCaches() {
    this.cachedDashboardSummary = null;
    this.cachedEmployeeFirstPage.clear();
    this.cachedPayslipFirstPage.clear();
    this.cachedPayrollOverview = null;
    this.cachedPayrollComponents = null;
    this.cachedPayRuns = null;
    this.cachedAttendanceToday = null;
    this.cachedAttendanceOverview = null;
    this.cachedAttendanceSelfieAssets.clear();
  }

  private buildEmployeeFirstPageCacheKey(query: EmployeeListQueryDto | undefined, actor: AuthenticatedActor | undefined) {
    const actorScope = actor?.role === "employee" ? `employee:${actor.id}` : "all";
    return `${actorScope}:${query?.pageSize ?? ""}`;
  }

  private buildPayslipFirstPageCacheKey(query: PayslipListQueryDto | undefined) {
    return `${query?.userId ?? "all"}:${query?.pageSize ?? ""}`;
  }

  private buildAttendanceSelfieAssetCacheKey(attendanceId: string, actor: AuthenticatedActor | undefined) {
    if (!actor) {
      return `anonymous:${attendanceId}`;
    }
    if (actor.role === "admin" || actor.role === "hr") {
      return `${actor.role}:${attendanceId}`;
    }
    return `${actor.role}:${actor.id}:${attendanceId}`;
  }

  private async getCurrentDatabaseHealth(maxAgeMs = HEALTH_DATABASE_CACHE_TTL_MS) {
    if (this.lastKnownDatabaseHealth && Date.now() - this.lastKnownDatabaseHealth.checkedAt <= maxAgeMs) {
      return this.lastKnownDatabaseHealth.result;
    }

    const result = await this.databaseService.healthcheck();
    this.lastKnownDatabaseHealth = {
      checkedAt: Date.now(),
      result
    };
    return result;
  }

  private getTodayRangeUtc() {
    const dayKey = new Date().toISOString().slice(0, 10);
    return {
      dayKey,
      start: new Date(`${dayKey}T00:00:00.000Z`),
      end: new Date(`${dayKey}T23:59:59.999Z`)
    };
  }

  private safeFileBaseName(input: string, fallback: string) {
    const normalized = input
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();
    return normalized.length > 0 ? normalized : fallback;
  }

  private async ensureEmployeePasswordsHashed(db: DatabaseShape) {
    let changed = false;

    for (const employee of db.employees) {
      if (!employee.appLoginEnabled || !employee.loginPassword) {
        continue;
      }

      if (!isPasswordHash(employee.loginPassword)) {
        employee.loginPassword = await hashPassword(employee.loginPassword);
        changed = true;
      }
    }

    return changed;
  }

  private async ensurePrismaEmployeePasswordsHashed() {
    const prisma = this.getPrisma();
    if (!prisma) {
      return false;
    }

    const employees = await prisma.employee.findMany({
      where: {
        appLoginEnabled: true,
        loginPassword: {
          not: null
        }
      },
      select: {
        id: true,
        loginPassword: true
      }
    });

    let changed = false;
    for (const employee of employees) {
      if (!employee.loginPassword || isPasswordHash(employee.loginPassword)) {
        continue;
      }

      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          loginPassword: await hashPassword(employee.loginPassword)
        }
      });
      changed = true;
    }

    return changed;
  }

  private async persistSnapshotToDatabase(next: DatabaseShape) {
    const prisma = this.getPrisma();
    if (!prisma) {
      return;
    }

    const existingSessions = await prisma.appSession.findMany({
      select: {
        id: true,
        userId: true,
        sessionKey: true,
        role: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastActivityAt: true,
        expiresAt: true,
        revokedAt: true,
        revocationReason: true
      }
    });

    const departmentRows = next.departments.map((department) => ({
      id: department.id,
      name: department.name,
      active: department.active,
      createdAt: this.toDate(department.createdAt) ?? new Date(),
      updatedAt: this.toDate(department.updatedAt) ?? new Date()
    }));

    const employeeRows = next.employees.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      nik: employee.nik,
      name: employee.name,
      email: employee.email,
      birthPlace: employee.birthPlace,
      birthDate: this.toDateOnly(employee.birthDate) ?? new Date(),
      gender: employee.gender,
      maritalStatus: employee.maritalStatus,
      marriageDate: this.toDateOnly(employee.marriageDate),
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
      joinDate: this.toDateOnly(employee.joinDate) ?? new Date(),
      workLocation: employee.workLocation,
      workType: employee.workType,
      managerName: employee.managerName,
      employmentType: employee.employmentType,
      contractStatus: employee.contractStatus,
      contractStart: this.toDateOnly(employee.contractStart) ?? new Date(),
      contractEnd: this.toDateOnly(employee.contractEnd),
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
    }));

    const taxProfileRows = next.taxProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      rate: profile.rate,
      active: profile.active,
      description: profile.description
    }));

    const compensationProfileRows = next.compensationProfiles.map((profile) => ({
      id: profile.id,
      position: profile.position,
      baseSalary: profile.baseSalary,
      active: profile.active,
      notes: profile.notes
    }));

    const payrollComponentRows = next.payrollComponents.map((component) => ({
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
    }));

    const payRunRows = next.payRuns.map((run) => ({
      id: run.id,
      periodLabel: run.periodLabel,
      periodStart: this.toDateOnly(run.periodStart) ?? new Date(),
      periodEnd: this.toDateOnly(run.periodEnd) ?? new Date(),
      payDate: this.toDateOnly(run.payDate) ?? new Date(),
      status: run.status,
      totalGross: run.totalGross,
      totalNet: run.totalNet,
      totalTax: run.totalTax,
      employeeCount: run.employeeCount,
      createdAt: this.toDate(run.createdAt) ?? new Date(),
      publishedAt: this.toDate(run.publishedAt)
    }));

    const reimbursementClaimTypeRows = next.reimbursementClaimTypes.map((claimType) => ({
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
      createdAt: this.toDate(claimType.createdAt) ?? new Date(),
      updatedAt: this.toDate(claimType.updatedAt) ?? new Date()
    }));

    const attendanceRows = next.attendanceLogs.map((record) => ({
      id: record.id,
      userId: record.userId,
      employeeName: record.employeeName,
      department: record.department,
      timestamp: this.toDate(record.timestamp) ?? new Date(),
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
    }));

    const overtimeRows = next.overtimeRequests.map((record) => ({
      id: record.id,
      userId: record.userId,
      employeeName: record.employeeName,
      department: record.department,
      date: this.toDateOnly(record.date) ?? new Date(),
      minutes: record.minutes,
      reason: record.reason,
      status: record.status
    }));

    const leaveRows = next.leaveRequests.map((record) => ({
      id: record.id,
      userId: record.userId,
      employeeName: record.employeeName,
      type: record.type,
      startDate: this.toDateOnly(record.startDate) ?? new Date(),
      endDate: this.toDateOnly(record.endDate) ?? new Date(),
      reason: record.reason,
      status: record.status,
      approverFlow: record.approverFlow,
      balanceLabel: record.balanceLabel,
      requestedAt: this.toDate(record.requestedAt) ?? new Date(),
      daysRequested: record.daysRequested,
      autoApproved: record.autoApproved,
      supportingDocumentName: record.supportingDocumentName,
      supportingDocumentUrl: record.supportingDocumentUrl
    }));

    const payslipRows = next.payslips.map((slip) => ({
      id: slip.id,
      payRunId: slip.payRunId,
      userId: slip.userId,
      employeeName: slip.employeeName,
      employeeNumber: slip.employeeNumber,
      department: slip.department,
      position: slip.position,
      periodLabel: slip.periodLabel,
      periodStart: this.toDateOnly(slip.periodStart) ?? new Date(),
      periodEnd: this.toDateOnly(slip.periodEnd) ?? new Date(),
      payDate: this.toDateOnly(slip.payDate) ?? new Date(),
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
    }));

    const reimbursementRequestRows = next.reimbursementRequests.map((request) => ({
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
      receiptDate: this.toDateOnly(request.receiptDate) ?? new Date(),
      remarks: request.remarks,
      receiptFileName: request.receiptFileName,
      receiptFileUrl: request.receiptFileUrl,
      status: request.status,
      submittedAt: this.toDate(request.submittedAt),
      approvedAt: this.toDate(request.approvedAt),
      processedAt: this.toDate(request.processedAt),
      createdAt: this.toDate(request.createdAt) ?? new Date(),
      updatedAt: this.toDate(request.updatedAt) ?? new Date(),
      approverFlow: request.approverFlow,
      balanceSnapshot: request.balanceSnapshot
    }));

    const employeeIds = new Set(employeeRows.map((row) => String(row.id)));
    const payRunIds = new Set(payRunRows.map((row) => String(row.id)));
    const validAttendanceRows = attendanceRows.filter((row) => employeeIds.has(String(row.userId)));
    const validOvertimeRows = overtimeRows.filter((row) => employeeIds.has(String(row.userId)));
    const validLeaveRows = leaveRows.filter((row) => employeeIds.has(String(row.userId)));
    const validPayslipRows = payslipRows.filter(
      (row) => employeeIds.has(String(row.userId)) && payRunIds.has(String(row.payRunId))
    );
    const validReimbursementClaimTypeRows = reimbursementClaimTypeRows.filter((row) => employeeIds.has(String(row.employeeId)));
    const claimTypeIds = new Set(validReimbursementClaimTypeRows.map((row) => String(row.id)));
    const validReimbursementRequestRows = reimbursementRequestRows.filter(
      (row) => employeeIds.has(String(row.userId)) && claimTypeIds.has(String(row.claimTypeId))
    );
    const validSessionRows = existingSessions.filter((session: {
      userId: string;
    }) => employeeIds.has(String(session.userId)));

    await prisma.$transaction(async (tx: any) => {
      // Delete children first so parent removals never rely on broad cascade truncation.
      await this.syncRowsById(tx, "reimbursementRequest", validReimbursementRequestRows, true);
      await this.syncRowsById(tx, "payslip", validPayslipRows, true);
      await this.syncRowsById(tx, "leaveRequest", validLeaveRows, true);
      await this.syncRowsById(tx, "overtimeRequest", validOvertimeRows, true);
      await this.syncRowsById(tx, "attendanceLog", validAttendanceRows, true);
      await this.syncRowsById(tx, "appSession", validSessionRows, true);
      await this.syncRowsById(tx, "reimbursementClaimType", validReimbursementClaimTypeRows, true);
      await this.syncRowsById(tx, "payRun", payRunRows, true);
      await this.syncRowsById(tx, "payrollComponent", payrollComponentRows, true);
      await this.syncRowsById(tx, "compensationProfile", compensationProfileRows, true);
      await this.syncRowsById(tx, "taxProfile", taxProfileRows, true);
      await this.syncRowsById(tx, "employee", employeeRows, true);
      await this.syncRowsById(tx, "department", departmentRows, true);

      // Upsert parents first, then dependents.
      await this.syncRowsById(tx, "department", departmentRows, false);
      await this.syncRowsById(tx, "employee", employeeRows, false);
      await this.syncRowsById(tx, "taxProfile", taxProfileRows, false);
      await this.syncRowsById(tx, "compensationProfile", compensationProfileRows, false);
      await this.syncRowsById(tx, "payrollComponent", payrollComponentRows, false);
      await this.syncRowsById(tx, "payRun", payRunRows, false);
      await this.syncRowsById(tx, "reimbursementClaimType", validReimbursementClaimTypeRows, false);
      await this.syncRowsById(tx, "attendanceLog", validAttendanceRows, false);
      await this.syncRowsById(tx, "overtimeRequest", validOvertimeRows, false);
      await this.syncRowsById(tx, "leaveRequest", validLeaveRows, false);
      await this.syncRowsById(tx, "payslip", validPayslipRows, false);
      await this.syncRowsById(tx, "reimbursementRequest", validReimbursementRequestRows, false);
      await this.syncRowsById(tx, "appSession", validSessionRows, false);
    });
  }

  private async syncRowsById(
    tx: any,
    delegateName: string,
    rows: Array<Record<string, unknown>>,
    deleteMissing: boolean
  ) {
    const delegate = tx[delegateName];
    if (!delegate) {
      return;
    }

    if (deleteMissing) {
      const ids = rows.map((row) => String(row.id));
      if (ids.length === 0) {
        await delegate.deleteMany();
        return;
      }
      await delegate.deleteMany({
        where: {
          id: {
            notIn: ids
          }
        }
      });
      return;
    }

    for (const row of rows) {
      const { id, ...data } = row;
      await delegate.upsert({
        where: { id },
        update: data,
        create: row
      });
    }
  }

  private getRadius(location: string) {
    return siteDirectory[location]?.radiusMeters ?? 150;
  }

  private measureDistanceMeters(location: string, latitude: number, longitude: number) {
    const site = siteDirectory[location];
    if (!site) {
      return 999;
    }

    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(site.latitude - latitude);
    const dLon = toRadians(site.longitude - longitude);
    const lat1 = toRadians(latitude);
    const lat2 = toRadians(site.latitude);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(earthRadius * c);
  }

  private parseClock(time: string) {
    const [hour, minute] = time.split(":").map((item) => Number(item));
    return { hour, minute };
  }

  private formatClock(date: Date) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  private calculateLeaveDays(startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    return Math.max(1, diff + 1);
  }

  private getRequestedDays(type: LeaveType, startDate: string, endDate: string) {
    if (type === "Half Day Leave") {
      return 0.5;
    }
    return this.calculateLeaveDays(startDate, endDate);
  }


  private buildOnDutyAttendanceRecords(employee: EmployeeRecord, leave: LeaveRecord, existing: AttendanceRecord[]) {
    const location = leave.type === "Remote Work" ? "Remote - Yogyakarta" : employee.workLocation;
    
    const site = siteDirectory[location] ?? siteDirectory["Jakarta HQ"];
    const records: AttendanceRecord[] = [];
    const start = new Date(`${leave.startDate}T00:00:00`);
    const end = new Date(`${leave.endDate}T00:00:00`);

    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, "0");
      const day = String(cursor.getDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;
      const alreadyExists = existing.some((entry) => entry.userId === employee.id && entry.timestamp.slice(0, 10) === dateKey);
      if (alreadyExists) {
        continue;
      }

      const timestamp = new Date(`${dateKey}T08:00:00.000Z`).toISOString();
      records.push({
        id: `att-${randomUUID().slice(0, 8)}`,
        userId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        timestamp,
        checkIn: NON_SHIFT_START,
        checkOut: NON_SHIFT_END,
        location,
        latitude: site.latitude,
        longitude: site.longitude,
        description: leave.reason,
        gpsValidated: true,
        gpsDistanceMeters: 0,
        photoUrl: null,
        status: "on-time",
        overtimeMinutes: 0
      });
    }

    return records;
  }

  private normalizeLeaveBalances(raw?: Partial<EmployeeRecord["leaveBalances"]>) {
    const balanceYear = Number(raw?.balanceYear ?? currentBalanceYear);
    const allocations = Array.isArray(raw?.allocations)
      ? raw.allocations.map((allocation, index) => this.normalizeLeaveAllocation(allocation as Partial<LeaveBalanceAllocation>, index))
      : this.normalizeLegacyLeaveAllocations(raw as Record<string, unknown> | undefined);

    const normalized: EmployeeRecord["leaveBalances"] = {
      allocations,
      sickUsed: Number(raw?.sickUsed ?? 0),
      balanceYear
    };

    if (normalized.balanceYear < currentBalanceYear) {
      normalized.allocations = (normalized.allocations ?? []).map((allocation) => ({
        ...allocation,
        carryOver: normalized.balanceYear === currentBalanceYear - 1 ? Number(allocation.days ?? 0) : 0,
        carryOverExpiresAt: normalized.balanceYear === currentBalanceYear - 1 ? `${currentBalanceYear}-12-31` : null,
        days: 0
      }));
      normalized.balanceYear = currentBalanceYear;
    }

    return normalized;
  }

  private normalizeLegacyLeaveAllocations(raw?: Record<string, unknown>) {
    const legacySource = raw ?? {};
    const enabledTypes = Array.isArray(legacySource.enabledTypes)
      ? legacySource.enabledTypes.map((value) => String(value))
      : null;
    const allocations = legacyLeaveAllocationTemplates
      .map((template, index) => {
        const days = Number(legacySource[template.legacyKey] ?? template.defaultDays);
        const carryOver = Number(legacySource[`${template.legacyKey}CarryOver`] ?? 0);
        const enabled = enabledTypes ? enabledTypes.includes(template.legacyKey) : days > 0 || carryOver > 0;
        if (!enabled) {
          return null;
        }
        return this.normalizeLeaveAllocation({
          code: template.code,
          label: template.label,
          days,
          carryOver,
          carryOverExpiresAt: legacySource[`${template.legacyKey}CarryOverExpiresAt`] == null ? null : String(legacySource[`${template.legacyKey}CarryOverExpiresAt`])
        }, index);
      })
      .filter((allocation): allocation is LeaveBalanceAllocation => allocation !== null);

    if (allocations.length > 0) {
      return allocations;
    }

    return [
      this.normalizeLeaveAllocation({
        code: "annual-leave",
        label: "Annual Leave",
        days: 12,
        carryOver: 0,
        carryOverExpiresAt: null
      }, 0)
    ];
  }

  private normalizeLeaveAllocation(raw: Partial<LeaveBalanceAllocation>, index: number): LeaveBalanceAllocation {
    const label = String(raw.label ?? `Leave Type ${index + 1}`).trim() || `Leave Type ${index + 1}`;
    return {
      code: this.leaveTypeCode(String(raw.code ?? label)),
      label,
      days: Number(raw.days ?? 0),
      carryOver: Number(raw.carryOver ?? 0),
      carryOverExpiresAt: raw.carryOverExpiresAt == null ? null : String(raw.carryOverExpiresAt)
    };
  }

  private leaveTypeCode(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "leave-type";
  }

  private normalizeLeaveTypeLabel(type: LeaveType) {
    switch (type) {
      case "Leave Request":
        return "Annual Leave";
      case "Sick Leave":
        return "Sick Submission";
      case "Permission":
        return "Half Day Leave";
      case "Remote Work":
        return "On Duty Request";
      default:
        return type;
    }
  }

  private isOnDutyLeaveType(type: LeaveType) {
    return type === "On Duty Request" || type === "Remote Work";
  }

  private isSickLeaveType(type: LeaveType) {
    return type === "Sick Submission" || type === "Sick Leave";
  }

  private isHalfDayLeaveType(type: LeaveType) {
    return type === "Half Day Leave" || type === "Permission";
  }

  private findLeaveAllocation(balances: EmployeeRecord["leaveBalances"], type: LeaveType) {
    const normalizedLabel = this.normalizeLeaveTypeLabel(type);
    const typeCode = this.leaveTypeCode(normalizedLabel);
    return (balances.allocations ?? []).find((allocation) =>
      this.leaveTypeCode(allocation.code) === typeCode || this.leaveTypeCode(allocation.label) === typeCode
    ) ?? null;
  }

  private availableLeaveBalance(allocation: LeaveBalanceAllocation | null | undefined) {
    if (!allocation) {
      return 0;
    }
    return Number((allocation.days + allocation.carryOver).toFixed(1));
  }

  private consumeLeaveBalance(allocation: LeaveBalanceAllocation, amount: number) {
    const availableCarry = Number(allocation.carryOver ?? 0);
    const remaining = Math.max(0, amount - availableCarry);
    allocation.carryOver = Math.max(0, Number((availableCarry - amount).toFixed(1)));
    allocation.days = Math.max(0, Number((allocation.days - remaining).toFixed(1)));
  }

  private describeBalance(employee: EmployeeRecord | undefined, type: LeaveType, daysRequested: number) {
    if (!employee) {
      return `${daysRequested} day request`;
    }
    if (this.isSickLeaveType(type)) {
      return `Sick submission recorded for ${daysRequested} day(s)`;
    }
    if (this.isOnDutyLeaveType(type)) {
      return `Policy-based workflow, ${daysRequested} day request`;
    }

    const allocation = this.findLeaveAllocation(employee.leaveBalances, this.isHalfDayLeaveType(type) ? "Annual Leave" : type);
    if (!allocation) {
      return `${this.normalizeLeaveTypeLabel(type)} requested for ${daysRequested} day(s)`;
    }

    const requestedText = this.isHalfDayLeaveType(type) ? "0.5" : String(daysRequested);
    return `${allocation.label} ${this.availableLeaveBalance(allocation)} days available, ${requestedText} requested`;
  }

  private applyLeaveBalance(employee: EmployeeRecord, type: LeaveType, daysRequested: number) {
    if (this.isSickLeaveType(type)) {
      employee.leaveBalances.sickUsed = Number((employee.leaveBalances.sickUsed + daysRequested).toFixed(1));
      return;
    }
    if (this.isOnDutyLeaveType(type)) {
      return;
    }

    const allocation = this.findLeaveAllocation(employee.leaveBalances, this.isHalfDayLeaveType(type) ? "Annual Leave" : type);
    if (allocation) {
      this.consumeLeaveBalance(allocation, daysRequested);
    }
  }

  private leaveBalanceLabelAfterApproval(employee: EmployeeRecord | undefined, type: LeaveType) {
    if (!employee) {
      return "Balance updated";
    }
    if (this.isSickLeaveType(type)) {
      return `${employee.leaveBalances.sickUsed} sick leave use(s) recorded`;
    }
    if (this.isOnDutyLeaveType(type)) {
      return "Policy-based confirmed";
    }

    const allocation = this.findLeaveAllocation(employee.leaveBalances, this.isHalfDayLeaveType(type) ? "Annual Leave" : type);
    if (!allocation) {
      return "Balance updated";
    }
    return `${this.availableLeaveBalance(allocation)} ${allocation.label.toLowerCase()} days remaining`;
  }

  private getTaxRate(profile: string, taxProfiles: TaxProfileRecord[], taxProfileId?: string | null) {
    const selectedProfile = taxProfileId ? taxProfiles.find((entry) => entry.id === taxProfileId) : null;
    if (selectedProfile) {
      return selectedProfile.rate / 100;
    }
    const normalized = profile.toUpperCase();
    if (normalized.includes("K/0")) {
      return 0.06;
    }
    if (normalized.includes("TK/1")) {
      return 0.045;
    }
    if (normalized.includes("TK/0")) {
      return 0.05;
    }
    return 0.05;
  }

  private calculateOvertimePay(baseSalary: number, minutes: number) {
    const hourlyRate = baseSalary / 173;
    const minuteRate = hourlyRate / 60;
    return Math.round(minuteRate * minutes * 1.5);
  }

  private resolvePayrollComponents(components: PayrollComponentRecord[], employeeId: string) {
    return components.filter((component) => component.active && (component.appliesToAll || component.employeeIds.includes(employeeId)));
  }
  private buildPayslip(employee: EmployeeRecord, db: DatabaseShape, payload: GeneratePayrollRunDto, payRunId: string): PayslipRecord {
    const overtimeMinutes = db.overtimeRequests
      .filter((entry) => entry.userId === employee.id && ["approved", "paid"].includes(entry.status) && entry.date >= payload.periodStart && entry.date <= payload.periodEnd)
      .reduce((total, entry) => total + entry.minutes, 0);
    const overtimePay = this.calculateOvertimePay(employee.baseSalary, overtimeMinutes);
    const components = employee.financialComponentIds.length > 0
      ? db.payrollComponents.filter((component) => component.active && employee.financialComponentIds.includes(component.id))
      : this.resolvePayrollComponents(db.payrollComponents, employee.id);

    const lineItems: PayslipLineItem[] = [
      { code: "BASE", name: "Base Salary", type: "earning", amount: employee.baseSalary, taxable: true, source: "base-salary" }
    ];

    if (overtimePay > 0) {
      lineItems.push({ code: "OVERTIME", name: "Overtime Pay", type: "earning", amount: overtimePay, taxable: true, source: "overtime" });
    }

    for (const component of components) {
      const amount = component.calculationType === "percentage"
        ? Math.round(employee.baseSalary * ((component.percentage ?? 0) / 100))
        : component.amount;
      lineItems.push({
        code: component.code,
        name: component.name,
        type: component.type,
        amount,
        taxable: component.taxable,
        source: "component"
      });
    }

    const earningLines = lineItems.filter((entry) => entry.type === "earning");
    const deductionLines = lineItems.filter((entry) => entry.type === "deduction");
    const grossPay = earningLines.reduce((sum, entry) => sum + entry.amount, 0);
    const taxableBase = lineItems.filter((entry) => entry.taxable && entry.type === "earning").reduce((sum, entry) => sum + entry.amount, 0);
      const taxDeduction = Math.round(taxableBase * this.getTaxRate(employee.taxProfile, db.taxProfiles, employee.taxProfileId));
      const otherDeductions = deductionLines.reduce((sum, entry) => sum + entry.amount, 0);
      const additionalEarnings = Math.max(0, grossPay - employee.baseSalary - overtimePay);
      const netPay = grossPay - otherDeductions - taxDeduction;
      lineItems.push({ code: "PPH21", name: "PPh 21", type: "deduction", amount: taxDeduction, taxable: false, source: "tax" });

    return {
      id: `payslip-${randomUUID().slice(0, 8)}`,
      payRunId,
      userId: employee.id,
      employeeName: employee.name,
      employeeNumber: employee.employeeNumber,
      department: employee.department,
      position: employee.position,
      periodLabel: payload.periodLabel,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      payDate: payload.payDate,
      status: "draft",
      baseSalary: employee.baseSalary,
      allowance: lineItems.filter((entry) => entry.source === "component" && entry.type === "earning").reduce((sum, entry) => sum + entry.amount, 0),
      overtimePay,
      additionalEarnings,
      grossPay,
      taxDeduction,
      otherDeductions,
      netPay,
      bankName: employee.bankName,
      bankAccountMasked: employee.bankAccountMasked,
      taxProfile: employee.taxProfile,
      components: lineItems,
      generatedFileUrl: null
    };
  }

  private buildPayslipExportContent(payslip: PayslipRecord) {
    const lines = [
      `Payslip: ${payslip.periodLabel}`,
      `Employee: ${payslip.employeeName} (${payslip.employeeNumber})`,
      `Department: ${payslip.department}`,
      `Position: ${payslip.position}`,
      `Pay Date: ${payslip.payDate}`,
      `Bank: ${payslip.bankName} ${payslip.bankAccountMasked}`,
      "",
      "Components:"
    ];

    for (const line of payslip.components) {
      lines.push(`- ${line.name} [${line.type}]: ${line.amount}`);
    }

    lines.push("");
    lines.push(`Gross: ${payslip.grossPay}`);
    lines.push(`Tax: ${payslip.taxDeduction}`);
    lines.push(`Other Deductions: ${payslip.otherDeductions}`);
    lines.push(`Net: ${payslip.netPay}`);
    return lines.join("\n");
  }

  private findReimbursementClaimType(db: DatabaseShape, claimTypeId: string) {
    return db.reimbursementClaimTypes.find((entry) => entry.id === claimTypeId && entry.active);
  }

  private removeStoredFile(fileUrl: string | null) {
    if (!fileUrl) {
      return;
    }
    const fullPath = path.join(this.storageRoot, fileUrl.replace(/^\/storage\//, "").replace(/\//g, path.sep));
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  private applyReimbursementClaimDetails(
    request: ReimbursementRequestRecord,
    claimType: ReimbursementClaimTypeRecord,
    amount: number,
    receiptDate: string,
    currency: string,
    remarks: string
  ) {
    request.claimTypeId = claimType.id;
    request.claimType = claimType.claimType;
    request.subType = claimType.subType;
    request.category = claimType.category;
    request.currency = currency;
    request.amount = amount;
    request.receiptDate = receiptDate;
    request.remarks = remarks;
    request.balanceSnapshot = claimType.remainingBalance;
  }

  private parseBooleanFlag(value: unknown) {
    if (value === true || value === 1 || value === "1") {
      return true;
    }
    if (typeof value === "string") {
      return value.trim().toLowerCase() === "true";
    }
    return false;
  }

  private mapPrismaAuditLogListRecord(record: any): AuditLogRecord {
    return {
      id: record.id,
      eventKey: record.eventKey,
      module: record.module,
      action: record.action,
      actorName: record.actorName ?? null,
      actorRole: record.actorRole ?? null,
      actorDepartment: record.actorDepartment ?? null,
      targetType: record.targetType ?? null,
      targetId: record.targetId ?? null,
      targetLabel: record.targetLabel ?? null,
      summary: record.summary,
      ipAddress: record.ipAddress ?? null,
      occurredAt: this.toIsoString(record.occurredAt)
    } as AuditLogRecord;
  }

  async health(includeStats = false) {
    const database = includeStats
      ? await this.getCurrentDatabaseHealth()
      : this.lastKnownDatabaseHealth?.result ?? {
          enabled: this.databaseService.isEnabled(),
          status: this.databaseService.isEnabled() ? "unknown" : "not-configured"
        };
    if (!includeStats) {
      return {
        status: database.status === "offline" ? "degraded" : "ok",
        timestamp: new Date().toISOString(),
        services: {
          api: "online",
          database,
          storageMode: this.databaseService.getModeLabel(),
          uptimeSeconds: Math.round(process.uptime())
        }
      };
    }

    const prisma = this.getPrisma();
    const now = Date.now();
    let services = this.cachedHealthStats && this.cachedHealthStats.expiresAt > now
      ? this.cachedHealthStats.services
      : null;

    if (!services) {
      const db = prisma
        ? await Promise.all([
            prisma.employee.count(),
            prisma.attendanceLog.count(),
            prisma.overtimeRequest.count(),
            prisma.leaveRequest.count(),
            prisma.reimbursementClaimType.count(),
            prisma.reimbursementRequest.count(),
            prisma.payrollComponent.count(),
            prisma.payRun.count(),
            prisma.payslip.count()
          ])
        : null;

      const localDb = db ? null : await this.readDb();
      services = {
        api: "online",
        database,
        storage: this.storageRoot,
        employees: db ? db[0] : localDb!.employees.length,
        attendanceLogs: db ? db[1] : localDb!.attendanceLogs.length,
        overtimeRequests: db ? db[2] : localDb!.overtimeRequests.length,
        leaveRequests: db ? db[3] : localDb!.leaveRequests.length,
        reimbursementClaimTypes: db ? db[4] : localDb!.reimbursementClaimTypes.length,
        reimbursementRequests: db ? db[5] : localDb!.reimbursementRequests.length,
        payrollComponents: db ? db[6] : localDb!.payrollComponents.length,
        payRuns: db ? db[7] : localDb!.payRuns.length,
        payslips: db ? db[8] : localDb!.payslips.length
      };
      this.cachedHealthStats = {
        services: {
          ...services
        },
        expiresAt: now + HEALTH_STATS_CACHE_TTL_MS
      };
    } else {
      services = {
        ...services,
        database
      };
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      services
    };
  }

  getExportQueueMetrics() {
    const queued = this.exportQueue.filter((entry) => entry.status === "queued").length;
    const processing = this.exportQueue.filter((entry) => entry.status === "processing").length;
    const failed = this.exportQueue.filter((entry) => entry.status === "failed").length;
    const done = this.exportQueue.filter((entry) => entry.status === "done").length;
    return {
      total: this.exportQueue.length,
      queued,
      processing,
      failed,
      done,
      activeWorker: this.activeExportJob
    };
  }

  async getDashboardSummary() {
    const prisma = this.getPrisma();

    if (prisma) {
      if (this.cachedDashboardSummary && this.cachedDashboardSummary.expiresAt > Date.now()) {
        return this.cachedDashboardSummary.value;
      }

      const [employees, onTime, late, absent, leavePending] = await Promise.all([
        prisma.employee.count(),
        prisma.attendanceLog.count({ where: { status: "on-time" } }),
        prisma.attendanceLog.count({ where: { status: "late" } }),
        prisma.attendanceLog.count({ where: { status: "absent" } }),
        prisma.leaveRequest.count({ where: { status: { not: "approved" } } })
      ]);

      const summary = {
        employees,
        onTime,
        late,
        absent,
        leavePending,
        storageMode: this.databaseService.getModeLabel()
      };
      this.cachedDashboardSummary = {
        expiresAt: Date.now() + DASHBOARD_SUMMARY_CACHE_TTL_MS,
        value: summary
      };
      return summary;
    }

    const db = await this.readDb();
    const onTime = db.attendanceLogs.filter((log) => log.status === "on-time").length;
    const late = db.attendanceLogs.filter((log) => log.status === "late").length;
    const absent = db.attendanceLogs.filter((log) => log.status === "absent").length;
    return {
      employees: db.employees.length,
      onTime,
      late,
      absent,
      leavePending: db.leaveRequests.filter((leave) => leave.status !== "approved").length,
      storageMode: this.databaseService.getModeLabel()
    };
  }

  async getAuditLogs(query?: AuditLogListQueryDto) {
    const shouldPaginate = Boolean(
      query?.page ||
      query?.pageSize ||
      query?.search ||
      query?.module ||
      query?.eventKey ||
      query?.actorUserId ||
      query?.actorRole ||
      query?.targetType ||
      query?.startDate ||
      query?.endDate
    );
    const prisma = this.getPrisma();

    if (prisma) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const startDate = this.toDate(query?.startDate);
      const endDate = this.toDate(query?.endDate);
      const occurredAt: Record<string, Date> = {};
      if (startDate) {
        occurredAt.gte = startDate;
      }
      if (endDate) {
        occurredAt.lte = endDate;
      }

      const where: Record<string, unknown> = {
        ...(query?.module ? { module: query.module } : {}),
        ...(query?.eventKey ? { eventKey: query.eventKey } : {}),
        ...(query?.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query?.actorRole ? { actorRole: query.actorRole } : {}),
        ...(query?.targetType ? { targetType: query.targetType } : {}),
        ...(Object.keys(occurredAt).length > 0 ? { occurredAt } : {})
      };

      if (search) {
        where.OR = [
          { summary: { contains: search } },
          { actorName: { contains: search } },
          { targetLabel: { contains: search } },
          { targetId: { contains: search } },
          { eventKey: { contains: search } }
        ];
      }

      const hasFilters = Boolean(
        query?.search ||
        query?.module ||
        query?.eventKey ||
        query?.actorUserId ||
        query?.actorRole ||
        query?.targetType ||
        query?.startDate ||
        query?.endDate
      );
      const useCachedFirstPage = !hasFilters && meta.page === 1;

      if (!shouldPaginate) {
        const rows = await prisma.auditLog.findMany({
          where,
          orderBy: { occurredAt: "desc" },
          select: prismaAuditLogListSelect
        });
        return rows.map((record: any) => this.mapPrismaAuditLogListRecord(record));
      }

      const cachedFirstPage = useCachedFirstPage ? this.cachedAuditLogFirstPage.get(meta.pageSize) : null;
      if (cachedFirstPage && cachedFirstPage.expiresAt > Date.now()) {
        return {
          items: cachedFirstPage.items,
          total: this.lastAuditSequence,
          page: meta.page,
          pageSize: meta.pageSize,
          hasNext: meta.pageSize < this.lastAuditSequence
        } satisfies PaginatedResult<AuditLogRecord>;
      }

      const totalPromise = hasFilters ? prisma.auditLog.count({ where }) : Promise.resolve(this.lastAuditSequence);
      const rowsPromise = prisma.auditLog.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: meta.skip,
        take: meta.pageSize,
        select: prismaAuditLogListSelect
      });
      const [total, rows] = await Promise.all([totalPromise, rowsPromise]);

      const items = rows.map((record: any) => this.mapPrismaAuditLogListRecord(record));
      if (useCachedFirstPage) {
        this.cachedAuditLogFirstPage.set(meta.pageSize, {
          items,
          expiresAt: Date.now() + AUDIT_LOG_FIRST_PAGE_CACHE_TTL_MS
        });
      }
      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<AuditLogRecord>;
    }

    return shouldPaginate
      ? this.paginateArray<AuditLogRecord>([], query?.page, query?.pageSize)
      : [];
  }

  async getEmployees(query?: EmployeeListQueryDto, actor?: AuthenticatedActor) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.department || query?.role || query?.status);
    const prisma = this.getPrisma();
    const actorEmployeeFilter = actor?.role === "employee" ? { id: actor.id } : {};

    if (prisma && shouldPaginate) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const useCachedFirstPage = meta.page === 1 && !query?.search?.trim() && !query?.department && !query?.role && !query?.status;
      const firstPageCacheKey = useCachedFirstPage ? this.buildEmployeeFirstPageCacheKey(query, actor) : null;
      const cachedFirstPage = firstPageCacheKey ? this.cachedEmployeeFirstPage.get(firstPageCacheKey) : null;
      if (cachedFirstPage && cachedFirstPage.expiresAt > Date.now() && cachedFirstPage.pageSize === meta.pageSize) {
        return {
          items: cachedFirstPage.items,
          total: cachedFirstPage.total,
          page: meta.page,
          pageSize: meta.pageSize,
          hasNext: meta.pageSize < cachedFirstPage.total
        } satisfies PaginatedResult<EmployeeRecord>;
      }

      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...actorEmployeeFilter,
        ...(query?.department ? { department: query.department } : {}),
        ...(query?.role ? { role: query.role } : {}),
        ...(query?.status ? { status: query.status } : {})
      };

      if (search) {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
          { employeeNumber: { contains: search } },
          { department: { contains: search } },
          { position: { contains: search } }
        ];
      }

      const cachedTotal =
        useCachedFirstPage && !search && !query?.department && !query?.role && !query?.status
          ? actor?.role === "employee"
            ? 1
            : this.cachedDashboardSummary?.expiresAt && this.cachedDashboardSummary.expiresAt > Date.now()
              ? this.cachedDashboardSummary.value.employees
              : null
          : null;
      const [total, rows] = await Promise.all([
        cachedTotal != null ? Promise.resolve(cachedTotal) : prisma.employee.count({ where }),
        prisma.employee.findMany({
          where,
          orderBy: { name: "asc" },
          skip: meta.skip,
          take: meta.pageSize,
          select: prismaEmployeeListSelect
        })
      ]);

      const employees = rows.map((employee: any) => this.mapPrismaEmployeeListRecord(employee));
      if (firstPageCacheKey) {
        this.cachedEmployeeFirstPage.set(firstPageCacheKey, {
          items: employees,
          total,
          pageSize: meta.pageSize,
          expiresAt: Date.now() + EMPLOYEE_FIRST_PAGE_CACHE_TTL_MS
        });
      }

      return {
        items: employees,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + employees.length < total
      } satisfies PaginatedResult<EmployeeRecord>;
    }

    let employees = await this.getEmployeeRows();
    if (actor?.role === "employee") {
      employees = employees.filter((employee: EmployeeRecord) => employee.id === actor.id);
    }
    if (!shouldPaginate) {
      return employees;
    }

    return this.paginateArray(employees.map((employee: EmployeeRecord) => this.toEmployeeSummary(employee)), query?.page, query?.pageSize);
  }

  async getEmployeeById(id: string, actor?: AuthenticatedActor) {
    if (!actor) {
      throw new ForbiddenException("Session is required.");
    }
    if ((actor.role === "employee" || actor.role === "manager") && actor.id !== id) {
      throw new ForbiddenException("You are not allowed to access this employee.");
    }

    const prisma = this.getPrisma();
    if (prisma) {
      const employee = await prisma.employee.findUnique({
        where: { id },
        select: prismaEmployeeSelect
      });
      if (!employee) {
        throw new NotFoundException("Employee not found");
      }
      return this.sanitizeEmployee(this.mapPrismaEmployee(employee));
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === id);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    return this.sanitizeEmployee(employee);
  }

  async authenticateEmployee(username: string, password: string, metadata?: SessionRequestMetadata): Promise<EmployeeLoginResult> {
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();
    const prisma = this.getPrisma();

    let employee: EmployeeRecord | null = null;
    if (prisma) {
      const record = await prisma.employee.findFirst({
        where: {
          status: "active",
          appLoginEnabled: true,
          loginUsername: normalizedUsername
        }
      });

      if (record) {
        employee = this.mapPrismaEmployee(record);
      }
    } else {
      const db = await this.readDb();
      employee = db.employees.find((item) =>
        item.status === "active" &&
        item.appLoginEnabled &&
        item.loginUsername === normalizedUsername
      ) ?? null;
    }

    if (!employee) {
      throw new NotFoundException("Invalid username or password.");
    }

    const passwordMatches = await verifyPassword(normalizedPassword, employee.loginPassword);
    if (!passwordMatches) {
      throw new NotFoundException("Invalid username or password.");
    }

    if (employee.loginPassword && !isPasswordHash(employee.loginPassword)) {
      const hashedPassword = await hashPassword(normalizedPassword);
      employee.loginPassword = hashedPassword;
      if (prisma) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { loginPassword: hashedPassword }
        });
      } else {
        const db = await this.readDb();
        const target = db.employees.find((entry) => entry.id === employee?.id);
        if (target) {
          target.loginPassword = hashedPassword;
          await this.writeDb(db);
        }
      }
    }

    return this.createEmployeeSession(employee, metadata);
  }

  async getEmployeeSession(employeeId: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          appLoginEnabled: true,
          status: "active"
        }
      });
      if (!employee) {
        throw new NotFoundException("Employee session not found");
      }

      return this.toEmployeeSessionPayload({
        ...this.mapPrismaEmployee(employee)
      } as EmployeeRecord);
    }

    const db = await this.readDb();
    const employee = db.employees.find((item) => item.id === employeeId && item.appLoginEnabled && item.status === "active");
    if (!employee) {
      throw new NotFoundException("Employee session not found");
    }

    return this.toEmployeeSessionPayload(employee);
  }

  async revokeEmployeeSession(sessionSubject: string) {
    const demoUsers = new Set(["global-admin", "elena-hr", "sarah-manager", "james-employee"]);
    if (demoUsers.has(sessionSubject)) {
      return { revoked: true, reason: "demo-session" };
    }

    const revoked = await this.revokeSession(sessionSubject, "logout");
    return { revoked };
  }

  async changeOwnPassword(payload: ChangePasswordDto, actor?: AuthenticatedActor) {
    if (!actor?.id || actor.sessionKey === "global-admin" || !actor.sessionKey.startsWith("employee:")) {
      throw new ForbiddenException("Password hanya bisa diubah dari akun karyawan yang valid.");
    }

    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findFirst({
        where: {
          id: actor.id,
          appLoginEnabled: true,
          status: "active"
        }
      });
      const employee = employeeRow ? this.mapPrismaEmployee(employeeRow) : null;
      if (!employee || !employee.loginPassword) {
        throw new NotFoundException("The employee account was not found or is inactive.");
      }

      const currentPassword = payload.currentPassword.trim();
      const newPassword = payload.newPassword.trim();
      if (newPassword.length < 8) {
        throw new BadRequestException("Password baru minimal 8 karakter.");
      }
      if (currentPassword === newPassword) {
        throw new BadRequestException("Password baru harus berbeda dari password saat ini.");
      }

      const passwordMatches = await verifyPassword(currentPassword, employee.loginPassword);
      if (!passwordMatches) {
        throw new BadRequestException("The current password is invalid.");
      }

      const hashedPassword = await hashPassword(newPassword);
      await prisma.employee.update({
        where: { id: employee.id },
        data: { loginPassword: hashedPassword }
      });
      await this.writeAuditLog("auth.change-password", { employeeId: employee.id, actor: actor.name });
      return { success: true, message: "Password updated successfully." };
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === actor.id && entry.appLoginEnabled && entry.status === "active");
    if (!employee || !employee.loginPassword) {
      throw new NotFoundException("The employee account was not found or is inactive.");
    }

    const currentPassword = payload.currentPassword.trim();
    const newPassword = payload.newPassword.trim();
    if (newPassword.length < 8) {
      throw new BadRequestException("Password baru minimal 8 karakter.");
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Password baru harus berbeda dari password saat ini.");
    }

    const passwordMatches = await verifyPassword(currentPassword, employee.loginPassword);
    if (!passwordMatches) {
      throw new BadRequestException("The current password is invalid.");
    }

    employee.loginPassword = await hashPassword(newPassword);
    await this.writeDb(db);
    await this.writeAuditLog("auth.change-password", { employeeId: employee.id, actor: actor.name });
    return { success: true, message: "Password updated successfully." };
  }

  async resetEmployeePassword(payload: ResetEmployeePasswordDto, actor?: AuthenticatedActor) {
    if (!actor || (actor.role !== "hr" && actor.role !== "admin")) {
      throw new ForbiddenException("Hanya HR atau admin yang bisa reset password employee.");
    }

    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findUnique({
        where: { id: payload.employeeId }
      });
      const employee = employeeRow ? this.mapPrismaEmployee(employeeRow) : null;
      if (!employee) {
        throw new NotFoundException("Employee not found.");
      }
      if (!employee.appLoginEnabled) {
        throw new BadRequestException("The employee application account is not active yet.");
      }

      const newPassword = payload.newPassword.trim();
      if (newPassword.length < 8) {
        throw new BadRequestException("Password baru minimal 8 karakter.");
      }

      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          loginPassword: await hashPassword(newPassword)
        }
      });
      await this.writeAuditLog("auth.reset-password", {
        employeeId: employee.id,
        actor: actor.name,
        actorRole: actor.role
      });
      return {
        success: true,
        message: `The password for ${employee.name} was reset successfully.`
      };
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }
    if (!employee.appLoginEnabled) {
      throw new BadRequestException("The employee application account is not active yet.");
    }

    const newPassword = payload.newPassword.trim();
    if (newPassword.length < 8) {
      throw new BadRequestException("Password baru minimal 8 karakter.");
    }

    employee.loginPassword = await hashPassword(newPassword);
    await this.writeDb(db);
    await this.writeAuditLog("auth.reset-password", {
      employeeId: employee.id,
      actor: actor.name,
      actorRole: actor.role
    });
    return {
      success: true,
      message: `The password for ${employee.name} was reset successfully.`
    };
  }

  async createEmployee(payload: CreateEmployeeDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const managerName = payload.managerName.trim();
      const loginUsername = payload.appLoginEnabled === false ? null : (payload.loginUsername?.trim() || payload.nik);
      const employeePassword = payload.appLoginEnabled === false ? null : (payload.loginPassword?.trim() || "employee123");
      const [
        department,
        manager,
        compensationProfile,
        selectedComponents,
        selectedTaxProfile,
        conflicts,
        latestEmployeeNumberRow
      ] = await Promise.all([
        prisma.department.findUnique({
          where: {
            name: payload.department
          },
          select: prismaDepartmentWriteSelect
        }),
        managerName
          ? prisma.employee.findFirst({
              where: {
                name: managerName,
                role: "manager",
                status: "active",
                department: payload.department
              },
              select: { id: true }
            })
          : Promise.resolve(null),
        payload.positionSalaryId
          ? prisma.compensationProfile.findUnique({
              where: { id: payload.positionSalaryId },
              select: prismaCompensationProfileWriteSelect
            })
          : Promise.resolve(null),
        (payload.financialComponentIds?.length ?? 0) > 0
          ? prisma.payrollComponent.findMany({
              where: {
                id: { in: payload.financialComponentIds ?? [] }
              },
              select: prismaPayrollComponentAllowanceSelect
            })
          : Promise.resolve([]),
        payload.taxProfileId
          ? prisma.taxProfile.findUnique({
              where: { id: payload.taxProfileId },
              select: prismaTaxProfileWriteSelect
            })
          : Promise.resolve(null),
        prisma.employee.findMany({
          where: {
            OR: [
              { nik: payload.nik },
              { email: payload.email },
              { idCardNumber: payload.idCardNumber },
              ...(payload.appLoginEnabled === false || !loginUsername ? [] : [{ loginUsername }])
            ]
          },
          select: {
            id: true,
            nik: true,
            email: true,
            idCardNumber: true,
            appLoginEnabled: true,
            loginUsername: true
          }
        }),
        prisma.employee.findFirst({
          orderBy: { employeeNumber: "desc" },
          select: { employeeNumber: true }
        })
      ]);

      if (!department) {
        throw new BadRequestException("The department has not been registered in the master data.");
      }
      if (!department.active) {
        throw new BadRequestException("The department is inactive.");
      }
      if (managerName && !manager) {
        throw new BadRequestException("The assigned manager approver was not found or is inactive.");
      }

      const allowance = selectedComponents
        .filter((entry: any) => entry.type === "earning")
        .reduce((sum: number, entry: any) => sum + (entry.calculationType === "percentage"
          ? Math.round((Number(compensationProfile?.baseSalary ?? payload.baseSalary)) * ((Number(entry.percentage ?? 0)) / 100))
          : Number(entry.amount)), 0);
      for (const conflict of conflicts) {
        if (conflict.nik.trim().toLowerCase() === payload.nik.trim().toLowerCase()) {
          throw new BadRequestException("The NIK is already assigned to another employee.");
        }
        if (conflict.email.trim().toLowerCase() === payload.email.trim().toLowerCase()) {
          throw new BadRequestException("The email address is already assigned to another employee.");
        }
        if (conflict.idCardNumber.trim() === payload.idCardNumber.trim()) {
          throw new BadRequestException("The ID card number is already assigned to another employee.");
        }
        if (
          payload.appLoginEnabled !== false &&
          loginUsername &&
          conflict.appLoginEnabled &&
          conflict.loginUsername &&
          conflict.loginUsername.trim().toLowerCase() === loginUsername.trim().toLowerCase()
        ) {
          throw new BadRequestException("The login username is already assigned to another employee.");
        }
      }

      const nextEmployeeNumber = this.getNextEmployeeNumber(latestEmployeeNumberRow?.employeeNumber);
      const hashedPassword = employeePassword ? await hashPassword(employeePassword) : null;
      const created = await prisma.employee.create({
        data: {
          id: `emp-${randomUUID().slice(0, 8)}`,
          employeeNumber: nextEmployeeNumber,
          nik: payload.nik,
          name: payload.name,
          email: payload.email,
          birthPlace: payload.birthPlace,
          birthDate: this.toDateOnly(payload.birthDate) ?? new Date(),
          gender: payload.gender,
          maritalStatus: payload.maritalStatus,
          marriageDate: this.toDateOnly(payload.marriageDate),
          address: payload.address,
          idCardNumber: payload.idCardNumber,
          education: payload.education,
          workExperience: payload.workExperience,
          educationHistory: Array.isArray(payload.educationHistory) ? payload.educationHistory as EducationRecord[] : [],
          workExperiences: Array.isArray(payload.workExperiences) ? payload.workExperiences as WorkExperienceRecord[] : [],
          department: payload.department,
          position: compensationProfile?.position ?? payload.position,
          role: payload.role,
          status: payload.status,
          phone: payload.phone,
          joinDate: new Date(),
          workLocation: payload.workLocation,
          workType: payload.workType,
          managerName: payload.managerName,
          employmentType: payload.employmentType,
          contractStatus: payload.contractStatus,
          contractStart: this.toDateOnly(payload.contractStart) ?? new Date(),
          contractEnd: this.toDateOnly(payload.contractEnd),
          baseSalary: Number(compensationProfile?.baseSalary ?? payload.baseSalary),
          allowance,
          positionSalaryId: payload.positionSalaryId ?? null,
          financialComponentIds: payload.financialComponentIds ?? [],
          taxProfileId: payload.taxProfileId ?? null,
          taxProfile: selectedTaxProfile?.name ?? payload.taxProfile,
          bankName: payload.bankName,
          bankAccountMasked: payload.bankAccountMasked,
          appLoginEnabled: payload.appLoginEnabled ?? true,
          loginUsername,
          loginPassword: hashedPassword,
          documents: [],
          leaveBalances: this.normalizeLeaveBalances(payload.leaveBalances as Partial<EmployeeRecord["leaveBalances"]> | undefined)
        }
      });
      const employee = this.sanitizeEmployee(this.mapPrismaEmployee(created));
      await this.writeAuditLog("employee.create", { employeeId: employee.id, role: employee.role, department: employee.department, name: employee.name }, actor);
      return employee;
    }

    const db = await this.readDb();
    this.assertDepartmentExistsAndActive(db, payload.department);
    this.assertManagerAssignment(db, { department: payload.department, managerName: payload.managerName });
    const sequence = String(db.employees.length + 1).padStart(3, "0");
    const compensationProfile = payload.positionSalaryId
      ? db.compensationProfiles.find((entry) => entry.id === payload.positionSalaryId)
      : null;
    const selectedComponents = db.payrollComponents.filter((entry) => (payload.financialComponentIds ?? []).includes(entry.id));
    const allowance = selectedComponents
      .filter((entry) => entry.type === "earning")
      .reduce((sum, entry) => sum + (entry.calculationType === "percentage" ? Math.round((compensationProfile?.baseSalary ?? payload.baseSalary) * ((entry.percentage ?? 0) / 100)) : entry.amount), 0);
    const selectedTaxProfile = payload.taxProfileId ? db.taxProfiles.find((entry) => entry.id === payload.taxProfileId) : null;
    const employeePassword = payload.appLoginEnabled === false ? null : (payload.loginPassword?.trim() || "employee123");
    this.assertEmployeeUniqueness(db, {
      nik: payload.nik,
      email: payload.email,
      idCardNumber: payload.idCardNumber,
      appLoginEnabled: payload.appLoginEnabled ?? true,
      loginUsername: payload.appLoginEnabled === false ? null : (payload.loginUsername?.trim() || payload.nik)
    });
    const employee: EmployeeRecord = {
      id: `emp-${randomUUID().slice(0, 8)}`,
      employeeNumber: `EMP-2026-${sequence}`,
      joinDate: new Date().toISOString().slice(0, 10),
      ...payload,
      educationHistory: Array.isArray(payload.educationHistory) ? payload.educationHistory as EducationRecord[] : [],
      workExperiences: Array.isArray(payload.workExperiences) ? payload.workExperiences as WorkExperienceRecord[] : [],
      position: compensationProfile?.position ?? payload.position,
      baseSalary: compensationProfile?.baseSalary ?? payload.baseSalary,
      allowance,
      positionSalaryId: payload.positionSalaryId ?? null,
      financialComponentIds: payload.financialComponentIds ?? [],
      taxProfileId: payload.taxProfileId ?? null,
      taxProfile: selectedTaxProfile?.name ?? payload.taxProfile,
      contractEnd: payload.contractEnd ?? null,
      marriageDate: payload.marriageDate ?? null,
      appLoginEnabled: payload.appLoginEnabled ?? true,
      loginUsername: payload.appLoginEnabled === false ? null : (payload.loginUsername?.trim() || payload.nik),
      loginPassword: employeePassword ? await hashPassword(employeePassword) : null,
      documents: [],
      leaveBalances: this.normalizeLeaveBalances(payload.leaveBalances as Partial<EmployeeRecord["leaveBalances"]> | undefined)
    };
    db.employees.unshift(employee);
    await this.writeDb(db);
    await this.writeAuditLog("employee.create", { employeeId: employee.id, role: employee.role, department: employee.department, name: employee.name }, actor);
    return this.sanitizeEmployee(employee);
  }

  async updateEmployee(id: string, payload: UpdateEmployeeDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const currentRow = await prisma.employee.findUnique({
        where: { id },
        select: prismaEmployeeSelect
      });
      if (!currentRow) {
        throw new NotFoundException("Employee not found");
      }

      const employee = this.mapPrismaEmployee(currentRow);
      const next = {
        ...employee,
        ...payload,
        positionSalaryId: payload.positionSalaryId === undefined ? employee.positionSalaryId : payload.positionSalaryId,
        financialComponentIds: payload.financialComponentIds ?? employee.financialComponentIds,
        leaveBalances: payload.leaveBalances !== undefined
          ? this.normalizeLeaveBalances(payload.leaveBalances as Partial<EmployeeRecord["leaveBalances"]>)
          : employee.leaveBalances
      } as EmployeeRecord;

      const compensationProfile = next.positionSalaryId
        ? await prisma.compensationProfile.findUnique({
            where: { id: next.positionSalaryId },
            select: prismaCompensationProfileWriteSelect
          })
        : null;
      if (compensationProfile) {
        next.position = compensationProfile.position;
        next.baseSalary = Number(compensationProfile.baseSalary);
      }

      const selectedComponents = next.financialComponentIds.length > 0
        ? await prisma.payrollComponent.findMany({
            where: { id: { in: next.financialComponentIds } },
            select: prismaPayrollComponentAllowanceSelect
          })
        : [];
      next.allowance = selectedComponents
        .filter((entry: any) => entry.type === "earning")
        .reduce((sum: number, entry: any) => sum + (entry.calculationType === "percentage"
          ? Math.round(next.baseSalary * ((Number(entry.percentage ?? 0)) / 100))
          : Number(entry.amount)), 0);

      if (payload.taxProfileId !== undefined) {
        next.taxProfileId = payload.taxProfileId ?? null;
        const selectedTaxProfile = next.taxProfileId
          ? await prisma.taxProfile.findUnique({
              where: { id: next.taxProfileId },
              select: prismaTaxProfileWriteSelect
            })
          : null;
        if (selectedTaxProfile) {
          next.taxProfile = selectedTaxProfile.name;
        } else if (payload.taxProfileId === null) {
          next.taxProfile = payload.taxProfile ?? next.taxProfile;
        }
      }
      if (payload.appLoginEnabled !== undefined && !payload.appLoginEnabled) {
        next.loginUsername = null;
        next.loginPassword = null;
      }
      if (payload.loginUsername !== undefined) {
        next.loginUsername = payload.loginUsername?.trim() || null;
      }
      if (payload.loginPassword !== undefined) {
        const nextPassword = payload.loginPassword?.trim() || null;
        if (nextPassword) {
          next.loginPassword = await hashPassword(nextPassword);
        } else if (payload.appLoginEnabled === false) {
          next.loginPassword = null;
        }
      }

      const [department, manager, conflicts] = await Promise.all([
        prisma.department.findUnique({
          where: { name: next.department },
          select: prismaDepartmentWriteSelect
        }),
        next.managerName.trim()
          ? prisma.employee.findFirst({
              where: {
                id: { not: id },
                name: next.managerName,
                role: "manager",
                status: "active",
                department: next.department
              },
              select: { id: true }
            })
          : Promise.resolve(null),
        prisma.employee.findMany({
          where: {
            id: { not: id },
            OR: [
              { nik: next.nik },
              { email: next.email },
              { idCardNumber: next.idCardNumber },
              ...(next.appLoginEnabled && next.loginUsername ? [{ loginUsername: next.loginUsername }] : [])
            ]
          },
          select: {
            nik: true,
            email: true,
            idCardNumber: true,
            appLoginEnabled: true,
            loginUsername: true
          }
        })
      ]);
      if (!department) {
        throw new BadRequestException("The department has not been registered in the master data.");
      }
      if (!department.active) {
        throw new BadRequestException("The department is inactive.");
      }
      if (next.managerName.trim() && !manager) {
        throw new BadRequestException("The assigned manager approver was not found or is inactive.");
      }
      for (const conflict of conflicts) {
        if (conflict.nik.trim().toLowerCase() === next.nik.trim().toLowerCase()) {
          throw new BadRequestException("The NIK is already assigned to another employee.");
        }
        if (conflict.email.trim().toLowerCase() === next.email.trim().toLowerCase()) {
          throw new BadRequestException("The email address is already assigned to another employee.");
        }
        if (conflict.idCardNumber.trim() === next.idCardNumber.trim()) {
          throw new BadRequestException("The ID card number is already assigned to another employee.");
        }
        if (
          next.appLoginEnabled &&
          next.loginUsername &&
          conflict.appLoginEnabled &&
          conflict.loginUsername &&
          conflict.loginUsername.trim().toLowerCase() === next.loginUsername.trim().toLowerCase()
        ) {
          throw new BadRequestException("The login username is already assigned to another employee.");
        }
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          nik: next.nik,
          name: next.name,
          email: next.email,
          birthPlace: next.birthPlace,
          birthDate: this.toDateOnly(next.birthDate) ?? new Date(),
          gender: next.gender,
          maritalStatus: next.maritalStatus,
          marriageDate: this.toDateOnly(next.marriageDate),
          address: next.address,
          idCardNumber: next.idCardNumber,
          education: next.education,
          workExperience: next.workExperience,
          educationHistory: next.educationHistory,
          workExperiences: next.workExperiences,
          department: next.department,
          position: next.position,
          role: next.role,
          status: next.status,
          phone: next.phone,
          workLocation: next.workLocation,
          workType: next.workType,
          managerName: next.managerName,
          employmentType: next.employmentType,
          contractStatus: next.contractStatus,
          contractStart: this.toDateOnly(next.contractStart) ?? new Date(),
          contractEnd: this.toDateOnly(next.contractEnd),
          baseSalary: next.baseSalary,
          allowance: next.allowance,
          positionSalaryId: next.positionSalaryId ?? null,
          financialComponentIds: next.financialComponentIds,
          taxProfileId: next.taxProfileId ?? null,
          taxProfile: next.taxProfile,
          bankName: next.bankName,
          bankAccountMasked: next.bankAccountMasked,
          appLoginEnabled: next.appLoginEnabled,
          loginUsername: next.loginUsername,
          ...(payload.loginPassword !== undefined || payload.appLoginEnabled === false ? { loginPassword: next.loginPassword } : {}),
          leaveBalances: next.leaveBalances
        }
      });
      await this.writeAuditLog("employee.update", { employeeId: id, fields: Object.keys(payload), name: updated.name }, actor);
      return this.sanitizeEmployee(this.mapPrismaEmployee(updated));
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === id);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    const compensationProfile = payload.positionSalaryId
      ? db.compensationProfiles.find((entry) => entry.id === payload.positionSalaryId)
      : null;
    Object.assign(employee, payload, payload.positionSalaryId === null ? { positionSalaryId: null } : {});
    if (compensationProfile) {
      employee.position = compensationProfile.position;
      employee.baseSalary = compensationProfile.baseSalary;
      employee.positionSalaryId = compensationProfile.id;
    }
    if (payload.financialComponentIds) {
      employee.financialComponentIds = payload.financialComponentIds;
      const selectedComponents = db.payrollComponents.filter((entry) => employee.financialComponentIds.includes(entry.id));
      employee.allowance = selectedComponents
        .filter((entry) => entry.type === "earning")
        .reduce((sum, entry) => sum + (entry.calculationType === "percentage" ? Math.round(employee.baseSalary * ((entry.percentage ?? 0) / 100)) : entry.amount), 0);
    }
    if (payload.taxProfileId !== undefined) {
      employee.taxProfileId = payload.taxProfileId ?? null;
      const selectedTaxProfile = employee.taxProfileId ? db.taxProfiles.find((entry) => entry.id === employee.taxProfileId) : null;
      if (selectedTaxProfile) {
        employee.taxProfile = selectedTaxProfile.name;
      }
    }
    if (payload.appLoginEnabled !== undefined) {
      employee.appLoginEnabled = payload.appLoginEnabled;
      if (!payload.appLoginEnabled) {
        employee.loginUsername = null;
        employee.loginPassword = null;
      }
    }
    if (payload.loginUsername !== undefined) {
      employee.loginUsername = payload.loginUsername?.trim() || null;
    }
    if (payload.loginPassword !== undefined) {
      const nextPassword = payload.loginPassword?.trim() || null;
      if (nextPassword) {
        employee.loginPassword = await hashPassword(nextPassword);
      } else if (payload.appLoginEnabled === false) {
        employee.loginPassword = null;
      }
    }
    if (payload.leaveBalances !== undefined) {
      employee.leaveBalances = this.normalizeLeaveBalances(payload.leaveBalances as Partial<EmployeeRecord["leaveBalances"]>);
    }
    this.assertDepartmentExistsAndActive(db, employee.department);
    this.assertManagerAssignment(db, { department: employee.department, managerName: employee.managerName, employeeId: employee.id });
    this.assertEmployeeUniqueness(db, {
      nik: employee.nik,
      email: employee.email,
      idCardNumber: employee.idCardNumber,
      appLoginEnabled: employee.appLoginEnabled,
      loginUsername: employee.loginUsername
    }, employee.id);
    await this.writeDb(db);
    await this.writeAuditLog("employee.update", { employeeId: id, fields: Object.keys(payload), name: employee.name }, actor);
    return this.sanitizeEmployee(employee);
  }

  async deleteEmployee(id: string, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const existing = await prisma.employee.findUnique({
        where: { id },
        select: {
          id: true,
          name: true
        }
      });
      if (!existing) {
        throw new NotFoundException("Employee not found");
      }
      await prisma.employee.delete({
        where: { id }
      });
      await this.writeAuditLog("employee.delete", { employeeId: id, name: existing.name }, actor);
      return { deleted: true, id };
    }

    const db = await this.readDb();
    const nextEmployees = db.employees.filter((entry) => entry.id !== id);
    if (nextEmployees.length === db.employees.length) {
      throw new NotFoundException("Employee not found");
    }
    db.employees = nextEmployees;
    await this.writeDb(db);
    await this.writeAuditLog("employee.delete", { employeeId: id }, actor);
    return { deleted: true, id };
  }

  async getEmployeeDocuments(employeeId: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          documents: true
        }
      });
      if (!employee) {
        throw new NotFoundException("Employee not found");
      }
      const documents = Array.isArray(employee.documents) ? employee.documents as EmployeeDocumentRecord[] : [];
      return documents.map((document) => this.toSafeEmployeeDocument(document));
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    return employee.documents.map((document) => this.toSafeEmployeeDocument(document));
  }

  async uploadEmployeeDocument(
    employeeId: string,
    payload: UploadEmployeeDocumentDto,
    file?: Express.Multer.File,
    fileUrl?: string | null
  ) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          documents: true
        }
      });
      if (!employeeRow) {
        throw new NotFoundException("Employee not found");
      }
      if (!file || !fileUrl) {
        throw new NotFoundException("Document file is required");
      }

      const documents = Array.isArray(employeeRow.documents) ? employeeRow.documents as EmployeeDocumentRecord[] : [];
      const document: EmployeeDocumentRecord = {
        id: `doc-${randomUUID().slice(0, 8)}`,
        employeeId,
        type: payload.type,
        title: payload.title,
        fileName: file.originalname,
        fileUrl,
        uploadedAt: new Date().toISOString(),
        notes: payload.notes ?? ""
      };

      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          documents: [document, ...documents]
        }
      });
      return document;
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    if (!file || !fileUrl) {
      throw new NotFoundException("Document file is required");
    }

    const document: EmployeeDocumentRecord = {
      id: `doc-${randomUUID().slice(0, 8)}`,
      employeeId,
      type: payload.type,
      title: payload.title,
      fileName: file.originalname,
      fileUrl,
      uploadedAt: new Date().toISOString(),
      notes: payload.notes ?? ""
    };

    employee.documents.unshift(document);
    await this.writeDb(db);
    return document;
  }

  async deleteEmployeeDocument(employeeId: string, documentId: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          documents: true
        }
      });
      if (!employeeRow) {
        throw new NotFoundException("Employee not found");
      }

      const documents = Array.isArray(employeeRow.documents) ? employeeRow.documents as EmployeeDocumentRecord[] : [];
      const document = documents.find((entry) => entry.id === documentId);
      if (!document) {
        throw new NotFoundException("Employee document not found");
      }

      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          documents: documents.filter((entry) => entry.id !== documentId)
        }
      });
      const fullPath = this.resolveStoragePath(document.fileUrl);
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
      }
      return { deleted: true, id: documentId };
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === employeeId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }

    const document = employee.documents.find((entry) => entry.id === documentId);
    if (!document) {
      throw new NotFoundException("Employee document not found");
    }

    employee.documents = employee.documents.filter((entry) => entry.id !== documentId);
    const fullPath = this.resolveStoragePath(document.fileUrl);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
    await this.writeDb(db);
    return { deleted: true, id: documentId };
  }

  async getCompensationProfiles() {
    const prisma = this.getPrisma();
    if (prisma) {
      const rows = await prisma.compensationProfile.findMany({
        orderBy: { position: "asc" }
      });
      return rows.map((row: any) => this.mapPrismaCompensationProfile(row));
    }

    const db = await this.readDb();
    return db.compensationProfiles;
  }

  async getDepartments() {
    const prisma = this.getPrisma();
    if (prisma) {
      const rows = await prisma.department.findMany({
        orderBy: { name: "asc" }
      });
      return rows.map((row: any) => this.mapPrismaDepartment(row));
    }

    const db = await this.readDb();
    return [...db.departments].sort((a, b) => a.name.localeCompare(b.name));
  }

  async createDepartment(payload: CreateDepartmentDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const name = payload.name.trim();
      if (!name) {
        throw new BadRequestException("Department name is required.");
      }
      const duplicate = await prisma.department.findFirst({
        where: { name },
        select: { id: true }
      });
      if (duplicate) {
        throw new BadRequestException("The department already exists.");
      }

      const department = await prisma.department.create({
        data: {
          id: `dept-${randomUUID().slice(0, 8)}`,
          name,
          active: payload.active
        }
      });
      const normalized = this.mapPrismaDepartment(department);
      await this.writeAuditLog("department.create", { departmentId: normalized.id, name: normalized.name, active: normalized.active }, actor);
      return normalized;
    }

    const db = await this.readDb();
    const name = payload.name.trim();
    if (!name) {
      throw new BadRequestException("Department name is required.");
    }
    const exists = db.departments.some((entry) => entry.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      throw new BadRequestException("The department already exists.");
    }
    const now = new Date().toISOString();
    const department: DepartmentRecord = {
      id: `dept-${randomUUID().slice(0, 8)}`,
      name,
      active: payload.active,
      createdAt: now,
      updatedAt: now
    };
    db.departments.push(department);
    db.departments.sort((a, b) => a.name.localeCompare(b.name));
    await this.writeDb(db);
    await this.writeAuditLog("department.create", { departmentId: department.id, name: department.name, active: department.active }, actor);
    return department;
  }

  async updateDepartment(id: string, payload: UpdateDepartmentDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const department = await prisma.department.findUnique({
        where: { id },
        select: prismaDepartmentWriteSelect
      });
      if (!department) {
        throw new NotFoundException("Department not found");
      }

      const nextName = payload.name?.trim();
      if (nextName && nextName.toLowerCase() !== department.name.trim().toLowerCase()) {
        const duplicate = await prisma.department.findFirst({
          where: {
            id: { not: id },
            name: nextName
          },
          select: { id: true }
        });
        if (duplicate) {
          throw new BadRequestException("The department already exists.");
        }
      }

      const updated = await prisma.$transaction(async (tx: any) => {
        if (nextName && nextName.toLowerCase() !== department.name.trim().toLowerCase()) {
          await tx.employee.updateMany({
            where: { department: department.name },
            data: { department: nextName }
          });
        }

        return tx.department.update({
          where: { id },
          data: {
            ...(nextName ? { name: nextName } : {}),
            ...(payload.active !== undefined ? { active: payload.active } : {})
          }
        });
      });
      await this.writeAuditLog("department.update", { departmentId: id, fields: Object.keys(payload), name: updated.name }, actor);
      return this.mapPrismaDepartment(updated);
    }

    const db = await this.readDb();
    const department = db.departments.find((entry) => entry.id === id);
    if (!department) {
      throw new NotFoundException("Department not found");
    }

    const nextName = payload.name?.trim();
    if (nextName && nextName.toLowerCase() !== department.name.trim().toLowerCase()) {
      const duplicate = db.departments.some((entry) => entry.id !== id && entry.name.trim().toLowerCase() === nextName.toLowerCase());
      if (duplicate) {
        throw new BadRequestException("The department already exists.");
      }
      const previousName = department.name;
      department.name = nextName;
      db.employees = db.employees.map((employee) =>
        employee.department.trim().toLowerCase() === previousName.trim().toLowerCase()
          ? { ...employee, department: nextName }
          : employee
      );
    }

    if (payload.active !== undefined) {
      department.active = payload.active;
    }
    department.updatedAt = new Date().toISOString();
    await this.writeDb(db);
    await this.writeAuditLog("department.update", { departmentId: id, fields: Object.keys(payload), name: department.name }, actor);
    return department;
  }

  async deleteDepartment(id: string, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const department = await prisma.department.findUnique({
        where: { id },
        select: {
          id: true,
          name: true
        }
      });
      if (!department) {
        throw new NotFoundException("Department not found");
      }
      const isUsed = await prisma.employee.count({
        where: { department: department.name }
      });
      if (isUsed > 0) {
        throw new BadRequestException("The department is still assigned to active employees and cannot be deleted.");
      }

      await prisma.department.delete({
        where: { id }
      });
      await this.writeAuditLog("department.delete", { departmentId: id, name: department.name }, actor);
      return { deleted: true, id };
    }

    const db = await this.readDb();
    const department = db.departments.find((entry) => entry.id === id);
    if (!department) {
      throw new NotFoundException("Department not found");
    }
    const isUsed = db.employees.some((entry) => entry.department.trim().toLowerCase() === department.name.trim().toLowerCase());
    if (isUsed) {
      throw new BadRequestException("The department is still assigned to active employees and cannot be deleted.");
    }
    db.departments = db.departments.filter((entry) => entry.id !== id);
    await this.writeDb(db);
    await this.writeAuditLog("department.delete", { departmentId: id, name: department.name }, actor);
    return { deleted: true, id };
  }

  async createCompensationProfile(payload: CreateCompensationProfileDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const profile = await prisma.compensationProfile.create({
        data: {
          id: `comp-${randomUUID().slice(0, 8)}`,
          position: payload.position,
          baseSalary: payload.baseSalary,
          active: payload.active,
          notes: payload.notes
        }
      });
      return this.mapPrismaCompensationProfile(profile);
    }

    const db = await this.readDb();
    const profile: CompensationProfileRecord = {
      id: `comp-${randomUUID().slice(0, 8)}`,
      ...payload
    };
    db.compensationProfiles.unshift(profile);
    await this.writeDb(db);
    return profile;
  }

  async updateCompensationProfile(id: string, payload: UpdateCompensationProfileDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const profile = await prisma.compensationProfile.findUnique({
        where: { id },
        select: prismaCompensationProfileWriteSelect
      });
      if (!profile) {
        throw new NotFoundException("Compensation profile not found");
      }

      const previousPosition = profile.position;
      const shouldSyncEmployees =
        (payload.position !== undefined && payload.position !== profile.position) ||
        (payload.baseSalary !== undefined && Number(payload.baseSalary) !== Number(profile.baseSalary));
      const updated = await prisma.$transaction(async (tx: any) => {
        const nextProfile = await tx.compensationProfile.update({
          where: { id },
          data: payload
        });
        if (shouldSyncEmployees) {
          await tx.employee.updateMany({
            where: { positionSalaryId: id },
            data: {
              position: nextProfile.position || previousPosition,
              baseSalary: nextProfile.baseSalary
            }
          });
        }
        return nextProfile;
      });
      return this.mapPrismaCompensationProfile(updated);
    }

    const db = await this.readDb();
    const profile = db.compensationProfiles.find((entry) => entry.id === id);
    if (!profile) {
      throw new NotFoundException("Compensation profile not found");
    }

    const previousPosition = profile.position;
    Object.assign(profile, payload);
    db.employees = db.employees.map((employee) => (
      employee.positionSalaryId === id
        ? {
            ...employee,
            position: profile.position || previousPosition,
            baseSalary: profile.baseSalary
          }
        : employee
    ));

    await this.writeDb(db);
    return profile;
  }

  async deleteCompensationProfile(id: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const exists = await prisma.compensationProfile.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!exists) {
        throw new NotFoundException("Compensation profile not found");
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.employee.updateMany({
          where: { positionSalaryId: id },
          data: { positionSalaryId: null }
        });
        await tx.compensationProfile.delete({
          where: { id }
        });
      });
      return { deleted: true, id };
    }

    const db = await this.readDb();
    const exists = db.compensationProfiles.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Compensation profile not found");
    }

    db.compensationProfiles = db.compensationProfiles.filter((entry) => entry.id !== id);
    db.employees = db.employees.map((employee) => employee.positionSalaryId === id ? { ...employee, positionSalaryId: null } : employee);
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getTaxProfiles() {
    const prisma = this.getPrisma();
    if (prisma) {
      const rows = await prisma.taxProfile.findMany({
        orderBy: { name: "asc" }
      });
      return rows.map((row: any) => this.mapPrismaTaxProfile(row));
    }

    const db = await this.readDb();
    return db.taxProfiles;
  }

  async createTaxProfile(payload: CreateTaxProfileDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const profile = await prisma.taxProfile.create({
        data: {
          id: `tax-${randomUUID().slice(0, 8)}`,
          name: payload.name,
          rate: payload.rate,
          active: payload.active,
          description: payload.description
        }
      });
      return this.mapPrismaTaxProfile(profile);
    }

    const db = await this.readDb();
    const profile: TaxProfileRecord = { id: `tax-${randomUUID().slice(0, 8)}`, ...payload };
    db.taxProfiles.unshift(profile);
    await this.writeDb(db);
    return profile;
  }

  async updateTaxProfile(id: string, payload: UpdateTaxProfileDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const profile = await prisma.taxProfile.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          rate: true,
          active: true,
          description: true
        }
      });
      if (!profile) {
        throw new NotFoundException("Tax profile not found");
      }

      const shouldSyncEmployees = payload.name !== undefined && payload.name !== profile.name;
      const updated = await prisma.$transaction(async (tx: any) => {
        const nextProfile = await tx.taxProfile.update({
          where: { id },
          data: payload
        });
        if (shouldSyncEmployees) {
          await tx.employee.updateMany({
            where: { taxProfileId: id },
            data: { taxProfile: nextProfile.name }
          });
        }
        return nextProfile;
      });
      return this.mapPrismaTaxProfile(updated);
    }

    const db = await this.readDb();
    const profile = db.taxProfiles.find((entry) => entry.id === id);
    if (!profile) {
      throw new NotFoundException("Tax profile not found");
    }
    Object.assign(profile, payload);
    db.employees = db.employees.map((employee) => employee.taxProfileId === id ? { ...employee, taxProfile: profile.name } : employee);
    await this.writeDb(db);
    return profile;
  }

  async deleteTaxProfile(id: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const exists = await prisma.taxProfile.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!exists) {
        throw new NotFoundException("Tax profile not found");
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.employee.updateMany({
          where: { taxProfileId: id },
          data: { taxProfileId: null }
        });
        await tx.taxProfile.delete({
          where: { id }
        });
      });
      return { deleted: true, id };
    }

    const db = await this.readDb();
    const exists = db.taxProfiles.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Tax profile not found");
    }
    db.taxProfiles = db.taxProfiles.filter((entry) => entry.id !== id);
    db.employees = db.employees.map((employee) => employee.taxProfileId === id ? { ...employee, taxProfileId: null } : employee);
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getAttendanceHistory(query?: AttendanceHistoryQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.department || query?.status || query?.userId);
    const prisma = this.getPrisma();

    if (prisma) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.department ? { department: query.department } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.userId ? { userId: query.userId } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search } },
          { department: { contains: search } },
          { description: { contains: search } },
          { location: { contains: search } }
        ];
      }

      if (!shouldPaginate) {
        const rows = await prisma.attendanceLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          select: prismaAttendanceSelect
        });
        return rows.map((record: any) => this.toSafeAttendanceRecord(this.mapPrismaAttendanceRecord(record)));
      }

      const [total, rows] = await Promise.all([
        prisma.attendanceLog.count({ where }),
        prisma.attendanceLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip: meta.skip,
          take: meta.pageSize,
          select: prismaAttendanceSelect
        })
      ]);

      const items = rows.map((record: any) => this.toSafeAttendanceRecord(this.mapPrismaAttendanceRecord(record)));

      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<AttendanceRecord>;
    }

    const db = await this.readDb();
    let records = db.attendanceLogs;
    if (query?.userId) {
      records = records.filter((entry) => entry.userId === query.userId);
    }
    if (query?.department) {
      records = records.filter((entry) => entry.department === query.department);
    }
    if (query?.status) {
      records = records.filter((entry) => entry.status === query.status);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      records = records.filter((entry) =>
        [entry.employeeName, entry.department, entry.description, entry.location].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    if (!shouldPaginate) {
      return records.map((record) => this.toSafeAttendanceRecord(record));
    }
    const paginated = this.paginateArray(records, query?.page, query?.pageSize);
    return {
      ...paginated,
      items: paginated.items.map((record) => this.toSafeAttendanceRecord(record))
    };
  }

  async getAttendanceToday() {
    const prisma = this.getPrisma();
    if (prisma) {
      const { dayKey, start, end } = this.getTodayRangeUtc();
      if (this.cachedAttendanceToday && this.cachedAttendanceToday.dayKey === dayKey && this.cachedAttendanceToday.expiresAt > Date.now()) {
        return this.cachedAttendanceToday.items;
      }
      const rows = await prisma.attendanceLog.findMany({
        where: {
          timestamp: {
            gte: start,
            lt: end
          }
        },
        orderBy: { timestamp: "desc" },
        select: prismaAttendanceSelect
      });
      const items = rows.map((entry: any) => this.toSafeAttendanceRecord(this.mapPrismaAttendanceRecord(entry)));
      this.cachedAttendanceToday = {
        dayKey,
        expiresAt: Date.now() + 10_000,
        items
      };
      return items;
    }

    const db = await this.readDb();
    const today = new Date().toISOString().slice(0, 10);
    return db.attendanceLogs
      .filter((entry) => entry.timestamp.slice(0, 10) === today)
      .map((entry) => this.toSafeAttendanceRecord(entry));
  }

  async getAttendanceOverview() {
    const prisma = this.getPrisma();
    if (prisma) {
      const { dayKey } = this.getTodayRangeUtc();
      if (this.cachedAttendanceOverview && this.cachedAttendanceOverview.dayKey === dayKey && this.cachedAttendanceOverview.expiresAt > Date.now()) {
        return this.cachedAttendanceOverview.value;
      }
      const [todayRows, overtimeAggregate] = await Promise.all([
        this.getAttendanceToday(),
        prisma.overtimeRequest.aggregate({
          where: {
            status: { in: ["approved", "paid", "pending"] }
          },
          _sum: {
            minutes: true
          }
        })
      ]);

      const openCheckIns = todayRows.filter((entry: AttendanceRecord) => !entry.checkOut).length;
      const gpsValidated = todayRows.filter((entry: AttendanceRecord) => entry.gpsValidated).length;
      const selfieCaptured = todayRows.filter((entry: AttendanceRecord) => Boolean(entry.photoUrl)).length;
      const overtimeMinutes = Number(overtimeAggregate._sum.minutes ?? 0);
      const value = {
        checkedInToday: todayRows.length,
        openCheckIns,
        gpsValidated,
        selfieCaptured,
        overtimeHours: Number((overtimeMinutes / 60).toFixed(1))
      };
      this.cachedAttendanceOverview = {
        dayKey,
        expiresAt: Date.now() + 10_000,
        value
      };
      return value;
    }

    const db = await this.readDb();
    const today = await this.getAttendanceToday();
    const openCheckIns = today.filter((entry: AttendanceRecord) => !entry.checkOut).length;
    const gpsValidated = today.filter((entry: AttendanceRecord) => entry.gpsValidated).length;
    const selfieCaptured = today.filter((entry: AttendanceRecord) => Boolean(entry.photoUrl)).length;
    const overtimeMinutes = db.overtimeRequests.filter((entry) => ["approved", "paid", "pending"].includes(entry.status)).reduce((total, entry) => total + entry.minutes, 0);
    return {
      checkedInToday: today.length,
      openCheckIns,
      gpsValidated,
      selfieCaptured,
      overtimeHours: Number((overtimeMinutes / 60).toFixed(1))
    };
  }

  async getOvertimeRequests() {
    const prisma = this.getPrisma();
    if (prisma) {
      const rows = await prisma.overtimeRequest.findMany({
        orderBy: { date: "desc" }
      });
      return rows.map((entry: any) => this.mapPrismaOvertimeRecord(entry));
    }

    const db = await this.readDb();
    return db.overtimeRequests;
  }
  async checkIn(payload: CheckInDto, photoUrl: string | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const now = new Date();
      const schedule = this.parseClock(NON_SHIFT_START);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const scheduledMinutes = schedule.hour * 60 + schedule.minute;
      const gpsDistanceMeters = this.measureDistanceMeters(payload.location, payload.latitude, payload.longitude);
      const created = await prisma.attendanceLog.create({
        data: {
          id: `att-${randomUUID().slice(0, 8)}`,
          userId: payload.userId,
          employeeName: payload.employeeName,
          department: payload.department,
          timestamp: now,
          checkIn: this.formatClock(now),
          checkOut: null,
          location: payload.location,
          latitude: payload.latitude,
          longitude: payload.longitude,
          description: "Regular attendance check-in",
          gpsValidated: gpsDistanceMeters <= this.getRadius(payload.location),
          gpsDistanceMeters,
          photoUrl,
          status: currentMinutes > scheduledMinutes ? "late" : "on-time",
          overtimeMinutes: 0
        }
      });
      return this.mapPrismaAttendanceRecord(created);
    }

    const db = await this.readDb();
    const now = new Date();
    const schedule = this.parseClock(NON_SHIFT_START);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const scheduledMinutes = schedule.hour * 60 + schedule.minute;
    const gpsDistanceMeters = this.measureDistanceMeters(payload.location, payload.latitude, payload.longitude);
    const record: AttendanceRecord = {
      id: `att-${randomUUID().slice(0, 8)}`,
      userId: payload.userId,
      employeeName: payload.employeeName,
      department: payload.department,
      timestamp: now.toISOString(),
      checkIn: this.formatClock(now),
      checkOut: null,
      location: payload.location,
      latitude: payload.latitude,
      longitude: payload.longitude,
      description: "Regular attendance check-in",
      gpsValidated: gpsDistanceMeters <= this.getRadius(payload.location),
      gpsDistanceMeters,
      photoUrl,
      status: currentMinutes > scheduledMinutes ? "late" : "on-time",
      overtimeMinutes: 0
    };
    db.attendanceLogs.unshift(record);
    await this.writeDb(db);
    return record;
  }

  async checkOut(payload: CheckOutDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const existing = await prisma.attendanceLog.findUnique({
        where: { id: payload.attendanceId }
      });
      if (!existing) {
        throw new NotFoundException("Attendance record not found");
      }

      const now = new Date();
      const checkOutTime = payload.checkOut ?? this.formatClock(now);
      const scheduled = this.parseClock(NON_SHIFT_END);
      const actual = payload.checkOut
        ? this.parseClock(payload.checkOut.replace(/\s?(AM|PM)$/i, "").trim())
        : { hour: now.getHours(), minute: now.getMinutes() };
      const overtimeMinutes = Math.max(0, actual.hour * 60 + actual.minute - (scheduled.hour * 60 + scheduled.minute));

      const updated = await prisma.$transaction(async (tx: any) => {
        const attendance = await tx.attendanceLog.update({
          where: { id: payload.attendanceId },
          data: {
            checkOut: checkOutTime,
            overtimeMinutes
          }
        });

        if (overtimeMinutes > 0) {
          await tx.overtimeRequest.create({
            data: {
              id: `ot-${randomUUID().slice(0, 8)}`,
              userId: existing.userId,
              employeeName: existing.employeeName,
              department: existing.department,
              date: existing.timestamp,
              minutes: overtimeMinutes,
              reason: "Auto captured from attendance check-out",
              status: "pending"
            }
          });
        }

        return attendance;
      });

      return this.mapPrismaAttendanceRecord(updated);
    }

    const db = await this.readDb();
    const record = db.attendanceLogs.find((entry) => entry.id === payload.attendanceId);
    if (!record) {
      throw new NotFoundException("Attendance record not found");
    }
    const now = new Date();
    const checkOutTime = payload.checkOut ?? this.formatClock(now);
    record.checkOut = checkOutTime;

    const scheduled = this.parseClock(NON_SHIFT_END);
    const actual = payload.checkOut ? this.parseClock(payload.checkOut.replace(/\s?(AM|PM)$/i, "").trim()) : { hour: now.getHours(), minute: now.getMinutes() };
    const overtimeMinutes = Math.max(0, actual.hour * 60 + actual.minute - (scheduled.hour * 60 + scheduled.minute));
    record.overtimeMinutes = overtimeMinutes;

    if (overtimeMinutes > 0) {
      db.overtimeRequests.unshift({
        id: `ot-${randomUUID().slice(0, 8)}`,
        userId: record.userId,
        employeeName: record.employeeName,
        department: record.department,
        date: record.timestamp.slice(0, 10),
        minutes: overtimeMinutes,
        reason: "Auto captured from attendance check-out",
        status: "pending"
      });
    }

    await this.writeDb(db);
    return record;
  }

  async createOvertimeRequest(payload: CreateOvertimeDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const record = await prisma.overtimeRequest.create({
        data: {
          id: `ot-${randomUUID().slice(0, 8)}`,
          userId: payload.userId,
          employeeName: payload.employeeName,
          department: payload.department,
          date: this.toDateOnly(payload.date) ?? new Date(),
          minutes: payload.minutes,
          reason: payload.reason,
          status: "pending"
        }
      });
      return this.mapPrismaOvertimeRecord(record);
    }

    const db = await this.readDb();
    const record: OvertimeRecord = { id: `ot-${randomUUID().slice(0, 8)}`, ...payload, status: "pending" };
    db.overtimeRequests.unshift(record);
    await this.writeDb(db);
    return record;
  }

  async approveOvertimeRequest(payload: OvertimeApproveDto, actor?: AuthenticatedActor) {
    const prisma = this.getPrisma();
    if (prisma) {
      const overtime = await prisma.overtimeRequest.findUnique({
        where: { id: payload.overtimeId },
        include: {
          employee: true
        }
      });
      if (!overtime) {
        throw new NotFoundException("Overtime request not found");
      }

      const employee = overtime.employee ? this.mapPrismaEmployee(overtime.employee) : undefined;
      this.assertManagerApprovalScope(actor, employee);
      const updated = await prisma.overtimeRequest.update({
        where: { id: payload.overtimeId },
        data: {
          status: payload.status
        }
      });
      await this.writeAuditLog("overtime.approve", { overtimeId: updated.id, status: payload.status, actor: actor?.name ?? payload.actor });
      return this.mapPrismaOvertimeRecord(updated);
    }

    const db = await this.readDb();
    const overtime = db.overtimeRequests.find((entry) => entry.id === payload.overtimeId);
    if (!overtime) {
      throw new NotFoundException("Overtime request not found");
    }
    const employee = db.employees.find((entry) => entry.id === overtime.userId);
    this.assertManagerApprovalScope(actor, employee);
    overtime.status = payload.status;
    await this.writeDb(db);
    await this.writeAuditLog("overtime.approve", { overtimeId: overtime.id, status: payload.status, actor: actor?.name ?? payload.actor });
    return overtime;
  }

  async getLeaveHistory(query?: { page?: number; pageSize?: number; search?: string; userId?: string; status?: string; type?: string }) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.userId || query?.status || query?.type);
    const prisma = this.getPrisma();
    if (prisma) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.userId ? { userId: query.userId } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.type ? { type: query.type } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search } },
          { type: { contains: search } },
          { reason: { contains: search } },
          { balanceLabel: { contains: search } }
        ];
      }

      if (!shouldPaginate) {
        const rows = await prisma.leaveRequest.findMany({
          where,
          orderBy: { requestedAt: "desc" }
        });
        return rows.map((record: any) => this.toSafeLeaveRecord(this.mapPrismaLeaveRecord(record)));
      }

      const [total, rows] = await Promise.all([
        prisma.leaveRequest.count({ where }),
        prisma.leaveRequest.findMany({
          where,
          orderBy: { requestedAt: "desc" },
          skip: meta.skip,
          take: meta.pageSize
        })
      ]);

      const items = rows.map((record: any) => this.toSafeLeaveRecord(this.mapPrismaLeaveRecord(record)));
      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<LeaveRecord>;
    }

    const db = await this.readDb();
    let records = db.leaveRequests;
    if (query?.userId) {
      records = records.filter((record) => record.userId === query.userId);
    }
    if (query?.status) {
      records = records.filter((record) => record.status === query.status);
    }
    if (query?.type) {
      records = records.filter((record) => record.type === query.type);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      records = records.filter((record) =>
        [record.employeeName, record.type, record.reason, record.balanceLabel].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    const mapped = records.map((record) => this.toSafeLeaveRecord(record));
    if (!shouldPaginate) {
      return mapped;
    }
    return this.paginateArray(mapped, query?.page, query?.pageSize);
  }

  async requestLeave(payload: LeaveRequestDto, file?: Express.Multer.File, supportingDocumentUrl?: string | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findUnique({
        where: { id: payload.userId }
      });
      if (!employeeRow) {
        throw new NotFoundException("Employee not found");
      }

      const employee = this.mapPrismaEmployee(employeeRow);
      const daysRequested = this.getRequestedDays(payload.type, payload.startDate, payload.endDate);
      if (!this.isOnDutyLeaveType(payload.type) && !this.isSickLeaveType(payload.type)) {
        const allocation = this.findLeaveAllocation(employee.leaveBalances, this.isHalfDayLeaveType(payload.type) ? "Annual Leave" : payload.type);
        if (!allocation) {
          throw new BadRequestException("This leave type has not been allocated for the selected employee.");
        }
        if (this.availableLeaveBalance(allocation) < daysRequested) {
          throw new BadRequestException("Insufficient leave balance for this request.");
        }
      }

      const leave = await prisma.leaveRequest.create({
        data: {
          id: `leave-${randomUUID().slice(0, 8)}`,
          userId: payload.userId,
          employeeName: payload.employeeName,
          type: payload.type,
          startDate: this.toDateOnly(payload.startDate) ?? new Date(),
          endDate: this.toDateOnly(payload.endDate) ?? new Date(),
          reason: payload.reason,
          status: "pending-manager",
          approverFlow: ["Manager Pending"],
          balanceLabel: this.describeBalance(employee, payload.type, daysRequested),
          requestedAt: new Date(),
          daysRequested,
          autoApproved: false,
          supportingDocumentName: file?.originalname ?? null,
          supportingDocumentUrl: supportingDocumentUrl ?? null
        }
      });
      const normalized = this.mapPrismaLeaveRecord(leave);
      await this.writeAuditLog("leave.request", {
        leaveId: normalized.id,
        userId: normalized.userId,
        type: normalized.type,
        hasSupportingDocument: Boolean(normalized.supportingDocumentUrl)
      });
      return this.toSafeLeaveRecord(normalized);
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.userId);
    if (!employee) {
      throw new NotFoundException("Employee not found");
    }
    const daysRequested = this.getRequestedDays(payload.type, payload.startDate, payload.endDate);
    if (!this.isOnDutyLeaveType(payload.type) && !this.isSickLeaveType(payload.type)) {
      const allocation = this.findLeaveAllocation(employee.leaveBalances, this.isHalfDayLeaveType(payload.type) ? "Annual Leave" : payload.type);
      if (!allocation) {
        throw new BadRequestException("This leave type has not been allocated for the selected employee.");
      }
      if (this.availableLeaveBalance(allocation) < daysRequested) {
        throw new BadRequestException("Insufficient leave balance for this request.");
      }
    }
    const leave: LeaveRecord = {
      id: `leave-${randomUUID().slice(0, 8)}`,
      requestedAt: new Date().toISOString(),
      status: "pending-manager",
      approverFlow: ["Manager Pending"],
      balanceLabel: this.describeBalance(employee, payload.type, daysRequested),
      daysRequested,
      autoApproved: false,
      supportingDocumentName: file?.originalname ?? null,
      supportingDocumentUrl: supportingDocumentUrl ?? null,
      ...payload
    };

    db.leaveRequests.unshift(leave);
    await this.writeDb(db);
    await this.writeAuditLog("leave.request", {
      leaveId: leave.id,
      userId: leave.userId,
      type: leave.type,
      hasSupportingDocument: Boolean(leave.supportingDocumentUrl)
    });
    return this.toSafeLeaveRecord(leave);
  }
  async approveLeave(payload: LeaveApproveDto, actor?: AuthenticatedActor) {
    const prisma = this.getPrisma();
    if (prisma) {
      const leaveRow = await prisma.leaveRequest.findUnique({
        where: { id: payload.leaveId },
        include: {
          employee: true
        }
      });
      if (!leaveRow) {
        throw new NotFoundException("Leave request not found");
      }

      const leave = this.mapPrismaLeaveRecord(leaveRow);
      const employee = leaveRow.employee ? this.mapPrismaEmployee(leaveRow.employee) : undefined;
      this.assertManagerApprovalScope(actor, employee);
      const wasApproved = leave.status === "approved";
      const nextApproverFlow = [...leave.approverFlow, `${actor?.name ?? payload.actor} -> ${payload.status}`];
      const updates: Record<string, unknown> = {
        status: payload.status,
        approverFlow: nextApproverFlow
      };

      await prisma.$transaction(async (tx: any) => {
        if (payload.status === "approved" && employee && !wasApproved) {
          this.applyLeaveBalance(employee, leave.type, leave.daysRequested);
          const nextBalanceLabel = this.leaveBalanceLabelAfterApproval(employee, leave.type);
          updates.balanceLabel = nextBalanceLabel;

          await tx.employee.update({
            where: { id: employee.id },
            data: {
              leaveBalances: employee.leaveBalances
            }
          });

          if (leave.type === "On Duty Request" || leave.type === "Remote Work") {
            const existingRows = await tx.attendanceLog.findMany({
              where: {
                userId: employee.id,
                timestamp: {
                  gte: new Date(`${leave.startDate}T00:00:00.000Z`),
                  lt: new Date(`${leave.endDate}T23:59:59.999Z`)
                }
              },
              orderBy: { timestamp: "desc" }
            });
            const existingRecords = existingRows.map((record: any) => this.mapPrismaAttendanceRecord(record));
            const generated = this.buildOnDutyAttendanceRecords(employee, leave, existingRecords);
            if (generated.length > 0) {
              await tx.attendanceLog.createMany({
                data: generated.map((record) => ({
                  id: record.id,
                  userId: record.userId,
                  employeeName: record.employeeName,
                  department: record.department,
                  timestamp: this.toDate(record.timestamp) ?? new Date(),
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
            }
          }
        }

        await tx.leaveRequest.update({
          where: { id: leave.id },
          data: updates
        });
      });

      const refreshed = await prisma.leaveRequest.findUnique({
        where: { id: leave.id }
      });
      const result = refreshed ? this.mapPrismaLeaveRecord(refreshed) : { ...leave, ...updates } as LeaveRecord;
      await this.writeAuditLog("leave.approve", { leaveId: leave.id, status: payload.status, actor: actor?.name ?? payload.actor });
      return this.toSafeLeaveRecord(result);
    }

    const db = await this.readDb();
    const leave = db.leaveRequests.find((entry) => entry.id === payload.leaveId);
    if (!leave) {
      throw new NotFoundException("Leave request not found");
    }
    const employee = db.employees.find((entry) => entry.id === leave.userId);
    this.assertManagerApprovalScope(actor, employee);
    const wasApproved = leave.status === "approved";
    leave.status = payload.status;
    leave.approverFlow = [...leave.approverFlow, `${actor?.name ?? payload.actor} -> ${payload.status}`];

    if (payload.status === "approved" && employee && !wasApproved) {
      this.applyLeaveBalance(employee, leave.type, leave.daysRequested);
      leave.balanceLabel = this.leaveBalanceLabelAfterApproval(employee, leave.type);

      if (leave.type === "On Duty Request" || leave.type === "Remote Work") {
        const generated = this.buildOnDutyAttendanceRecords(employee, leave, db.attendanceLogs);
        if (generated.length > 0) {
          db.attendanceLogs = [...generated.reverse(), ...db.attendanceLogs];
        }
      }
    }

    await this.writeDb(db);
    await this.writeAuditLog("leave.approve", { leaveId: leave.id, status: payload.status, actor: actor?.name ?? payload.actor });
    return this.toSafeLeaveRecord(leave);
  }

  async getReimbursementClaimTypes() {
    const prisma = this.getPrisma();
    if (prisma) {
      const rows = await prisma.reimbursementClaimType.findMany({
        orderBy: { updatedAt: "desc" }
      });
      return rows.map((row: any) => this.mapPrismaReimbursementClaimType(row));
    }

    const db = await this.readDb();
    return db.reimbursementClaimTypes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createReimbursementClaimType(payload: CreateReimbursementClaimTypeDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const employeeRow = await prisma.employee.findUnique({
        where: { id: payload.employeeId },
        select: prismaEmployeeIdentitySelect
      });
      const employee = employeeRow ? this.mapPrismaEmployee(employeeRow) : null;
      const claimType = await prisma.reimbursementClaimType.create({
        data: {
          id: `claim-${randomUUID().slice(0, 8)}`,
          employeeId: payload.employeeId,
          employeeName: employee?.name ?? payload.employeeName,
          department: employee?.department ?? payload.department,
          designation: employee?.position ?? payload.designation,
          category: payload.category,
          claimType: payload.claimType,
          subType: payload.subType,
          currency: payload.currency,
          annualLimit: payload.annualLimit,
          remainingBalance: Math.min(payload.remainingBalance, payload.annualLimit),
          active: payload.active,
          notes: payload.notes ?? "",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      return this.mapPrismaReimbursementClaimType(claimType);
    }

    const db = await this.readDb();
    const employee = db.employees.find((entry) => entry.id === payload.employeeId);
    const now = new Date().toISOString();
    const claimType: ReimbursementClaimTypeRecord = {
      id: `claim-${randomUUID().slice(0, 8)}`,
      employeeId: payload.employeeId,
      employeeName: employee?.name ?? payload.employeeName,
      department: employee?.department ?? payload.department,
      designation: employee?.position ?? payload.designation,
      category: payload.category,
      claimType: payload.claimType,
      subType: payload.subType,
      currency: payload.currency,
      annualLimit: payload.annualLimit,
      remainingBalance: Math.min(payload.remainingBalance, payload.annualLimit),
      active: payload.active,
      notes: payload.notes ?? "",
      createdAt: now,
      updatedAt: now
    };
    db.reimbursementClaimTypes.unshift(claimType);
    await this.writeDb(db);
    return claimType;
  }

  async updateReimbursementClaimType(id: string, payload: UpdateReimbursementClaimTypeDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const current = await prisma.reimbursementClaimType.findUnique({
        where: { id }
      });
      if (!current) {
        throw new NotFoundException("Reimbursement claim type not found");
      }

      const employeeRow = payload.employeeId
        ? await prisma.employee.findUnique({
            where: { id: payload.employeeId },
            select: prismaEmployeeIdentitySelect
          })
        : null;
      const employee = employeeRow ? this.mapPrismaEmployee(employeeRow) : null;
      const nextAnnualLimit = payload.annualLimit ?? Number(current.annualLimit);
      const nextRemainingBalance = payload.annualLimit !== undefined && Number(current.remainingBalance) > payload.annualLimit
        ? payload.annualLimit
        : payload.remainingBalance ?? Number(current.remainingBalance);
      const updated = await prisma.reimbursementClaimType.update({
        where: { id },
        data: {
          ...(payload.employeeId ? {
            employeeId: employee?.id ?? payload.employeeId,
            employeeName: employee?.name ?? payload.employeeName ?? current.employeeName,
            department: employee?.department ?? payload.department ?? current.department,
            designation: employee?.position ?? payload.designation ?? current.designation
          } : {}),
          ...(payload.category !== undefined ? { category: payload.category } : {}),
          ...(payload.claimType !== undefined ? { claimType: payload.claimType } : {}),
          ...(payload.subType !== undefined ? { subType: payload.subType } : {}),
          ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
          ...(payload.annualLimit !== undefined ? { annualLimit: nextAnnualLimit } : {}),
          remainingBalance: Math.min(nextRemainingBalance, nextAnnualLimit),
          ...(payload.active !== undefined ? { active: payload.active } : {}),
          ...(payload.notes !== undefined ? { notes: payload.notes ?? "" } : {}),
          updatedAt: new Date()
        }
      });
      return this.mapPrismaReimbursementClaimType(updated);
    }

    const db = await this.readDb();
    const claimType = db.reimbursementClaimTypes.find((entry) => entry.id === id);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }

    const employee = payload.employeeId ? db.employees.find((entry) => entry.id === payload.employeeId) : null;
    Object.assign(claimType, payload);
    if (employee) {
      claimType.employeeId = employee.id;
      claimType.employeeName = employee.name;
      claimType.department = employee.department;
      claimType.designation = employee.position;
    }
    if (payload.annualLimit !== undefined && claimType.remainingBalance > payload.annualLimit) {
      claimType.remainingBalance = payload.annualLimit;
    }
    claimType.updatedAt = new Date().toISOString();
    await this.writeDb(db);
    return claimType;
  }

  async deleteReimbursementClaimType(id: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const exists = await prisma.reimbursementClaimType.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!exists) {
        throw new NotFoundException("Reimbursement claim type not found");
      }
      await prisma.reimbursementClaimType.delete({
        where: { id }
      });
      return { deleted: true, id };
    }

    const db = await this.readDb();
    const exists = db.reimbursementClaimTypes.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Reimbursement claim type not found");
    }
    db.reimbursementClaimTypes = db.reimbursementClaimTypes.filter((entry) => entry.id !== id);
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getReimbursementRequests(query?: ReimbursementRequestListQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.department || query?.status || query?.userId);
    const prisma = this.getPrisma();

    if (prisma) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.department ? { department: query.department } : {}),
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.userId ? { userId: query.userId } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search } },
          { claimType: { contains: search } },
          { subType: { contains: search } },
          { remarks: { contains: search } }
        ];
      }

      if (!shouldPaginate) {
        const rows = await prisma.reimbursementRequest.findMany({
          where,
          orderBy: { updatedAt: "desc" }
        });
        return rows.map((record: any) => this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(record)));
      }

      const [total, rows] = await Promise.all([
        prisma.reimbursementRequest.count({ where }),
        prisma.reimbursementRequest.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: meta.skip,
          take: meta.pageSize
        })
      ]);

      const items = rows.map((record: any) => this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(record)));

      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<ReimbursementRequestRecord>;
    }

    const db = await this.readDb();
    let records = [...db.reimbursementRequests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (query?.userId) {
      records = records.filter((entry) => entry.userId === query.userId);
    }
    if (query?.department) {
      records = records.filter((entry) => entry.department === query.department);
    }
    if (query?.status) {
      records = records.filter((entry) => entry.status === query.status);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      records = records.filter((entry) =>
        [entry.employeeName, entry.claimType, entry.subType, entry.remarks].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    if (!shouldPaginate) {
      return records.map((record) => this.toSafeReimbursementRequest(record));
    }
    const paginated = this.paginateArray(records, query?.page, query?.pageSize);
    return {
      ...paginated,
      items: paginated.items.map((record) => this.toSafeReimbursementRequest(record))
    };
  }

  async createReimbursementRequest(
    payload: CreateReimbursementRequestDto,
    file?: Express.Multer.File,
    receiptFileUrl?: string | null
  ) {
    const prisma = this.getPrisma();
    if (prisma) {
      const claimTypeRow = await prisma.reimbursementClaimType.findFirst({
        where: {
          id: payload.claimTypeId,
          active: true
        }
      });
      const claimType = claimTypeRow ? this.mapPrismaReimbursementClaimType(claimTypeRow) : null;
      if (!claimType) {
        throw new NotFoundException("Reimbursement claim type not found");
      }
      if (claimType.employeeId !== payload.userId) {
        throw new NotFoundException("Claim type is not available for this employee");
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const amount = Number(payload.amount);
      const shouldSubmit = this.parseBooleanFlag((payload as { submit?: unknown }).submit);
      if (shouldSubmit && !file) {
        throw new NotFoundException("Receipt file is required before submitting reimbursement");
      }
      if (shouldSubmit && amount > claimType.remainingBalance) {
        throw new NotFoundException("Requested amount exceeds remaining reimbursement balance");
      }

      const created = await prisma.reimbursementRequest.create({
        data: {
          id: `reimb-${randomUUID().slice(0, 8)}`,
          userId: payload.userId,
          employeeName: payload.employeeName,
          department: payload.department,
          designation: payload.designation,
          claimTypeId: claimType.id,
          claimType: claimType.claimType,
          subType: claimType.subType,
          category: claimType.category,
          currency: payload.currency,
          amount,
          receiptDate: this.toDateOnly(payload.receiptDate) ?? new Date(),
          remarks: payload.remarks ?? "",
          receiptFileName: file?.originalname ?? null,
          receiptFileUrl: receiptFileUrl ?? null,
          status: shouldSubmit ? "pending-manager" : "draft",
          submittedAt: shouldSubmit ? now : null,
          approvedAt: null,
          processedAt: null,
          createdAt: now,
          updatedAt: now,
          approverFlow: shouldSubmit ? ["Employee submitted reimbursement", "Manager pending"] : ["Saved as draft"],
          balanceSnapshot: claimType.remainingBalance
        }
      });
      return this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(created));
    }

    const db = await this.readDb();
    const claimType = this.findReimbursementClaimType(db, payload.claimTypeId);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }
    if (claimType.employeeId !== payload.userId) {
      throw new NotFoundException("Claim type is not available for this employee");
    }

    const now = new Date().toISOString();
    const amount = Number(payload.amount);
    const shouldSubmit = this.parseBooleanFlag((payload as { submit?: unknown }).submit);
    if (shouldSubmit && !file) {
      throw new NotFoundException("Receipt file is required before submitting reimbursement");
    }
    if (shouldSubmit && amount > claimType.remainingBalance) {
      throw new NotFoundException("Requested amount exceeds remaining reimbursement balance");
    }

    const request: ReimbursementRequestRecord = {
      id: `reimb-${randomUUID().slice(0, 8)}`,
      userId: payload.userId,
      employeeName: payload.employeeName,
      department: payload.department,
      designation: payload.designation,
      claimTypeId: claimType.id,
      claimType: claimType.claimType,
      subType: claimType.subType,
      category: claimType.category,
      currency: payload.currency,
      amount,
      receiptDate: payload.receiptDate,
      remarks: payload.remarks ?? "",
      receiptFileName: file?.originalname ?? null,
      receiptFileUrl: receiptFileUrl ?? null,
      status: shouldSubmit ? "pending-manager" : "draft",
      submittedAt: shouldSubmit ? now : null,
      approvedAt: null,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
      approverFlow: shouldSubmit ? ["Employee submitted reimbursement", "Manager pending"] : ["Saved as draft"],
      balanceSnapshot: claimType.remainingBalance
    };

    db.reimbursementRequests.unshift(request);
    await this.writeDb(db);
    return this.toSafeReimbursementRequest(request);
  }

  async updateReimbursementRequest(
    id: string,
    payload: UpdateReimbursementRequestDto,
    file?: Express.Multer.File,
    receiptFileUrl?: string | null
  ) {
    const prisma = this.getPrisma();
    if (prisma) {
      const currentRow = await prisma.reimbursementRequest.findUnique({
        where: { id }
      });
      const request = currentRow ? this.mapPrismaReimbursementRequest(currentRow) : null;
      if (!request) {
        throw new NotFoundException("Reimbursement request not found");
      }
      if (!["draft", "pending-manager"].includes(request.status)) {
        throw new NotFoundException("Only draft or pending manager requests can be updated");
      }

      const claimTypeRow = await prisma.reimbursementClaimType.findFirst({
        where: {
          id: payload.claimTypeId ?? request.claimTypeId,
          active: true
        }
      });
      const claimType = claimTypeRow ? this.mapPrismaReimbursementClaimType(claimTypeRow) : null;
      if (!claimType) {
        throw new NotFoundException("Reimbursement claim type not found");
      }

      const amount = payload.amount !== undefined ? Number(payload.amount) : request.amount;
      const receiptDate = payload.receiptDate ?? request.receiptDate;
      const currency = payload.currency ?? request.currency;
      const remarks = payload.remarks ?? request.remarks;
      const shouldSubmit = this.parseBooleanFlag((payload as { submit?: unknown }).submit);
      const nextReceiptFileUrl = receiptFileUrl ?? request.receiptFileUrl;
      if (shouldSubmit && !nextReceiptFileUrl) {
        throw new NotFoundException("Receipt file is required before submitting reimbursement");
      }
      if (shouldSubmit && amount > claimType.remainingBalance) {
        throw new NotFoundException("Requested amount exceeds remaining reimbursement balance");
      }
      if (file && request.receiptFileUrl) {
        this.removeStoredFile(request.receiptFileUrl);
      }

      this.applyReimbursementClaimDetails(request, claimType, amount, receiptDate, currency, remarks);
      request.receiptFileName = file?.originalname ?? request.receiptFileName;
      request.receiptFileUrl = nextReceiptFileUrl;
      request.updatedAt = new Date().toISOString();
      if (shouldSubmit) {
        request.status = "pending-manager";
        request.submittedAt = request.submittedAt ?? request.updatedAt;
        request.approverFlow = [...request.approverFlow.filter((entry) => entry !== "Saved as draft"), "Submitted to manager"];
      } else if (request.status === "draft") {
        request.approverFlow = ["Saved as draft"];
      }

      const updated = await prisma.reimbursementRequest.update({
        where: { id },
        data: {
          claimTypeId: request.claimTypeId,
          claimType: request.claimType,
          subType: request.subType,
          category: request.category,
          currency: request.currency,
          amount: request.amount,
          receiptDate: this.toDateOnly(request.receiptDate) ?? new Date(),
          remarks: request.remarks,
          receiptFileName: request.receiptFileName,
          receiptFileUrl: request.receiptFileUrl,
          status: request.status,
          submittedAt: this.toDate(request.submittedAt),
          updatedAt: this.toDate(request.updatedAt) ?? new Date(),
          approverFlow: request.approverFlow,
          balanceSnapshot: request.balanceSnapshot
        }
      });
      return this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(updated));
    }

    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === id);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (!["draft", "pending-manager"].includes(request.status)) {
      throw new NotFoundException("Only draft or pending manager requests can be updated");
    }

    const claimType = this.findReimbursementClaimType(db, payload.claimTypeId ?? request.claimTypeId);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }

    const amount = payload.amount !== undefined ? Number(payload.amount) : request.amount;
    const receiptDate = payload.receiptDate ?? request.receiptDate;
    const currency = payload.currency ?? request.currency;
    const remarks = payload.remarks ?? request.remarks;
    const shouldSubmit = this.parseBooleanFlag((payload as { submit?: unknown }).submit);
    const nextReceiptFileUrl = receiptFileUrl ?? request.receiptFileUrl;

    if (shouldSubmit && !nextReceiptFileUrl) {
      throw new NotFoundException("Receipt file is required before submitting reimbursement");
    }
    if (shouldSubmit && amount > claimType.remainingBalance) {
      throw new NotFoundException("Requested amount exceeds remaining reimbursement balance");
    }

    if (file && request.receiptFileUrl) {
      this.removeStoredFile(request.receiptFileUrl);
    }

    this.applyReimbursementClaimDetails(request, claimType, amount, receiptDate, currency, remarks);
    request.receiptFileName = file?.originalname ?? request.receiptFileName;
    request.receiptFileUrl = nextReceiptFileUrl;
    request.updatedAt = new Date().toISOString();

    if (shouldSubmit) {
      request.status = "pending-manager";
      request.submittedAt = request.submittedAt ?? request.updatedAt;
      request.approverFlow = [...request.approverFlow.filter((entry) => entry !== "Saved as draft"), "Submitted to manager"];
    } else if (request.status === "draft") {
      request.approverFlow = ["Saved as draft"];
    }

    await this.writeDb(db);
    return this.toSafeReimbursementRequest(request);
  }

  async managerApproveReimbursement(payload: ReimbursementApproveDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const current = await prisma.reimbursementRequest.findUnique({
        where: { id: payload.reimbursementId }
      });
      const request = current ? this.mapPrismaReimbursementRequest(current) : null;
      if (!request) {
        throw new NotFoundException("Reimbursement request not found");
      }
      if (request.status !== "pending-manager") {
        throw new NotFoundException("Reimbursement is not waiting for manager approval");
      }

      request.status = payload.status === "approved" ? "awaiting-hr" : "rejected";
      request.approvedAt = payload.status === "approved" ? new Date().toISOString() : null;
      request.updatedAt = new Date().toISOString();
      request.approverFlow = [
        ...request.approverFlow,
        payload.status === "approved" ? `${payload.actor} approved, HR pending` : `${payload.actor} rejected`
      ];
      const updated = await prisma.reimbursementRequest.update({
        where: { id: payload.reimbursementId },
        data: {
          status: request.status,
          approvedAt: this.toDate(request.approvedAt),
          updatedAt: this.toDate(request.updatedAt) ?? new Date(),
          approverFlow: request.approverFlow
        }
      });
      await this.writeAuditLog("reimbursement.manager-approve", {
        reimbursementId: updated.id,
        status: payload.status,
        actor: payload.actor
      }, actor);
      return this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(updated));
    }

    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === payload.reimbursementId);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (request.status !== "pending-manager") {
      throw new NotFoundException("Reimbursement is not waiting for manager approval");
    }

    request.status = payload.status === "approved" ? "awaiting-hr" : "rejected";
    request.approvedAt = payload.status === "approved" ? new Date().toISOString() : null;
    request.updatedAt = new Date().toISOString();
    request.approverFlow = [
      ...request.approverFlow,
      payload.status === "approved" ? `${payload.actor} approved, HR pending` : `${payload.actor} rejected`
    ];
    await this.writeDb(db);
    await this.writeAuditLog("reimbursement.manager-approve", {
      reimbursementId: request.id,
      status: payload.status,
      actor: payload.actor
    }, actor);
    return this.toSafeReimbursementRequest(request);
  }

  async hrProcessReimbursement(payload: ReimbursementProcessDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const requestRow = await prisma.reimbursementRequest.findUnique({
        where: { id: payload.reimbursementId }
      });
      const request = requestRow ? this.mapPrismaReimbursementRequest(requestRow) : null;
      if (!request) {
        throw new NotFoundException("Reimbursement request not found");
      }
      if (!["awaiting-hr", "approved"].includes(request.status)) {
        throw new NotFoundException("Reimbursement is not ready for HR processing");
      }

      const claimTypeRow = await prisma.reimbursementClaimType.findUnique({
        where: { id: request.claimTypeId }
      });
      const claimType = claimTypeRow ? this.mapPrismaReimbursementClaimType(claimTypeRow) : null;
      if (!claimType) {
        throw new NotFoundException("Reimbursement claim type not found");
      }

      if (payload.status === "rejected") {
        const updated = await prisma.reimbursementRequest.update({
          where: { id: request.id },
          data: {
            status: "rejected",
            updatedAt: new Date(),
            approverFlow: [...request.approverFlow, `${payload.actor} rejected`]
          }
        });
        await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor }, actor);
        return this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(updated));
      }

      if (payload.status === "approved") {
        const updated = await prisma.reimbursementRequest.update({
          where: { id: request.id },
          data: {
            status: "approved",
            approvedAt: this.toDate(request.approvedAt) ?? new Date(),
            updatedAt: new Date(),
            approverFlow: [...request.approverFlow, `${payload.actor} approved for payout`]
          }
        });
        await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor }, actor);
        return this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(updated));
      }

      if (request.amount > claimType.remainingBalance) {
        throw new NotFoundException("Remaining balance is insufficient to process this reimbursement");
      }

      const processedAt = new Date();
      const updated = await prisma.$transaction(async (tx: any) => {
        await tx.reimbursementClaimType.update({
          where: { id: claimType.id },
          data: {
            remainingBalance: Number((claimType.remainingBalance - request.amount).toFixed(2)),
            updatedAt: processedAt
          }
        });
        return tx.reimbursementRequest.update({
          where: { id: request.id },
          data: {
            status: "processed",
            approvedAt: this.toDate(request.approvedAt) ?? processedAt,
            processedAt,
            updatedAt: processedAt,
            approverFlow: [...request.approverFlow, `${payload.actor} processed reimbursement`]
          }
        });
      });
      await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor }, actor);
      return this.toSafeReimbursementRequest(this.mapPrismaReimbursementRequest(updated));
    }

    const db = await this.readDb();
    const request = db.reimbursementRequests.find((entry) => entry.id === payload.reimbursementId);
    if (!request) {
      throw new NotFoundException("Reimbursement request not found");
    }
    if (!["awaiting-hr", "approved"].includes(request.status)) {
      throw new NotFoundException("Reimbursement is not ready for HR processing");
    }

    const claimType = db.reimbursementClaimTypes.find((entry) => entry.id === request.claimTypeId);
    if (!claimType) {
      throw new NotFoundException("Reimbursement claim type not found");
    }

    if (payload.status === "rejected") {
      request.status = "rejected";
      request.updatedAt = new Date().toISOString();
      request.approverFlow = [...request.approverFlow, `${payload.actor} rejected`];
      await this.writeDb(db);
      await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor }, actor);
      return this.toSafeReimbursementRequest(request);
    }

    if (payload.status === "approved") {
      request.status = "approved";
      request.approvedAt = request.approvedAt ?? new Date().toISOString();
      request.updatedAt = new Date().toISOString();
      request.approverFlow = [...request.approverFlow, `${payload.actor} approved for payout`];
      await this.writeDb(db);
      await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor }, actor);
      return this.toSafeReimbursementRequest(request);
    }

    if (request.amount > claimType.remainingBalance) {
      throw new NotFoundException("Remaining balance is insufficient to process this reimbursement");
    }

    claimType.remainingBalance = Number((claimType.remainingBalance - request.amount).toFixed(2));
    claimType.updatedAt = new Date().toISOString();
    request.status = "processed";
    request.approvedAt = request.approvedAt ?? new Date().toISOString();
    request.processedAt = new Date().toISOString();
    request.updatedAt = request.processedAt;
    request.approverFlow = [...request.approverFlow, `${payload.actor} processed reimbursement`];
    await this.writeDb(db);
    await this.writeAuditLog("reimbursement.hr-process", { reimbursementId: request.id, status: payload.status, actor: payload.actor }, actor);
    return this.toSafeReimbursementRequest(request);
  }

  async getPayrollOverview() {
    const prisma = this.getPrisma();
    if (prisma) {
      if (this.cachedPayrollOverview && this.cachedPayrollOverview.expiresAt > Date.now()) {
        return this.cachedPayrollOverview.value;
      }

      const [latestRunRow, payrollComponents, activeEmployees, draftRuns, publishedPayslips] = await Promise.all([
        prisma.payRun.findFirst({
          orderBy: { periodEnd: "desc" }
        }),
        prisma.payrollComponent.count(),
        prisma.employee.count({ where: { status: "active" } }),
        prisma.payRun.count({ where: { status: "draft" } }),
        prisma.payslip.count({ where: { status: "published" } })
      ]);
      const overview = {
        latestRun: latestRunRow ? this.mapPrismaPayRun(latestRunRow) : null,
        payrollComponents,
        activeEmployees,
        draftRuns,
        publishedPayslips
      };
      this.cachedPayrollOverview = {
        expiresAt: Date.now() + PAYROLL_OVERVIEW_CACHE_TTL_MS,
        value: overview
      };
      return overview;
    }

    const db = await this.readDb();
    const latestRun = [...db.payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
    const draftCount = db.payRuns.filter((run) => run.status === "draft").length;
    const publishedCount = db.payslips.filter((slip) => slip.status === "published").length;
    return {
      latestRun,
      payrollComponents: db.payrollComponents.length,
      activeEmployees: db.employees.filter((employee) => employee.status === "active").length,
      draftRuns: draftCount,
      publishedPayslips: publishedCount
    };
  }

  async getPayrollComponents() {
    const prisma = this.getPrisma();
    if (prisma) {
      if (this.cachedPayrollComponents && this.cachedPayrollComponents.expiresAt > Date.now()) {
        return this.cachedPayrollComponents.items;
      }

      const rows = await prisma.payrollComponent.findMany({
        orderBy: { code: "asc" }
      });
      const items = rows.map((row: any) => this.mapPrismaPayrollComponent(row));
      this.cachedPayrollComponents = {
        expiresAt: Date.now() + PAYROLL_MASTERDATA_CACHE_TTL_MS,
        items
      };
      return items;
    }

    const db = await this.readDb();
    return db.payrollComponents;
  }

  async createPayrollComponent(payload: CreatePayrollComponentDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const component = await prisma.payrollComponent.create({
        data: {
          id: `paycomp-${randomUUID().slice(0, 8)}`,
          code: payload.code.toUpperCase(),
          name: payload.name,
          type: payload.type,
          calculationType: payload.calculationType,
          amount: payload.amount,
          percentage: payload.percentage ?? null,
          taxable: payload.taxable,
          active: payload.active,
          appliesToAll: payload.appliesToAll,
          employeeIds: payload.employeeIds ?? [],
          description: payload.description
        }
      });
      return this.mapPrismaPayrollComponent(component);
    }

    const db = await this.readDb();
    const component: PayrollComponentRecord = {
      id: `paycomp-${randomUUID().slice(0, 8)}`,
      code: payload.code.toUpperCase(),
      name: payload.name,
      type: payload.type,
      calculationType: payload.calculationType,
      amount: payload.amount,
      percentage: payload.percentage ?? null,
      taxable: payload.taxable,
      active: payload.active,
      appliesToAll: payload.appliesToAll,
      employeeIds: payload.employeeIds ?? [],
      description: payload.description
    };
    db.payrollComponents.unshift(component);
    await this.writeDb(db);
    return component;
  }

  async updatePayrollComponent(id: string, payload: UpdatePayrollComponentDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const component = await prisma.payrollComponent.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!component) {
        throw new NotFoundException("Payroll component not found");
      }
      const updated = await prisma.payrollComponent.update({
        where: { id },
        data: {
          ...payload,
          ...(payload.code ? { code: payload.code.toUpperCase() } : {}),
          ...(payload.employeeIds ? { employeeIds: payload.employeeIds } : {})
        }
      });
      return this.mapPrismaPayrollComponent(updated);
    }

    const db = await this.readDb();
    const component = db.payrollComponents.find((entry) => entry.id === id);
    if (!component) {
      throw new NotFoundException("Payroll component not found");
    }
    Object.assign(component, payload, payload.code ? { code: payload.code.toUpperCase() } : {}, payload.employeeIds ? { employeeIds: payload.employeeIds } : {});
    await this.writeDb(db);
    return component;
  }

  async deletePayrollComponent(id: string) {
    const prisma = this.getPrisma();
    if (prisma) {
      const exists = await prisma.payrollComponent.findUnique({
        where: { id },
        select: { id: true }
      });
      if (!exists) {
        throw new NotFoundException("Payroll component not found");
      }
      await prisma.$transaction(async (tx: any) => {
        await tx.$executeRawUnsafe(
          "UPDATE `Employee` SET `financialComponentIds` = JSON_REMOVE(`financialComponentIds`, JSON_UNQUOTE(JSON_SEARCH(`financialComponentIds`, 'one', ?))) WHERE JSON_SEARCH(`financialComponentIds`, 'one', ?) IS NOT NULL",
          id,
          id
        );
        await tx.payrollComponent.delete({
          where: { id }
        });
      });
      return { deleted: true, id };
    }

    const db = await this.readDb();
    const exists = db.payrollComponents.some((entry) => entry.id === id);
    if (!exists) {
      throw new NotFoundException("Payroll component not found");
    }
    db.payrollComponents = db.payrollComponents.filter((entry) => entry.id !== id);
    db.employees = db.employees.map((employee) => ({
      ...employee,
      financialComponentIds: employee.financialComponentIds.filter((componentId) => componentId !== id)
    }));
    await this.writeDb(db);
    return { deleted: true, id };
  }

  async getPayRuns() {
    const prisma = this.getPrisma();
    if (prisma) {
      if (this.cachedPayRuns && this.cachedPayRuns.expiresAt > Date.now()) {
        return this.cachedPayRuns.items;
      }

      const rows = await prisma.payRun.findMany({
        orderBy: { periodEnd: "desc" }
      });
      const items = rows.map((row: any) => this.mapPrismaPayRun(row));
      this.cachedPayRuns = {
        expiresAt: Date.now() + PAYROLL_MASTERDATA_CACHE_TTL_MS,
        items
      };
      return items;
    }

    const db = await this.readDb();
    return [...db.payRuns].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }

  async generatePayrollRun(payload: GeneratePayrollRunDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const [employeeRows, overtimeRows, payrollComponentRows, taxProfileRows] = await Promise.all([
        prisma.employee.findMany({ where: { status: "active" }, orderBy: { name: "asc" } }),
        prisma.overtimeRequest.findMany({ orderBy: { date: "desc" } }),
        prisma.payrollComponent.findMany({ orderBy: { code: "asc" } }),
        prisma.taxProfile.findMany({ orderBy: { name: "asc" } })
      ]);
      const db = {
        employees: employeeRows.map((row: any) => this.mapPrismaEmployee(row)),
        overtimeRequests: overtimeRows.map((row: any) => this.mapPrismaOvertimeRecord(row)),
        payrollComponents: payrollComponentRows.map((row: any) => this.mapPrismaPayrollComponent(row)),
        taxProfiles: taxProfileRows.map((row: any) => this.mapPrismaTaxProfile(row))
      } as Pick<DatabaseShape, "employees" | "overtimeRequests" | "payrollComponents" | "taxProfiles">;
      const payRunId = `payrun-${randomUUID().slice(0, 8)}`;
      const slips = db.employees.map((employee) => this.buildPayslip(employee, db as DatabaseShape, payload, payRunId));
      const payRunCreatedAt = new Date();
      const payRun = await prisma.$transaction(async (tx: any) => {
        await tx.payRun.create({
          data: {
            id: payRunId,
            periodLabel: payload.periodLabel,
            periodStart: this.toDateOnly(payload.periodStart) ?? new Date(),
            periodEnd: this.toDateOnly(payload.periodEnd) ?? new Date(),
            payDate: this.toDateOnly(payload.payDate) ?? new Date(),
            status: "draft",
            totalGross: slips.reduce((sum, slip) => sum + slip.grossPay, 0),
            totalNet: slips.reduce((sum, slip) => sum + slip.netPay, 0),
            totalTax: slips.reduce((sum, slip) => sum + slip.taxDeduction, 0),
            employeeCount: slips.length,
            createdAt: payRunCreatedAt,
            publishedAt: null
          }
        });
        if (slips.length > 0) {
          await tx.payslip.createMany({
            data: slips.map((slip) => ({
              id: slip.id,
              payRunId: slip.payRunId,
              userId: slip.userId,
              employeeName: slip.employeeName,
              employeeNumber: slip.employeeNumber,
              department: slip.department,
              position: slip.position,
              periodLabel: slip.periodLabel,
              periodStart: this.toDateOnly(slip.periodStart) ?? new Date(),
              periodEnd: this.toDateOnly(slip.periodEnd) ?? new Date(),
              payDate: this.toDateOnly(slip.payDate) ?? new Date(),
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
        }
        return tx.payRun.findUnique({ where: { id: payRunId } });
      });
      const normalizedPayRun = payRun ? this.mapPrismaPayRun(payRun) : {
        id: payRunId,
        periodLabel: payload.periodLabel,
        periodStart: payload.periodStart,
        periodEnd: payload.periodEnd,
        payDate: payload.payDate,
        status: "draft",
        totalGross: slips.reduce((sum, slip) => sum + slip.grossPay, 0),
        totalNet: slips.reduce((sum, slip) => sum + slip.netPay, 0),
        totalTax: slips.reduce((sum, slip) => sum + slip.taxDeduction, 0),
        employeeCount: slips.length,
        createdAt: payRunCreatedAt.toISOString(),
        publishedAt: null
      } as PayRunRecord;
      await this.writeAuditLog("payroll.generate-run", { payRunId, periodLabel: payload.periodLabel, employeeCount: slips.length }, actor);
      return { payRun: normalizedPayRun, payslips: slips };
    }

    const db = await this.readDb();
    const activeEmployees = db.employees.filter((employee) => employee.status === "active");
    const payRunId = `payrun-${randomUUID().slice(0, 8)}`;
    const slips = activeEmployees.map((employee) => this.buildPayslip(employee, db, payload, payRunId));
    const payRun: PayRunRecord = {
      id: payRunId,
      periodLabel: payload.periodLabel,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      payDate: payload.payDate,
      status: "draft",
      totalGross: slips.reduce((sum, slip) => sum + slip.grossPay, 0),
      totalNet: slips.reduce((sum, slip) => sum + slip.netPay, 0),
      totalTax: slips.reduce((sum, slip) => sum + slip.taxDeduction, 0),
      employeeCount: slips.length,
      createdAt: new Date().toISOString(),
      publishedAt: null
    };
    db.payRuns.unshift(payRun);
    db.payslips = [...slips, ...db.payslips.filter((slip) => slip.payRunId !== payRunId)];
    await this.writeDb(db);
    await this.writeAuditLog("payroll.generate-run", { payRunId, periodLabel: payload.periodLabel, employeeCount: slips.length }, actor);
    return { payRun, payslips: slips };
  }

  async publishPayrollRun(payload: PublishPayrollRunDto, actor?: AuthenticatedActor | null) {
    const prisma = this.getPrisma();
    if (prisma) {
      const payRun = await prisma.payRun.findUnique({
        where: { id: payload.payRunId }
      });
      if (!payRun) {
        throw new NotFoundException("Pay run not found");
      }
      const publishedAt = new Date();
      const updated = await prisma.$transaction(async (tx: any) => {
        await tx.payslip.updateMany({
          where: { payRunId: payload.payRunId },
          data: { status: "published" }
        });
        return tx.payRun.update({
          where: { id: payload.payRunId },
          data: {
            status: "published",
            publishedAt
          }
        });
      });
      await this.writeAuditLog("payroll.publish-run", { payRunId: updated.id, periodLabel: updated.periodLabel }, actor);
      return this.mapPrismaPayRun(updated);
    }

    const db = await this.readDb();
    const payRun = db.payRuns.find((entry) => entry.id === payload.payRunId);
    if (!payRun) {
      throw new NotFoundException("Pay run not found");
    }
    payRun.status = "published";
    payRun.publishedAt = new Date().toISOString();
    db.payslips = db.payslips.map((slip) => slip.payRunId === payRun.id ? { ...slip, status: "published" } : slip);
    await this.writeDb(db);
    await this.writeAuditLog("payroll.publish-run", { payRunId: payRun.id, periodLabel: payRun.periodLabel }, actor);
    return payRun;
  }

  async getPayslips(query?: PayslipListQueryDto) {
    const shouldPaginate = Boolean(query?.page || query?.pageSize || query?.search || query?.status || query?.userId);
    const prisma = this.getPrisma();

    if (prisma) {
      const meta = this.toPageMeta(query?.page, query?.pageSize);
      const useCachedFirstPage = shouldPaginate && meta.page === 1 && !query?.search?.trim() && !query?.status;
      const firstPageCacheKey = useCachedFirstPage ? this.buildPayslipFirstPageCacheKey(query) : null;
      const cachedFirstPage = firstPageCacheKey ? this.cachedPayslipFirstPage.get(firstPageCacheKey) : null;
      if (cachedFirstPage && cachedFirstPage.expiresAt > Date.now() && cachedFirstPage.pageSize === meta.pageSize) {
        return {
          items: cachedFirstPage.items,
          total: cachedFirstPage.total,
          page: meta.page,
          pageSize: meta.pageSize,
          hasNext: meta.pageSize < cachedFirstPage.total
        } satisfies PaginatedResult<PayslipRecord>;
      }

      const search = query?.search?.trim();
      const where: Record<string, unknown> = {
        ...(query?.userId ? { userId: query.userId } : {}),
        ...(query?.status ? { status: query.status } : {})
      };

      if (search) {
        where.OR = [
          { employeeName: { contains: search } },
          { employeeNumber: { contains: search } },
          { periodLabel: { contains: search } },
          { department: { contains: search } }
        ];
      }

      if (!shouldPaginate) {
        const rows = await prisma.payslip.findMany({
          where,
          orderBy: { payDate: "desc" }
        });
        return rows.map((record: any) => this.mapPrismaPayslip(record));
      }

      const [total, rows] = await Promise.all([
        prisma.payslip.count({ where }),
        prisma.payslip.findMany({
          where,
          orderBy: { payDate: "desc" },
          skip: meta.skip,
          take: meta.pageSize,
          select: prismaPayslipListSelect
        })
      ]);

      const items = rows.map((record: any) => this.mapPrismaPayslipListRecord(record));
      if (firstPageCacheKey) {
        this.cachedPayslipFirstPage.set(firstPageCacheKey, {
          items,
          total,
          pageSize: meta.pageSize,
          expiresAt: Date.now() + PAYSLIP_FIRST_PAGE_CACHE_TTL_MS
        });
      }

      return {
        items,
        total,
        page: meta.page,
        pageSize: meta.pageSize,
        hasNext: meta.skip + items.length < total
      } satisfies PaginatedResult<PayslipRecord>;
    }

    const db = await this.readDb();
    let slips = query?.userId ? db.payslips.filter((slip) => slip.userId === query.userId) : db.payslips;
    if (query?.status) {
      slips = slips.filter((slip) => slip.status === query.status);
    }
    if (query?.search?.trim()) {
      const search = query.search.trim().toLowerCase();
      slips = slips.filter((slip) =>
        [slip.employeeName, slip.employeeNumber, slip.periodLabel, slip.department].some((value) =>
          value.toLowerCase().includes(search)
        )
      );
    }
    const sorted = [...slips].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    if (!shouldPaginate) {
      return sorted;
    }
    return this.paginateArray(sorted, query?.page, query?.pageSize);
  }

  async exportPayslip(payload: ExportPayslipDto) {
    return this.enqueueExportJob({ type: "payslip", payload });
  }

  async generateExport(payload: CreateExportDto) {
    return this.enqueueExportJob({ type: "report", payload });
  }

  async getExportJobStatus(jobId: string) {
    const job = this.exportQueue.find((entry) => entry.id === jobId);
    if (!job) {
      throw new NotFoundException("Export job not found");
    }

    return {
      jobId: job.id,
      status: job.status,
      fileName: job.result?.fileName ?? null,
      fileUrl: job.result?.fileUrl ?? null,
      payslipId: job.result?.payslipId ?? null,
      error: job.error
    };
  }

  private enqueueExportJob(payload: ExportJobPayload) {
    const now = new Date().toISOString();
    const job: ExportJob = {
      id: `exp-${randomUUID().slice(0, 10)}`,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      payload,
      result: null,
      error: null
    };

    this.exportQueue.unshift(job);
    if (this.exportQueue.length > 100) {
      this.exportQueue = this.exportQueue.slice(0, 100);
    }
    this.scheduleExportQueueProcessing();
    return { jobId: job.id, status: job.status };
  }

  private scheduleExportQueueProcessing() {
    if (this.exportWorkerScheduled || this.activeExportJob) {
      return;
    }
    this.exportWorkerScheduled = true;
    setTimeout(() => {
      this.exportWorkerScheduled = false;
      void this.processExportQueue().catch(() => undefined);
    }, 0);
  }

  private async processExportQueue() {
    if (this.activeExportJob) {
      return;
    }

    this.activeExportJob = true;
    try {
      while (true) {
        const nextJob = this.exportQueue.find((entry) => entry.status === "queued");
        if (!nextJob) {
          break;
        }

        nextJob.status = "processing";
        nextJob.updatedAt = new Date().toISOString();
        try {
          nextJob.result = nextJob.payload.type === "report"
            ? await this.performReportExport(nextJob.payload.payload)
            : await this.performPayslipExport(nextJob.payload.payload);
          nextJob.status = "done";
          nextJob.error = null;
        } catch (error) {
          nextJob.status = "failed";
          nextJob.error = error instanceof Error ? error.message : "Export job failed";
        } finally {
          nextJob.updatedAt = new Date().toISOString();
        }
      }
    } finally {
      this.activeExportJob = false;
      if (this.exportQueue.some((entry) => entry.status === "queued")) {
        this.scheduleExportQueueProcessing();
      }
    }
  }

  private async performPayslipExport(payload: ExportPayslipDto) {
    const prisma = this.getPrisma();
    if (prisma) {
      const payslipRow = await prisma.payslip.findUnique({
        where: { id: payload.payslipId }
      });
      const payslip = payslipRow ? this.mapPrismaPayslip(payslipRow) : null;
      if (!payslip) {
        throw new NotFoundException("Payslip not found");
      }
      const fileName = `${this.safeFileBaseName(payslip.employeeNumber, "employee")}-${this.safeFileBaseName(payslip.periodLabel, "payslip")}.xlsx`;
      const fullPath = path.join(this.storageRoot, "documents", fileName);

      const rows = [
        ["Employee Name", payslip.employeeName],
        ["Employee Number", payslip.employeeNumber],
        ["Department", payslip.department],
        ["Position", payslip.position],
        ["Period", payslip.periodLabel],
        ["Pay Date", payslip.payDate],
        [""],
        ["Earnings", "Amount"],
        ["Base Salary", payslip.baseSalary],
        ["Allowance", payslip.allowance],
        ["Overtime", payslip.overtimePay],
        ["Additional Earnings", payslip.additionalEarnings],
        [""],
        ["Deductions", "Amount"],
        ["Tax Deduction", payslip.taxDeduction],
        ["Other Deductions", payslip.otherDeductions],
        [""],
        ["Net Pay", payslip.netPay]
      ];

      await this.writeWorkbookFromRows(fullPath, "Payslip", rows);

      const generatedFileUrl = `/storage/documents/${fileName}`;
      await prisma.payslip.update({
        where: { id: payslip.id },
        data: {
          generatedFileUrl
        }
      });
      return { fileName, fileUrl: generatedFileUrl, payslipId: payslip.id };
    }

    const db = await this.readDb();
    const payslip = db.payslips.find((entry) => entry.id === payload.payslipId);
    if (!payslip) {
      throw new NotFoundException("Payslip not found");
    }
    const fileName = `${this.safeFileBaseName(payslip.employeeNumber, "employee")}-${this.safeFileBaseName(payslip.periodLabel, "payslip")}.xlsx`;
    const fullPath = path.join(this.storageRoot, "documents", fileName);

    const rows = [
      ["Employee Name", payslip.employeeName],
      ["Employee Number", payslip.employeeNumber],
      ["Department", payslip.department],
      ["Position", payslip.position],
      ["Period", payslip.periodLabel],
      ["Pay Date", payslip.payDate],
      [""],
      ["Earnings", "Amount"],
      ["Base Salary", payslip.baseSalary],
      ["Allowance", payslip.allowance],
      ["Overtime", payslip.overtimePay],
      ["Additional Earnings", payslip.additionalEarnings],
      [""],
      ["Deductions", "Amount"],
      ["Tax Deduction", payslip.taxDeduction],
      ["Other Deductions", payslip.otherDeductions],
      [""],
      ["Net Pay", payslip.netPay]
    ];

    await this.writeWorkbookFromRows(fullPath, "Payslip", rows);

    payslip.generatedFileUrl = `/storage/documents/${fileName}`;
    await this.writeDb(db);
    return { fileName, fileUrl: payslip.generatedFileUrl, payslipId: payslip.id };
  }

  private async performReportExport(payload: CreateExportDto) {
    const extension = (payload.fileExtension ?? (Array.isArray(payload.columns) || Array.isArray(payload.rows) ? "xlsx" : "txt"))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "txt";

    const reportSlug = this.safeFileBaseName(payload.reportName, "report");
    const fileName = `${reportSlug}-${Date.now()}.${extension}`;
    const fullPath = path.join(this.storageRoot, "exports", fileName);

    if (extension === "xlsx") {
      const columns = Array.isArray(payload.columns) ? payload.columns.map((item) => String(item)) : [];
      const rows = Array.isArray(payload.rows)
        ? payload.rows
            .filter((entry): entry is unknown[] => Array.isArray(entry))
            .map((row) => row.map((cell) => (cell == null ? "" : String(cell))))
        : [];
      const workbookRows = columns.length > 0 ? [columns, ...rows] : rows;
      await this.writeWorkbookFromRows(fullPath, (payload.sheetName?.trim() || "Report").slice(0, 31), workbookRows);
      return { fileName, fileUrl: `/storage/exports/${fileName}` };
    }

    const content = payload.content ?? "Generated from PulsePresence local export service.";
    await writeFile(fullPath, content, "utf8");
    return { fileName, fileUrl: `/storage/exports/${fileName}` };
  }

  private async writeWorkbookFromRows(filePath: string, sheetName: string, rows: Array<Array<string | number>>) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || "Sheet1");
    for (const row of rows) {
      worksheet.addRow(row);
    }

    if (rows.length > 0) {
      const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
      worksheet.columns = Array.from({ length: maxColumns }, (_, index) => {
        const maxLength = rows.reduce((longest, row) => {
          const value = row[index];
          const text = value == null ? "" : String(value);
          return Math.max(longest, text.length);
        }, 0);
        return { width: Math.min(Math.max(maxLength + 2, 12), 40) };
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }
}






























