import { getApiBase, getLocalApiFallbackBase, shouldTryLocalApiFallback } from "@/lib/api-base";
import { authCookieName } from "@/lib/auth-config";

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
};

export type PaginatedList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

export type LeaveBalanceAllocation = {
  code: string;
  label: string;
  days: number;
  carryOver: number;
  carryOverExpiresAt: string | null;
};

export type LeaveBalance = {
  allocations: LeaveBalanceAllocation[];
  sickUsed: number;
  balanceYear: number;
};

export type Gender = "male" | "female";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
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

export type PayrollComponentType = "earning" | "deduction";
export type PayrollCalculationType = "fixed" | "percentage";
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
  employmentType: "permanent" | "contract" | "intern";
  contractStatus: "permanent" | "contract" | "intern";
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
  status: "on-time" | "late" | "absent" | "early-leave";
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
  status: "pending" | "approved" | "rejected" | "paid";
};

export type LeaveType = string;

export type LeaveRecord = {
  id: string;
  userId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending-manager" | "awaiting-hr" | "approved" | "rejected";
  approverFlow: string[];
  balanceLabel: string;
  requestedAt: string;
  daysRequested: number;
  autoApproved: boolean;
  supportingDocumentName: string | null;
  supportingDocumentUrl: string | null;
};

export type ReimbursementStatus = "draft" | "pending-manager" | "awaiting-hr" | "approved" | "rejected" | "processed";
export type ReimbursementCategory = "medical" | "glasses" | "maternity" | "transport" | "communication" | "wellness" | "other";

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

export type DashboardSummary = {
  employees: number;
  onTime: number;
  late: number;
  absent: number;
  leavePending: number;
  storageMode: string;
};

export type AttendanceOverview = {
  checkedInToday: number;
  openCheckIns: number;
  gpsValidated: number;
  selfieCaptured: number;
  overtimeHours: number;
};

export type AttendanceSeriesItem = {
  label: string;
  present: number;
  absent: number;
};

export type ActivityItem = {
  id: string;
  name: string;
  time: string;
  detail: string;
  status: "live" | "alert";
};

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

export type Performer = {
  name: string;
  role: string;
  score: string;
};

export type DepartmentHealth = {
  name: string;
  value: number;
  tone: "primary" | "danger";
};

export type Anomaly = {
  title: string;
  subtitle: string;
};

const leaveTypeAliases: Record<string, string> = {
  "Leave Request": "Annual Leave",
  "Sick Leave": "Sick Submission",
  Permission: "Half Day Leave",
  "Remote Work": "On Duty Request"
};

const specialLeaveTypes = {
  onDuty: new Set(["On Duty Request", "Remote Work"]),
  sick: new Set(["Sick Submission", "Sick Leave"]),
  halfDay: new Set(["Half Day Leave", "Permission"])
} as const;

export function normalizeLeaveType(type: string) {
  return leaveTypeAliases[type] ?? type;
}

export function toLeaveTypeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "leave-type";
}

export function getLeaveAllocationAvailable(allocation: LeaveBalanceAllocation) {
  return Number((allocation.days + allocation.carryOver).toFixed(1));
}

export function findLeaveAllocation(
  balances: LeaveBalance | null | undefined,
  type: string
) {
  const normalizedType = normalizeLeaveType(type);
  const typeCode = toLeaveTypeCode(normalizedType);
  return (balances?.allocations ?? []).find((allocation) => {
    const allocationCode = toLeaveTypeCode(allocation.code || allocation.label);
    const allocationLabelCode = toLeaveTypeCode(allocation.label);
    return allocationCode === typeCode || allocationLabelCode === typeCode;
  }) ?? null;
}

export function isOnDutyLeaveType(type: string) {
  return specialLeaveTypes.onDuty.has(type);
}

export function isSickLeaveType(type: string) {
  return specialLeaveTypes.sick.has(type);
}

