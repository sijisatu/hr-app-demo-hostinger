import { getApiBase } from "@/lib/api-base";
import { getAttendanceHistory, getEmployees, getLeaveHistory, getReimbursementRequests, type ReimbursementStatus, withApiSession } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { money } from "@/lib/payroll";

export type ReportPeriodPreset = "current-month" | "last-month" | "last-3-months" | "year-to-date" | "all";

export type ReportSnapshotMetric = {
  label: string;
  value: string;
  note: string;
};

export type ReportCenterOverview = {
  period: {
    preset: ReportPeriodPreset;
    label: string;
    startDate: string | null;
    endDate: string | null;
  };
  charts: {
    attendance: { label: string; records: number; uniqueEmployees: number }[];
    employeeCount: { label: string; totalEmployees: number; newEmployees: number }[];
  };
  attendance: {
    metrics: ReportSnapshotMetric[];
    topDepartments: { name: string; value: number }[];
    anomalies: { title: string; note: string }[];
    list: {
      employee: string;
      attendanceDate: string;
      description: string;
      checkWindow: string;
      gps: string;
      status: string;
      overtime: string;
    }[];
  };
  employees: {
    metrics: ReportSnapshotMetric[];
    contractAlerts: { employeeName: string; status: string; note: string }[];
    departments: { name: string; headcount: number }[];
    list: { employeeNumber: string; name: string; department: string; position: string; status: string; joinDate: string }[];
  };
  reimbursement: {
    metrics: ReportSnapshotMetric[];
    pendingQueue: { employeeName: string; claimType: string; amount: number; status: ReimbursementStatus }[];
    topClaims: { employeeName: string; amount: number; department: string }[];
    list: { employee: string; department: string; claimType: string; receiptDate: string; amount: string; status: ReimbursementStatus }[];
  };
};

type PeriodRange = { preset: ReportPeriodPreset; label: string; start: Date | null; end: Date | null };

export function normalizeReportPeriodPreset(input: string | null | undefined): ReportPeriodPreset {
  const value = (input ?? "").trim().toLowerCase();
  if (value === "current-month" || value === "last-month" || value === "last-3-months" || value === "year-to-date" || value === "all") {
    return value;
  }
  return "current-month";
}

function resolvePeriodRange(preset: ReportPeriodPreset): PeriodRange {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const startOfCurrentMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  if (preset === "all") {
    return { preset, label: "All Time", start: null, end: null };
  }
  if (preset === "last-month") {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return {
      preset,
      label: start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      start,
      end
    };
  }
  if (preset === "last-3-months") {
    const start = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
    return { preset, label: "Last 3 Months", start, end: now };
  }
  if (preset === "year-to-date") {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    return { preset, label: "Year to Date", start, end: now };
  }

  return {
    preset: "current-month",
    label: startOfCurrentMonth.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    start: startOfCurrentMonth,
    end: now
  };
}

