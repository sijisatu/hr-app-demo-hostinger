import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  nik!: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  birthPlace!: string;

  @IsString()
  birthDate!: string;

  @IsIn(["male", "female"])
  gender!: "male" | "female";

  @IsIn(["single", "married", "divorced", "widowed"])
  maritalStatus!: "single" | "married" | "divorced" | "widowed";

  @IsOptional()
  @IsString()
  marriageDate?: string | null;

  @IsString()
  address!: string;

  @IsString()
  idCardNumber!: string;

  @IsString()
  education!: string;

  @IsString()
  workExperience!: string;

  @IsOptional()
  educationHistory?: unknown[];

  @IsOptional()
  workExperiences?: unknown[];

  @IsString()
  department!: string;

  @IsString()
  position!: string;

  @IsIn(["admin", "hr", "employee", "manager"])
  role!: "admin" | "hr" | "employee" | "manager";

  @IsIn(["active", "inactive"])
  status!: "active" | "inactive";

  @IsString()
  phone!: string;

  @IsString()
  workLocation!: string;

  @IsIn(["onsite", "hybrid", "remote"])
  workType!: "onsite" | "hybrid" | "remote";

  @IsString()
  managerName!: string;

  @IsIn(["permanent", "contract", "intern"])
  employmentType!: "permanent" | "contract" | "intern";

  @IsIn(["permanent", "contract", "intern"])
  contractStatus!: "permanent" | "contract" | "intern";

  @IsString()
  contractStart!: string;

  @IsOptional()
  @IsString()
  contractEnd?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowance!: number;

  @IsOptional()
  @IsString()
  positionSalaryId?: string | null;

  @IsOptional()
  financialComponentIds?: string[];

  @IsOptional()
  @IsString()
  taxProfileId?: string | null;

  @IsString()
  taxProfile!: string;

  @IsString()
  bankName!: string;

  @IsString()
  bankAccountMasked!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  appLoginEnabled?: boolean;

  @IsOptional()
  @IsString()
  loginUsername?: string | null;

  @IsOptional()
  @IsString()
  loginPassword?: string | null;

  @IsOptional()
  leaveBalances?: Record<string, unknown>;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  nik?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsIn(["male", "female"])
  gender?: "male" | "female";

  @IsOptional()
  @IsIn(["single", "married", "divorced", "widowed"])
  maritalStatus?: "single" | "married" | "divorced" | "widowed";

  @IsOptional()
  @IsString()
  marriageDate?: string | null;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  idCardNumber?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  workExperience?: string;

  @IsOptional()
  educationHistory?: unknown[];

  @IsOptional()
  workExperiences?: unknown[];

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsIn(["admin", "hr", "employee", "manager"])
  role?: "admin" | "hr" | "employee" | "manager";

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsIn(["onsite", "hybrid", "remote"])
  workType?: "onsite" | "hybrid" | "remote";

  @IsOptional()
  @IsString()
  managerName?: string;

  @IsOptional()
  @IsIn(["permanent", "contract", "intern"])
  employmentType?: "permanent" | "contract" | "intern";

  @IsOptional()
  @IsIn(["permanent", "contract", "intern"])
  contractStatus?: "permanent" | "contract" | "intern";

  @IsOptional()
  @IsString()
  contractStart?: string;

  @IsOptional()
  @IsString()
  contractEnd?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowance?: number;

  @IsOptional()
  @IsString()
  positionSalaryId?: string | null;

  @IsOptional()
  financialComponentIds?: string[];

  @IsOptional()
  @IsString()
  taxProfileId?: string | null;

  @IsOptional()
  @IsString()
  taxProfile?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountMasked?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  appLoginEnabled?: boolean;

  @IsOptional()
  @IsString()
  loginUsername?: string | null;

  @IsOptional()
  @IsString()
  loginPassword?: string | null;

  @IsOptional()
  leaveBalances?: Record<string, unknown>;
}

export class UploadEmployeeDocumentDto {
  @IsIn(["ktp", "ijazah", "sertifikat", "npwp", "kk", "kontrak-kerja", "bpjs", "lainnya"])
  type!: "ktp" | "ijazah" | "sertifikat" | "npwp" | "kk" | "kontrak-kerja" | "bpjs" | "lainnya";

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EmployeeLoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ResetEmployeePasswordDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class CheckInDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  department!: string;

  @IsString()
  location!: string;

  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  longitude!: number;
}

export class CheckOutDto {
  @IsString()
  attendanceId!: string;

  @IsOptional()
  @IsString()
  checkOut?: string;
}

export class CreateOvertimeDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  department!: string;

  @IsString()
  date!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minutes!: number;

  @IsString()
  reason!: string;
}

export class LeaveRequestDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  type!: string;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  supportingDocumentName?: string | null;
}