export function isHalfDayLeaveType(type: string) {
  return specialLeaveTypes.halfDay.has(type);
}

export function isStandardLeaveRequestType(type: string) {
  return !isOnDutyLeaveType(type) && !isSickLeaveType(type) && !isHalfDayLeaveType(type);
}

export async function withApiSession(init: RequestInit = {}): Promise<RequestInit> {
  const nextInit: RequestInit = {
    ...init,
    credentials: init.credentials ?? "include"
  };

  if (typeof window !== "undefined") {
    return nextInit;
  }

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const signedSession = cookieStore.get(authCookieName)?.value;
    if (!signedSession) {
      return nextInit;
    }

    const headers = new Headers(nextInit.headers ?? {});
    if (!headers.has("X-Session-Token")) {
      headers.set("X-Session-Token", signedSession);
    }
    if (!headers.has("Cookie")) {
      headers.set("Cookie", `${authCookieName}=${signedSession}`);
    }

    nextInit.headers = headers;
  } catch {
    return nextInit;
  }

  return nextInit;
}

async function fetchWithFallback(pathname: string, init: RequestInit) {
  const requestInit = await withApiSession(init);
  const apiBase = getApiBase();
  try {
    return await fetch(`${apiBase}${pathname}`, requestInit);
  } catch (error) {
    if (!shouldTryLocalApiFallback(apiBase)) {
      throw error;
    }
    return fetch(`${getLocalApiFallbackBase()}${pathname}`, requestInit);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T> | null = null;
  let rawPayload: unknown = null;
  try {
    rawPayload = await response.json();
    payload = rawPayload as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const messageFromApi =
      (rawPayload && typeof rawPayload === "object" && rawPayload !== null && "message" in rawPayload
        ? String((rawPayload as { message?: unknown }).message ?? "")
        : "") ||
      (payload && typeof payload.error === "string" && payload.error.trim().length > 0 ? payload.error : "");
    throw new Error(messageFromApi || `API request failed with status ${response.status}`);
  }

  if (!payload) {
    throw new Error("API returned an unexpected empty response.");
  }
  return payload.data;
}

async function apiFetch<T>(pathname: string): Promise<T> {
  const response = await fetchWithFallback(pathname, { cache: "no-store", credentials: "include" });
  return parseResponse<T>(response);
}

function toQueryString(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) {
    return "";
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function apiPostJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetchWithFallback(pathname, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function apiPatchJson<T>(pathname: string, body: unknown): Promise<T> {
  const response = await fetchWithFallback(pathname, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function apiDelete<T>(pathname: string): Promise<T> {
  const response = await fetchWithFallback(pathname, { method: "DELETE", credentials: "include" });
  return parseResponse<T>(response);
}

async function apiPostForm<T>(pathname: string, body: FormData): Promise<T> {
  const response = await fetchWithFallback(pathname, { method: "POST", body, credentials: "include" });
  return parseResponse<T>(response);
}

export async function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/api/dashboard/summary");
}

export async function getAuditLogsPage(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  eventKey?: string;
  actorUserId?: string;
  actorRole?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
}) {
  return apiFetch<PaginatedList<AuditLogRecord>>(`/api/ops/audit-logs${toQueryString(query)}`);
}

export async function getEmployees() {
  return apiFetch<EmployeeRecord[]>("/api/employees");
}

export async function getEmployeesPage(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  department?: string;
  role?: EmployeeRecord["role"];
  status?: EmployeeRecord["status"];
}) {
  return apiFetch<PaginatedList<EmployeeRecord>>(`/api/employees${toQueryString(query)}`);
}

export async function createEmployee(payload: {
  nik: string;
  name: string;
  email: string;
  birthPlace: string;
  birthDate: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  marriageDate?: string | null;
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
  workLocation: string;
  workType: "onsite" | "hybrid" | "remote";
  managerName: string;
  employmentType: "permanent" | "contract" | "intern";
  contractStatus: "permanent" | "contract" | "intern";
  contractStart: string;
  contractEnd?: string | null;
  baseSalary: number;
  allowance: number;
  positionSalaryId?: string | null;
  financialComponentIds: string[];
  taxProfileId?: string | null;
  taxProfile: string;
  bankName: string;
  bankAccountMasked: string;
  appLoginEnabled?: boolean;
  loginUsername?: string | null;
  loginPassword?: string | null;
}) {
  return apiPostJson<EmployeeRecord>("/api/employees", payload);
}

export async function updateEmployee(id: string, payload: Partial<Omit<EmployeeRecord, "id" | "employeeNumber">>) {
  return apiPatchJson<EmployeeRecord>(`/api/employees/${id}`, payload);
}

export async function deleteEmployee(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/employees/${id}`);
}

export async function getEmployeeDocuments(employeeId: string) {
  return apiFetch<EmployeeDocumentRecord[]>(`/api/employees/${employeeId}/documents`);
}

export async function uploadEmployeeDocument(payload: {
  employeeId: string;
  type: EmployeeDocumentType;
  title: string;
  notes?: string;
  file: File;
}) {
  const formData = new FormData();
  formData.set("type", payload.type);
  formData.set("title", payload.title);
  formData.set("notes", payload.notes ?? "");
  formData.set("file", payload.file);
  return apiPostForm<EmployeeDocumentRecord>(`/api/employees/${payload.employeeId}/documents`, formData);
}

export async function deleteEmployeeDocument(employeeId: string, documentId: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/employees/${employeeId}/documents/${documentId}`);
}

export async function getCompensationProfiles() {
  return apiFetch<CompensationProfileRecord[]>("/api/compensation-profiles");
}

export async function getDepartments() {
  return apiFetch<DepartmentRecord[]>("/api/departments");
}

export async function createDepartment(payload: { name: string; active: boolean }) {
  return apiPostJson<DepartmentRecord>("/api/departments", payload);
}

export async function updateDepartment(id: string, payload: Partial<{ name: string; active: boolean }>) {
  return apiPatchJson<DepartmentRecord>(`/api/departments/${id}`, payload);
}

export async function deleteDepartment(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/departments/${id}`);
}

export async function createCompensationProfile(payload: Omit<CompensationProfileRecord, "id">) {
  return apiPostJson<CompensationProfileRecord>("/api/compensation-profiles", payload);
}

export async function updateCompensationProfile(id: string, payload: Partial<Omit<CompensationProfileRecord, "id">>) {
  return apiPatchJson<CompensationProfileRecord>(`/api/compensation-profiles/${id}`, payload);
}

export async function deleteCompensationProfile(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/compensation-profiles/${id}`);
}