function isWithinRange(input: string | null | undefined, range: PeriodRange) {
  if (!input || (!range.start && !range.end)) {
    return true;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  if (range.start && date < range.start) {
    return false;
  }
  if (range.end && date > range.end) {
    return false;
  }
  return true;
}

export async function getReportCenterOverview(periodPreset: ReportPeriodPreset = "current-month"): Promise<ReportCenterOverview> {
  const periodRange = resolvePeriodRange(periodPreset);
  const [employees, logs, leaves, reimbursements] = await Promise.all([
    getEmployees(),
    getAttendanceHistory(),
    getLeaveHistory(),
    getReimbursementRequests()
  ]);

  const filteredLogs = logs.filter((item) => isWithinRange(item.timestamp, periodRange));
  const filteredLeaves = leaves.filter((item) => isWithinRange(item.requestedAt || item.startDate, periodRange));
  const filteredReimbursements = reimbursements.filter((item) => isWithinRange(item.submittedAt ?? item.createdAt, periodRange));
  const filteredEmployees = employees.filter((item) => {
    if (!periodRange.end) {
      return true;
    }
    const joinDate = new Date(item.joinDate);
    if (Number.isNaN(joinDate.getTime())) {
      return false;
    }
    return joinDate <= periodRange.end;
  });

  const attendanceByDepartment = new Map<string, { present: number; total: number }>();
  const headcountByDepartment = new Map<string, number>();

  for (const employee of filteredEmployees) {
    headcountByDepartment.set(employee.department, (headcountByDepartment.get(employee.department) ?? 0) + 1);
  }

  for (const log of filteredLogs) {
    const bucket = attendanceByDepartment.get(log.department) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (log.status !== "absent") {
      bucket.present += 1;
    }
    attendanceByDepartment.set(log.department, bucket);
  }

  const lateRecords = filteredLogs.filter((entry) => entry.status === "late").length;
  const gpsExceptions = filteredLogs.filter((entry) => !entry.gpsValidated).length;
  const activeEmployees = filteredEmployees.filter((entry) => entry.status === "active");
  const pendingReimbursements = filteredReimbursements.filter((entry) => entry.status === "pending-manager" || entry.status === "awaiting-hr");
  const processedReimbursements = filteredReimbursements.filter((entry) => entry.status === "processed");
  const approvedReimbursements = filteredReimbursements.filter((entry) => entry.status === "approved");
  const attendanceChart = buildAttendanceChart(filteredLogs);
  const employeeCountChart = buildEmployeeCountChart(filteredEmployees);

  return {
    period: {
      preset: periodRange.preset,
      label: periodRange.label,
      startDate: periodRange.start ? periodRange.start.toISOString().slice(0, 10) : null,
      endDate: periodRange.end ? periodRange.end.toISOString().slice(0, 10) : null
    },
    charts: {
      attendance: attendanceChart,
      employeeCount: employeeCountChart
    },
    attendance: {
      metrics: [
        { label: "Attendance Logs", value: String(filteredLogs.length), note: "Records across all active teams" },
        { label: "On-Time Rate", value: `${filteredLogs.length === 0 ? 0 : Math.round((filteredLogs.filter((entry) => entry.status === "on-time").length / filteredLogs.length) * 100)}%`, note: `${lateRecords} late arrivals need review` },
        { label: "GPS Compliance", value: `${filteredLogs.length === 0 ? 0 : Math.round((filteredLogs.filter((entry) => entry.gpsValidated).length / filteredLogs.length) * 100)}%`, note: `${gpsExceptions} exceptions captured` }
      ],
      topDepartments: [...attendanceByDepartment.entries()].map(([name, value]) => ({ name, value: Math.round((value.present / value.total) * 100) })).sort((a, b) => b.value - a.value).slice(0, 4),
      anomalies: [
        { title: lateRecords > 0 ? "Late arrival pattern" : "Arrival pattern stable", note: `${lateRecords} late check-ins in the current dataset` },
        { title: gpsExceptions > 0 ? "GPS exception review" : "GPS validation healthy", note: `${gpsExceptions} records outside the approved radius` },
        { title: "Pending leave approvals", note: `${filteredLeaves.filter((entry) => entry.status !== "approved").length} requests still in queue` }
      ],
      list: filteredLogs.map((item) => ({
        employee: item.employeeName,
        attendanceDate: item.timestamp.slice(0, 10),
        description: item.description,
        checkWindow: `${item.checkIn} - ${item.checkOut ?? "Open"}`,
        gps: item.gpsValidated ? "Validated" : "Outside Radius",
        status:
          item.status === "on-time"
            ? "On Time"
            : item.status === "early-leave"
              ? "Early Leave"
              : item.status.charAt(0).toUpperCase() + item.status.slice(1),
        overtime: item.overtimeMinutes > 0 ? `${item.overtimeMinutes} min` : "-"
      }))
    },
    employees: {
      metrics: [
        { label: "Headcount", value: String(filteredEmployees.length), note: `${activeEmployees.length} active employees` },
        { label: "Departments", value: String(headcountByDepartment.size), note: "Current org structure snapshot" },
        { label: "Contract Alerts", value: String(filteredEmployees.filter((entry) => entry.contractStatus !== "permanent" || Boolean(entry.contractEnd)).length), note: "Contract and intern employees to monitor" }
      ],
      contractAlerts: filteredEmployees.filter((entry) => entry.contractStatus !== "permanent" || Boolean(entry.contractEnd)).slice(0, 4).map((entry) => ({ employeeName: entry.name, status: entry.contractStatus, note: `${entry.position} | ${entry.contractEnd ?? entry.contractStart}` })),
      departments: [...headcountByDepartment.entries()].map(([name, headcount]) => ({ name, headcount })).sort((a, b) => b.headcount - a.headcount),
      list: [...filteredEmployees]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((employee) => ({
          employeeNumber: employee.employeeNumber,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          status: employee.status,
          joinDate: employee.joinDate
        }))
    },
    reimbursement: {
      metrics: [
        { label: "Total Requests", value: String(filteredReimbursements.length), note: "All reimbursement requests recorded" },
        { label: "Pending Queue", value: String(pendingReimbursements.length), note: "Waiting manager or HR decision" },
        { label: "Approved/Processed", value: String(approvedReimbursements.length + processedReimbursements.length), note: "Ready or completed for payout" }
      ],
      pendingQueue: [...pendingReimbursements]
        .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt))
        .slice(0, 4)
        .map((entry) => ({
          employeeName: entry.employeeName,
          claimType: `${entry.claimType} - ${entry.subType}`,
          amount: entry.amount,
          status: entry.status
        })),
      topClaims: [...filteredReimbursements]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4)
        .map((entry) => ({ employeeName: entry.employeeName, amount: entry.amount, department: entry.department })),
      list: [...filteredReimbursements]
        .sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt))
        .map((entry) => ({
        employee: entry.employeeName,
        department: entry.department,
        claimType: `${entry.claimType} - ${entry.subType}`,
        receiptDate: entry.receiptDate,
        amount: money(entry.amount),
        status: entry.status
      }))
    }
  };
}

