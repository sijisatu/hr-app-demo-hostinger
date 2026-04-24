export type AttendanceStatus = "on-time" | "late" | "absent" | "early-leave";
export type LeaveStatus = "pending-manager" | "awaiting-hr" | "approved" | "rejected";
export type LeaveType = string;
export type EmploymentType = "permanent" | "contract" | "intern";
export type ContractStatus = "permanent" | "contract" | "intern";
export type OvertimeStatus = "pending" | "approved" | "rejected" | "paid";
export type PayrollComponentType = "earning" | "deduction";
export type PayrollCalculationType = "fixed" | "percentage";
export type PayRunStatus = "draft" | "published";
export type PayslipStatus = "draft" | "published";
export type ReimbursementStatus = "draft" | "pending-manager" | "awaiting-hr" | "approved" | "rejected" | "processed";
export type ReimbursementCategory = "medical" | "glasses" | "maternity" | "transport" | "communication" | "wellness" | "other";
export type Gender = "male" | "female";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";

export type AuditLogRecord = {
  id: string;
  eventKey: string;
  module: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  summary: string;
  beforeData: unknown | null;
  afterData: unknown | null;
  metadata: unknown | null;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
  createdAt: string;
};

export type LeaveBalanceAllocation = {
  code: string;
  label: string;
  days: number;
  carryOver: number;
  carryOverExpiresAt: string | null;
};

export type LeaveBalance = {
  [legacyKey: string]: unknown;
  enabledTypes?: string[];
  allocations?: LeaveBalanceAllocation[];
  sickUsed: number;
  balanceYear: number;
};

export type EducationRecord = {
  level: string;
  institution: string;
  major: string;
  startYear: string;
  endYear: string;
};

export type WorkExperienceRecord = {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type EmployeeDocumentType =
  | "ktp"
  | "ijazah"
  | "sertifikat"
  | "npwp"
  | "kk"
  | "kontrak-kerja"
  | "bpjs"
  | "lainnya";

export type EmployeeDocumentRecord = {
  id: string;
  employeeId: string;
  type: EmployeeDocumentType;
  title: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
  notes: string;
};

export type EmployeeRecord = {
  id: string;
  employeeNumber: string;
  nik: string;
  name: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  marriageDate: string | null;
  address: string;
  idCardNumber: string;
  education: string;
  workExperience: string;
  educationHistory: EducationRecord[];
  workExperiences: WorkExperienceRecord[];
  department: string;
  position: string;
  role: "admin" | "hr" | "employee" | "manager";
  status: "active" | "inactive";
  phone: string;
  joinDate: string;
  workLocation: string;
  workType: "onsite" | "hybrid" | "remote";
  managerName: string;
  employmentType: EmploymentType;
  contractStatus: ContractStatus;
  contractStart: string;
  contractEnd: string | null;
  baseSalary: number;
  allowance: number;
  positionSalaryId: string | null;
  financialComponentIds: string[];
  taxProfileId: string | null;
  taxProfile: string;
  bankName: string;
  bankAccountMasked: string;
  appLoginEnabled: boolean;
  loginUsername: string | null;
  loginPassword: string | null;
  documents: EmployeeDocumentRecord[];
  leaveBalances: LeaveBalance;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  timestamp: string;
  checkIn: string;
  checkOut: string | null;
  location: string;
  latitude: number;
  longitude: number;
  description: string;
  gpsValidated: boolean;
  gpsDistanceMeters: number;
  photoUrl: string | null;
  status: AttendanceStatus;
  overtimeMinutes: number;
};


export type OvertimeRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  date: string;
  minutes: number;
  reason: string;
  status: OvertimeStatus;
};

export type LeaveRecord = {
  id: string;
  userId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  approverFlow: string[];
  balanceLabel: string;
  requestedAt: string;
  daysRequested: number;
  autoApproved: boolean;
  supportingDocumentName: string | null;
  supportingDocumentUrl: string | null;
};

export type PayrollComponentRecord = {
  id: string;
  code: string;
  name: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  amount: number;
  percentage: number | null;
  taxable: boolean;
  active: boolean;
  appliesToAll: boolean;
  employeeIds: string[];
  description: string;
};

export type CompensationProfileRecord = {
  id: string;
  position: string;
  baseSalary: number;
  active: boolean;
  notes: string;
};

export type DepartmentRecord = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TaxProfileRecord = {
  id: string;
  name: string;
  rate: number;
  active: boolean;
  description: string;
};

export type PayslipLineItem = {
  code: string;
  name: string;
  type: PayrollComponentType;
  amount: number;
  taxable: boolean;
  source: "base-salary" | "allowance" | "overtime" | "component" | "tax";
};

export type PayslipRecord = {
  id: string;
  payRunId: string;
  userId: string;
  employeeName: string;
  employeeNumber: string;
  department: string;
  position: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayslipStatus;
  baseSalary: number;
  allowance: number;
  overtimePay: number;
  additionalEarnings: number;
  grossPay: number;
  taxDeduction: number;
  otherDeductions: number;
  netPay: number;
  bankName: string;
  bankAccountMasked: string;
  taxProfile: string;
  components: PayslipLineItem[];
  generatedFileUrl: string | null;
};

export type PayRunRecord = {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: PayRunStatus;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  employeeCount: number;
  createdAt: string;
  publishedAt: string | null;
};

export type ReimbursementClaimTypeRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  category: ReimbursementCategory;
  claimType: string;
  subType: string;
  currency: string;
  annualLimit: number;
  remainingBalance: number;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ReimbursementRequestRecord = {
  id: string;
  userId: string;
  employeeName: string;
  department: string;
  designation: string;
  claimTypeId: string;
  claimType: string;
  subType: string;
  category: ReimbursementCategory;
  currency: string;
  amount: number;
  receiptDate: string;
  remarks: string;
  receiptFileName: string | null;
  receiptFileUrl: string | null;
  status: ReimbursementStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  approverFlow: string[];
  balanceSnapshot: number;
};

export type DatabaseShape = {
  departments: DepartmentRecord[];
  employees: EmployeeRecord[];
  attendanceLogs: AttendanceRecord[];
  overtimeRequests: OvertimeRecord[];
  leaveRequests: LeaveRecord[];
  reimbursementClaimTypes: ReimbursementClaimTypeRecord[];
  reimbursementRequests: ReimbursementRequestRecord[];
  compensationProfiles: CompensationProfileRecord[];
  taxProfiles: TaxProfileRecord[];
  payrollComponents: PayrollComponentRecord[];
  payRuns: PayRunRecord[];
  payslips: PayslipRecord[];
};