export async function getTaxProfiles() {
  return apiFetch<TaxProfileRecord[]>("/api/tax-profiles");
}

export async function createTaxProfile(payload: Omit<TaxProfileRecord, "id">) {
  return apiPostJson<TaxProfileRecord>("/api/tax-profiles", payload);
}

export async function updateTaxProfile(id: string, payload: Partial<Omit<TaxProfileRecord, "id">>) {
  return apiPatchJson<TaxProfileRecord>(`/api/tax-profiles/${id}`, payload);
}

export async function deleteTaxProfile(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/tax-profiles/${id}`);
}

export async function getPayrollComponents() {
  return apiFetch<PayrollComponentRecord[]>("/api/payroll/components");
}

export async function createPayrollComponent(payload: {
  code: string;
  name: string;
  type: PayrollComponentType;
  calculationType: PayrollCalculationType;
  amount: number;
  percentage?: number | null;
  taxable: boolean;
  active: boolean;
  appliesToAll: boolean;
  employeeIds?: string[];
  description: string;
}) {
  return apiPostJson<PayrollComponentRecord>("/api/payroll/components", payload);
}

export async function updatePayrollComponent(id: string, payload: Partial<Omit<PayrollComponentRecord, "id">>) {
  return apiPatchJson<PayrollComponentRecord>(`/api/payroll/components/${id}`, payload);
}

export async function deletePayrollComponent(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/payroll/components/${id}`);
}

