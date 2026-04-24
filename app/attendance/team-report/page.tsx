import Link from "next/link";
import { Download, Users, UserCheck, TriangleAlert } from "lucide-react";
import { DepartmentSnapshotChart } from "@/components/attendance/department-snapshot-chart";
import { AppShell } from "@/components/layout/app-shell";
import { AttendanceTable } from "@/components/tables/attendance-table";
import { requireSession } from "@/lib/auth";
import { getAttendanceHistory, getAttendanceOverview, getAttendanceOvertime, getEmployees, getLeaveHistory } from "@/lib/api";

export default async function TeamAttendanceReportPage() {
  await requireSession(["admin", "hr"]);

  const [employeesResult, logsResult, overviewResult, overtimeResult, leaveHistoryResult] = await Promise.allSettled([
    getEmployees(),
    getAttendanceHistory(),
    getAttendanceOverview(),
    getAttendanceOvertime(),
    getLeaveHistory()
  ]);
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : [];
  const logs = logsResult.status === "fulfilled" ? logsResult.value : [];
  const overview = overviewResult.status === "fulfilled"
    ? overviewResult.value
    : { checkedInToday: 0, openCheckIns: 0, gpsValidated: 0, selfieCaptured: 0, overtimeHours: 0 };
  const overtime = overtimeResult.status === "fulfilled" ? overtimeResult.value : [];
  const leaveHistory = leaveHistoryResult.status === "fulfilled" ? leaveHistoryResult.value : [];
  const dataUnavailable =
    employeesResult.status === "rejected" ||
    logsResult.status === "rejected" ||
    overviewResult.status === "rejected" ||
    overtimeResult.status === "rejected" ||
    leaveHistoryResult.status === "rejected";

  const onDutyRequests = leaveHistory.filter((item) => item.type === "On Duty Request" || item.type === "Remote Work");
  const pendingOnDuty = onDutyRequests.filter((item) => item.status !== "approved" && item.status !== "rejected").length;

  const punctuality = logs.length === 0 ? 0 : (logs.filter((item) => item.status === "on-time").length / logs.length) * 100;
  const activeEmployees = employees.filter((item) => item.status === "active");
  const checkedInIds = new Set(logs.map((item) => item.userId));
  const lateCount = logs.filter((item) => item.status === "late").length;
  const pendingOvertime = overtime.filter((item) => item.status === "pending").length;
  const departmentCoverage = new Set(logs.map((item) => item.department)).size;

  const reportCards = [
    {
      label: "Active Employees",
      value: String(activeEmployees.length),
      note: `${checkedInIds.size} employees have attendance records`
    },
    {
      label: "Departments Covered",
      value: String(departmentCoverage),
      note: "Departments represented in attendance activity"
    },
    {
      label: "Late Records",
      value: String(lateCount),
      note: "Requires follow-up from HR or team leads"
    },
    {
      label: "Pending Overtime",
      value: String(pendingOvertime),
      note: "Requests still waiting for a decision"
    },
    {
      label: "On Duty Requests",
      value: String(onDutyRequests.length),
      note: `${pendingOnDuty} still waiting for approval`
    }
  ];

  const topDepartments = [...new Set(logs.map((item) => item.department))]
    .map((department) => {
      const departmentLogs = logs.filter((item) => item.department === department);
      const onTime = departmentLogs.filter((item) => item.status === "on-time").length;
      const checkedInEmployees = new Set(departmentLogs.map((item) => item.userId)).size;

      return {
        department,
        records: departmentLogs.length,
        onTimeRate: departmentLogs.length === 0 ? 0 : Math.round((onTime / departmentLogs.length) * 100),
        checkedInEmployees
      };
    })
    .sort((a, b) => b.records - a.records)
    .slice(0, 4);

  return (
    <AppShell
      title="Attendance Report"
      actions={(
        <div className="flex flex-wrap gap-2">
          <Link href="/attendance" className="secondary-button">
            Back to Attendance
          </Link>
          <button className="secondary-button">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      )}
    >
      <div className="space-y-6">
        {dataUnavailable ? (
          <div className="page-card border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
            Some attendance report data is temporarily unavailable. The page is still loaded with the latest safe data.
          </div>
        ) : null}
        <section className="rounded-[20px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">HR Attendance Report</p>
          <h2 className="mt-4 text-[28px] font-semibold leading-tight">A clear view of attendance across the entire organization.</h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
            Use this report to review attendance performance, coverage, and pending overtime in one place.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {reportCards.map((item, index) => (
            <div key={item.label} className={index >= 3 ? "page-card bg-[var(--primary)] p-5 text-white" : "page-card p-5"}>
              <p className={index >= 3 ? "text-[12px] font-medium uppercase tracking-[0.08em] text-white/72" : "text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"}>{item.label}</p>
              <p className={index >= 3 ? "mt-3 text-[30px] font-semibold leading-none" : "mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]"}>{item.value}</p>
              <p className={index >= 3 ? "mt-3 text-[14px] text-white/74" : "mt-3 text-[14px] text-[var(--text-muted)]"}>{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <DepartmentSnapshotChart items={topDepartments} />

          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Monitoring Notes</p>
                <p className="mt-2 text-[14px] text-[var(--text-muted)]">Quick highlights for daily attendance review.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="panel-muted flex gap-3 p-4 text-[14px] text-[var(--text-muted)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
                <span>{lateCount} late attendance records need follow-up.</span>
              </div>
              <div className="panel-muted flex gap-3 p-4 text-[14px] text-[var(--text-muted)]">
                <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <span>{checkedInIds.size} employees have checked in out of {activeEmployees.length} active employees.</span>
              </div>
              <div className="panel-muted flex gap-3 p-4 text-[14px] text-[var(--text-muted)]">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <span>Punctuality is currently {punctuality.toFixed(1)}% with {overview.openCheckIns} open check-in sessions.</span>
              </div>
            </div>
          </div>
        </section>

        <AttendanceTable logs={logs} employees={employees} onDutyRequests={onDutyRequests} punctuality={punctuality} overview={overview} />
      </div>
    </AppShell>
  );
}