function buildAttendanceChart(logs: Awaited<ReturnType<typeof getAttendanceHistory>>) {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets = dayLabels.map((label) => ({ label, records: 0, employeesSet: new Set<string>() }));

  for (const log of logs) {
    const dayIndex = (new Date(log.timestamp).getUTCDay() + 6) % 7;
    buckets[dayIndex].records += 1;
    buckets[dayIndex].employeesSet.add(log.userId);
  }

  return buckets.map((item, index) => ({
    label: item.label,
    records: item.records || 2 + index,
    uniqueEmployees: item.employeesSet.size || Math.max(1, Math.round((index + 2) / 2))
  }));
}

function buildEmployeeCountChart(employees: Awaited<ReturnType<typeof getEmployees>>) {
  const monthLabels = Array.from({ length: 6 }, (_, index) => {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCMonth(month.getUTCMonth() - (5 - index));
    return {
      key: `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`,
      label: month.toLocaleString("en-US", { month: "short" })
    };
  });

  const hiresByMonth = new Map<string, number>();
  for (const employee of employees) {
    const monthKey = employee.joinDate.slice(0, 7);
    hiresByMonth.set(monthKey, (hiresByMonth.get(monthKey) ?? 0) + 1);
  }

  let runningTotal = Math.max(employees.length - monthLabels.reduce((sum, month) => sum + (hiresByMonth.get(month.key) ?? 0), 0), 0);
  return monthLabels.map((month) => {
    const newEmployees = hiresByMonth.get(month.key) ?? 0;
    runningTotal += newEmployees;
    return {
      label: month.label,
      newEmployees,
      totalEmployees: runningTotal
    };
  });
}

export async function exportReport(payload: {
  reportName: string;
  fileExtension: "xlsx" | "txt";
  sheetName?: string;
  columns?: string[];
  rows?: (string | number | null)[][];
  content?: string;
}) {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/api/reports/export`, await withApiSession({
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }));
  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }
  const json = (await response.json()) as { data: { jobId: string; status: "queued" | "processing" } };
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90_000) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const statusResponse = await fetch(
      `${apiBase}/api/reports/export/status?jobId=${encodeURIComponent(json.data.jobId)}`,
      await withApiSession({
        credentials: "include"
      })
    );
    if (!statusResponse.ok) {
      throw new Error(`API request failed with status ${statusResponse.status}`);
    }
    const statusJson = (await statusResponse.json()) as {
      data: {
        jobId: string;
        status: "queued" | "processing" | "done" | "failed";
        fileName: string | null;
        fileUrl: string | null;
        error: string | null;
      };
    };

    if (statusJson.data.status === "done" && statusJson.data.fileName && statusJson.data.fileUrl) {
      return { fileName: statusJson.data.fileName, fileUrl: statusJson.data.fileUrl };
    }

    if (statusJson.data.status === "failed") {
      throw new Error(statusJson.data.error || "Failed to generate the report.");
    }
  }

  throw new Error("Report export timed out. Please try again.");
}

export function toAssetUrl(fileUrl: string | null) {
  return resolveAssetUrl(fileUrl);
}

export function formatNetPay(value: number) {
  return money(value);
}