export async function getAttendanceHistory() {
  return apiFetch<AttendanceRecord[]>("/api/attendance/history");
}

export async function getAttendanceHistoryPage(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  userId?: string;
  department?: string;
  status?: AttendanceRecord["status"];
}) {
  return apiFetch<PaginatedList<AttendanceRecord>>(`/api/attendance/history${toQueryString(query)}`);
}

export async function getAttendanceToday() {
  return apiFetch<AttendanceRecord[]>("/api/attendance/today");
}

export async function getAttendanceOverview() {
  return apiFetch<AttendanceOverview>("/api/attendance/overview");
}


export async function getAttendanceOvertime() {
  return apiFetch<OvertimeRecord[]>("/api/attendance/overtime");
}

export async function createOvertimeRequest(payload: {
  userId: string;
  employeeName: string;
  department: string;
  date: string;
  minutes: number;
  reason: string;
}) {
  return apiPostJson<OvertimeRecord>("/api/attendance/overtime", payload);
}

export async function createCheckIn(payload: {
  userId: string;
  employeeName: string;
  department: string;
  location: string;
  latitude: number;
  longitude: number;
  photo?: File | null;
}) {
  const formData = new FormData();
  formData.set("userId", payload.userId);
  formData.set("employeeName", payload.employeeName);
  formData.set("department", payload.department);
  formData.set("location", payload.location);
  formData.set("latitude", String(payload.latitude));
  formData.set("longitude", String(payload.longitude));
  if (payload.photo) {
    formData.set("photo", payload.photo);
  }
  return apiPostForm<AttendanceRecord>("/api/attendance/check-in", formData);
}

export async function createCheckOut(payload: { attendanceId: string; checkOut?: string }) {
  return apiPostJson<AttendanceRecord>("/api/attendance/check-out", payload);
}

export async function getLeaveHistory() {
  return apiFetch<LeaveRecord[]>("/api/leave/history");
}

export async function createLeaveRequest(payload: {
  userId: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  supportingDocument?: File | null;
}) {
  const formData = new FormData();
  formData.set("userId", payload.userId);
  formData.set("employeeName", payload.employeeName);
  formData.set("type", payload.type);
  formData.set("startDate", payload.startDate);
  formData.set("endDate", payload.endDate);
  formData.set("reason", payload.reason);
  if (payload.supportingDocument) {
    formData.set("supportingDocument", payload.supportingDocument);
  }
  return apiPostForm<LeaveRecord>("/api/leave/request", formData);
}

export async function approveLeaveRequest(payload: {
  leaveId: string;
  status: "approved" | "rejected";
  actor: string;
}) {
  return apiPostJson<LeaveRecord>("/api/leave/approve", payload);
}

export async function getReimbursementClaimTypes() {
  return apiFetch<ReimbursementClaimTypeRecord[]>("/api/reimbursement/claims");
}

export async function createReimbursementClaimType(payload: Omit<ReimbursementClaimTypeRecord, "id" | "createdAt" | "updatedAt">) {
  return apiPostJson<ReimbursementClaimTypeRecord>("/api/reimbursement/claims", payload);
}

export async function updateReimbursementClaimType(id: string, payload: Partial<Omit<ReimbursementClaimTypeRecord, "id" | "createdAt" | "updatedAt">>) {
  return apiPatchJson<ReimbursementClaimTypeRecord>(`/api/reimbursement/claims/${id}`, payload);
}