export class LeaveApproveDto {
  @IsString()
  leaveId!: string;

  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";

  @IsString()
  actor!: string;
}


export class OvertimeApproveDto {
  @IsString()
  overtimeId!: string;

  @IsIn(["approved", "rejected", "paid"])
  status!: "approved" | "rejected" | "paid";

  @IsString()
  actor!: string;
}

export class CreateReimbursementClaimTypeDto {
  @IsString()
  employeeId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  department!: string;

  @IsString()
  designation!: string;

  @IsIn(["medical", "glasses", "maternity", "transport", "communication", "wellness", "other"])
  category!: "medical" | "glasses" | "maternity" | "transport" | "communication" | "wellness" | "other";

  @IsString()
  claimType!: string;

  @IsString()
  subType!: string;

  @IsString()
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualLimit!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  remainingBalance!: number;

  @Type(() => Boolean)
  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReimbursementClaimTypeDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  employeeName?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsIn(["medical", "glasses", "maternity", "transport", "communication", "wellness", "other"])
  category?: "medical" | "glasses" | "maternity" | "transport" | "communication" | "wellness" | "other";

  @IsOptional()
  @IsString()
  claimType?: string;

  @IsOptional()
  @IsString()
  subType?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  remainingBalance?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReimbursementRequestDto {
  @IsString()
  userId!: string;

  @IsString()
  employeeName!: string;

  @IsString()
  department!: string;

  @IsString()
  designation!: string;

  @IsString()
  claimTypeId!: string;

  @IsString()
  currency!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  receiptDate!: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1" || value === 1)
  @IsBoolean()
  submit?: boolean;
}

export class UpdateReimbursementRequestDto {
  @IsOptional()
  @IsString()
  claimTypeId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  receiptDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true" || value === "1" || value === 1)
  @IsBoolean()
  submit?: boolean;
}

export class ReimbursementApproveDto {
  @IsString()
  reimbursementId!: string;

  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";

  @IsString()
  actor!: string;
}

export class ReimbursementProcessDto {
  @IsString()
  reimbursementId!: string;

  @IsIn(["approved", "rejected", "processed"])
  status!: "approved" | "rejected" | "processed";

  @IsString()
  actor!: string;
}

export class CreatePayrollComponentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsIn(["earning", "deduction"])
  type!: "earning" | "deduction";

  @IsIn(["fixed", "percentage"])
  calculationType!: "fixed" | "percentage";

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percentage?: number | null;

  @Type(() => Boolean)
  @IsBoolean()
  taxable!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  active!: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  appliesToAll!: boolean;

  @IsOptional()
  employeeIds?: string[];

  @IsString()
  description!: string;
}

export class CreateCompensationProfileDto {
  @IsString()
  position!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary!: number;

  @Type(() => Boolean)
  @IsBoolean()
  active!: boolean;

  @IsString()
  notes!: string;
}

export class UpdateCompensationProfileDto {
  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTaxProfileDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate!: number;

  @Type(() => Boolean)
  @IsBoolean()
  active!: boolean;

  @IsString()
  description!: string;
}

export class UpdateTaxProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePayrollComponentDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(["earning", "deduction"])
  type?: "earning" | "deduction";

  @IsOptional()
  @IsIn(["fixed", "percentage"])
  calculationType?: "fixed" | "percentage";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  percentage?: number | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  taxable?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  appliesToAll?: boolean;

  @IsOptional()
  employeeIds?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}

export class GeneratePayrollRunDto {
  @IsString()
  periodLabel!: string;

  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;

  @IsString()
  payDate!: string;
}

export class PublishPayrollRunDto {
  @IsString()
  payRunId!: string;
}

export class ExportPayslipDto {
  @IsString()
  payslipId!: string;
}

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @Type(() => Boolean)
  @IsBoolean()
  active!: boolean;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

export class EmployeeListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsIn(["admin", "hr", "employee", "manager"])
  role?: "admin" | "hr" | "employee" | "manager";

  @IsOptional()
  @IsIn(["active", "inactive"])
  status?: "active" | "inactive";
}

export class AttendanceHistoryQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsIn(["on-time", "late", "absent", "early-leave"])
  status?: "on-time" | "late" | "absent" | "early-leave";
}

export class ReimbursementRequestListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class PayslipListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AuditLogListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  eventKey?: string;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  actorRole?: string;

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class CreateExportDto {
  @IsString()
  reportName!: string;

  @IsOptional()
  @IsString()
  sheetName?: string;

  @IsOptional()
  @IsString()
  fileExtension?: string;

  @IsOptional()
  columns?: unknown[];

  @IsOptional()
  rows?: unknown[];

  @IsOptional()
  @IsString()
  content?: string;
}

export class ExportJobStatusQueryDto {
  @IsString()
  jobId!: string;
}



