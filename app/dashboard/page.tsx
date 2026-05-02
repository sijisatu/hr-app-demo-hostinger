import { AttendanceQuickAction } from "@/components/layout/attendance-quick-action";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AttendanceChart } from "@/components/dashboard/attendance-chart";
import { ActivityPanel } from "@/components/dashboard/activity-panel";
import { IntegrityCard } from "@/components/dashboard/integrity-card";
import { EmployeeDashboardOverview } from "@/components/dashboard/employee-dashboard-overview";
import { HrDashboardInsights } from "@/components/dashboard/hr-dashboard-insights";
import { HrWorkforcePanels } from "@/components/dashboard/hr-workforce-panels";
import { requireSession } from "@/lib/auth";
import {
  deriveActivityStream,
  deriveAttendanceSeries,
  getAttendanceHistoryPage,
  getDashboardSummary,
  getEmployeesPage,
  getLeaveHistoryPage
} from "@/lib/api";

export default async function DashboardPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const isEmployeeView = session.role === "employee" || session.role === "manager";
  const isHrView = session.role === "hr";
  const [summaryResult, attendanceResult, leaveResult, employeesResult] = await Promise.allSettled([
    isEmployeeView ? Promise.resolve(null) : getDashboardSummary(),
    getAttendanceHistoryPage(isEmployeeView ? { userId: session.id, page: 1, pageSize: 120 } : { page: 1, pageSize: 250 }),
    getLeaveHistoryPage(isEmployeeView ? { userId: session.id, page: 1, pageSize: 120 } : { page: 1, pageSize: 250 }),
    isHrView ? getEmployeesPage({ page: 1, pageSize: 250 }) : Promise.resolve(null)
  ]);
  const summary = summaryResult.status === "fulfilled" ? summaryResult.value : null;
  const attendanceLogs = attendanceResult.status === "fulfilled" ? attendanceResult.value.items : [];
  const leaveRequests = leaveResult.status === "fulfilled" ? leaveResult.value.items : [];
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value?.items ?? [] : [];
  const dataUnavailable = [summaryResult, attendanceResult, leaveResult, employeesResult].some((result) => result.status === "rejected");
  const scopedLogs = attendanceLogs;
  const scopedLeaves = leaveRequests;

  const metrics = isEmployeeView
    ? [
        { label: "My Records", value: scopedLogs.length.toLocaleString("en-US"), note: `${scopedLeaves.length} leave requests`, tone: "neutral" },
        { label: "On-Time", value: scopedLogs.filter((item) => item.status === "on-time").length.toLocaleString("en-US"), note: "Personal attendance", tone: "success" },
        { label: "Late", value: scopedLogs.filter((item) => item.status === "late").length.toLocaleString("en-US"), note: "Needs follow-up", tone: "danger" },
        { label: "Open Sessions", value: scopedLogs.filter((item) => !item.checkOut).length.toLocaleString("en-US"), note: "Pending check-out", tone: "warning" }
      ] as const
    : [
        { label: "Employees", value: (summary?.employees ?? 0).toLocaleString("en-US"), note: "Total employees in Company", tone: "neutral" },
        { label: "On-Time", value: (summary?.onTime ?? 0).toLocaleString("en-US"), note: "Live attendance", tone: "success" },
        { label: "Late", value: (summary?.late ?? 0).toLocaleString("en-US"), note: "Review required", tone: "danger" },
        { label: "Absent", value: (summary?.absent ?? 0).toLocaleString("en-US"), note: `${summary?.leavePending ?? 0} leave pending`, tone: "warning" }
      ] as const;

  const series = deriveAttendanceSeries(scopedLogs);
  const activity = deriveActivityStream(scopedLogs);

  return (
    <AppShell
      title="Dashboard"
      actions={<AttendanceQuickAction compact />}
    >
      <div className="space-y-6">
        {dataUnavailable ? (
          <div className="page-card border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
            Some dashboard data is temporarily unavailable. The workspace is still loaded, but live API data may be delayed.
          </div>
        ) : null}

        <div className="kpi-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>

        {isEmployeeView ? (
          <EmployeeDashboardOverview logs={scopedLogs} leaves={scopedLeaves} />
        ) : isHrView ? (
          <div className="space-y-6">
            <HrWorkforcePanels employees={employees} leaves={leaveRequests} />
            <HrDashboardInsights logs={scopedLogs} totalEmployees={summary?.employees ?? 0} />
            <ActivityPanel
              entries={activity}
              title="Latest History Activity"
            />
          </div>
        ) : (
          <div className="content-grid">
            <div className="space-y-6">
              <AttendanceChart series={series} />
            </div>

            <div className="space-y-6">
              <ActivityPanel entries={activity} />
              <IntegrityCard />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