export async function deleteReimbursementClaimType(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/api/reimbursement/claims/${id}`);
}

export async function getReimbursementRequests() {
  return apiFetch<ReimbursementRequestRecord[]>("/api/reimbursement/requests");
}

export async function getReimbursementRequestsPage(query: {
  page?: number;
  pageSize?: number;
  search?: string;
  userId?: string;
  department?: string;
  status?: ReimbursementStatus;
}) {
  return apiFetch<PaginatedList<ReimbursementRequestRecord>>(`/api/reimbursement/requests${toQueryString(query)}`);
}

export async function createReimbursementRequest(payload: {
  userId: string;
  employeeName: string;
  department: string;
  designation: string;
  claimTypeId: string;
  currency: string;
  amount: number;
  receiptDate: string;
  remarks?: string;
  submit: boolean;
  receipt?: File | null;
}) {
  const formData = new FormData();
  formData.set("userId", payload.userId);
  formData.set("employeeName", payload.employeeName);
  formData.set("department", payload.department);
  formData.set("designation", payload.designation);
  formData.set("claimTypeId", payload.claimTypeId);
  formData.set("currency", payload.currency);
  formData.set("amount", String(payload.amount));
  formData.set("receiptDate", payload.receiptDate);
  formData.set("remarks", payload.remarks ?? "");
  formData.set("submit", String(payload.submit));
  if (payload.receipt) {
    formData.set("receipt", payload.receipt);
  }
  return apiPostForm<ReimbursementRequestRecord>("/api/reimbursement/requests", formData);
}

export async function updateReimbursementRequest(payload: {
  reimbursementId: string;
  claimTypeId?: string;
  currency?: string;
  amount?: number;
  receiptDate?: string;
  remarks?: string;
  submit?: boolean;
  receipt?: File | null;
}) {
  const formData = new FormData();
  if (payload.claimTypeId !== undefined) {
    formData.set("claimTypeId", payload.claimTypeId);
  }
  if (payload.currency !== undefined) {
    formData.set("currency", payload.currency);
  }
  if (payload.amount !== undefined) {
    formData.set("amount", String(payload.amount));
  }
  if (payload.receiptDate !== undefined) {
    formData.set("receiptDate", payload.receiptDate);
  }
  if (payload.remarks !== undefined) {
    formData.set("remarks", payload.remarks);
  }
  if (payload.submit !== undefined) {
    formData.set("submit", String(payload.submit));
  }
  if (payload.receipt) {
    formData.set("receipt", payload.receipt);
  }
  const response = await fetchWithFallback(`/api/reimbursement/requests/${payload.reimbursementId}`, {
    method: "PATCH",
    body: formData,
    credentials: "include"
  });
  return parseResponse<ReimbursementRequestRecord>(response);
}

export async function managerApproveReimbursement(payload: {
  reimbursementId: string;
  status: "approved" | "rejected";
  actor: string;
}) {
  return apiPostJson<ReimbursementRequestRecord>("/api/reimbursement/requests/manager-approve", payload);
}

export async function hrProcessReimbursement(payload: {
  reimbursementId: string;
  status: "approved" | "rejected" | "processed";
  actor: string;
}) {
  return apiPostJson<ReimbursementRequestRecord>("/api/reimbursement/requests/hr-process", payload);
}


export async function approveOvertimeRequest(payload: {
  overtimeId: string;
  status: "approved" | "rejected" | "paid";
  actor: string;
}) {
  return apiPostJson<OvertimeRecord>("/api/attendance/overtime/approve", payload);
}
export function deriveAttendanceSeries(logs: AttendanceRecord[]): AttendanceSeriesItem[] {
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const seeded = weekdays.map((label) => ({ label, present: 0, absent: 0 }));

  for (const log of logs) {
    const date = new Date(log.timestamp);
    const day = (date.getUTCDay() + 6) % 7;
    if (log.status === "absent") {
      seeded[day].absent += 1;
    } else {
      seeded[day].present += 1;
    }
  }

  return seeded.map((item, index) => ({
    ...item,
    present: item.present || 3 + index,
    absent: item.absent || (index % 3 === 0 ? 1 : 0)
  }));
}

export function deriveActivityStream(logs: AttendanceRecord[]): ActivityItem[] {
  return logs.slice(0, 4).map((log) => ({
    id: log.id,
    name: log.employeeName,
    time: log.checkIn,
    detail: `${labelForStatus(log.status)} | ${log.department}`,
    status: log.status === "late" ? "alert" : "live"
  }));
}

export function derivePerformers(logs: AttendanceRecord[]): Performer[] {
  const scores = new Map<string, { role: string; score: number; count: number }>();

  for (const log of logs) {
    const existing = scores.get(log.employeeName) ?? { role: log.department, score: 0, count: 0 };
    existing.count += 1;
    existing.score += log.status === "on-time" ? 100 : log.status === "late" ? 78 : 70;
    scores.set(log.employeeName, existing);
  }

  return [...scores.entries()]
    .map(([name, value]) => ({
      name,
      role: value.role,
      score: `${Math.round(value.score / value.count)}%`
    }))
    .sort((a, b) => Number.parseInt(b.score, 10) - Number.parseInt(a.score, 10))
    .slice(0, 3);
}

export function deriveDepartmentHealth(logs: AttendanceRecord[]): DepartmentHealth[] {
  const bucket = new Map<string, { present: number; total: number }>();

  for (const log of logs) {
    const item = bucket.get(log.department) ?? { present: 0, total: 0 };
    item.total += 1;
    if (log.status !== "absent") {
      item.present += 1;
    }
    bucket.set(log.department, item);
  }

  return [...bucket.entries()].map(([name, value]) => {
    const score = Math.round((value.present / value.total) * 100);
    return { name, value: score, tone: score < 80 ? "danger" : "primary" };
  });
}

export function deriveAnomalies(logs: AttendanceRecord[], leaves: LeaveRecord[]): Anomaly[] {
  const late = logs.filter((log) => log.status === "late").length;
  const earlyLeave = logs.filter((log) => log.status === "early-leave").length;
  const pendingLeave = leaves.filter((leave) => leave.status !== "approved").length;

  return [
    { title: late > 0 ? "Late Arrival Spike" : "Stable Arrival Pattern", subtitle: `${late} late check-ins flagged this cycle` },
    { title: earlyLeave > 0 ? "Early Leave Pattern" : "Attendance Completion Healthy", subtitle: `${earlyLeave} early leave records detected` },
    { title: pendingLeave > 0 ? "Pending Leave Queue" : "Leave Queue Clear", subtitle: `${pendingLeave} requests still need approval` }
  ];
}

export function labelForStatus(status: AttendanceRecord["status"]) {
  switch (status) {
    case "on-time":
      return "Checked in on time";
    case "late":
      return "Late check-in";
    case "absent":
      return "Absent";
    case "early-leave":
      return "Early leave";
    default:
      return status;
  }
}

export function formatLeaveStatus(status: LeaveRecord["status"]) {
  switch (status) {
    case "awaiting-hr":
      return "Awaiting HR";
    case "pending-manager":
      return "Pending Manager";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatLeaveType(type: LeaveType) {
  return normalizeLeaveType(type);
}

export function formatOvertimeStatus(status: OvertimeRecord["status"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "paid":
      return "Paid Out";
    case "pending":
      return "Pending Manager";
    case "rejected":
      return "Rejected";
    default:
      return status;
  }
}

export function formatReimbursementStatus(status: ReimbursementStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending-manager":
      return "Pending Manager";
    case "awaiting-hr":
      return "Awaiting HR";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "processed":
      return "Processed";
    default:
      return status;
  }
}

export function formatReimbursementCategory(category: ReimbursementCategory) {
  switch (category) {
    case "medical":
      return "Medical";
    case "glasses":
      return "Glasses";
    case "maternity":
      return "Maternity";
    case "transport":
      return "Transport";
    case "communication":
      return "Communication";
    case "wellness":
      return "Wellness";
    case "other":
    default:
      return "Other";
  }
}

export function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}







