import { Download } from "lucide-react";
import { EmployeeAttendanceHub } from "@/components/attendance/employee-attendance-hub";
import { AppShell } from "@/components/layout/app-shell";
import { AttendanceTable } from "@/components/tables/attendance-table";
import { requireSession } from "@/lib/auth";
import {
  formatOvertimeStatus,
  getAttendanceHistory,
  getAttendanceOverview,
  getAttendanceOvertime
} from "@/lib/api";

const overtimeTone = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
  paid: "neutral"
} as const;

export default async function AttendancePage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);

  if (session.role === "employee" || session.role === "manager" || session.role === "hr") {
    return (
      <AppShell title="Employee Attendance">
        <EmployeeAttendanceHub showAttendanceReport={session.role === "hr"} />
      </AppShell>
    );
  }

  const [logsResult, overviewResult, overtimeResult] = await Promise.allSettled([
    getAttendanceHistory(),
    getAttendanceOverview(),
    getAttendanceOvertime()
  ]);
  const logs = logsResult.status === "fulfilled" ? logsResult.value : [];
  const overview = overviewResult.status === "fulfilled"
    ? overviewResult.value
    : { checkedInToday: 0, openCheckIns: 0, gpsValidated: 0, selfieCaptured: 0, overtimeHours: 0 };
  const overtime = overtimeResult.status === "fulfilled" ? overtimeResult.value : [];
  const dataUnavailable =
    logsResult.status === "rejected" ||
    overviewResult.status === "rejected" ||
    overtimeResult.status === "rejected";

  const punctuality = logs.length === 0 ? 0 : (logs.filter((item) => item.status === "on-time").length / logs.length) * 100;

  return (
    <AppShell
      title="Employee Attendance"
      actions={(
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button">
            <Download className="h-4 w-4" />
            Export PDF
          </button>
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
            Some attendance data is temporarily unavailable. The page is still loaded with the latest safe data.
          </div>
        ) : null}
        <AttendanceTable logs={logs} punctuality={punctuality} overview={overview} />

        <section className="page-card p-6">
          <div className="mb-5">
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Overtime Queue</p>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">Supervisor review and payout visibility.</p>
          </div>

          <div className="space-y-4">
            {overtime.map((item) => (
              <div key={item.id} className="panel-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                    <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.department}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${overtimeTone[item.status] === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : overtimeTone[item.status] === 'warning' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : overtimeTone[item.status] === 'danger' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[#eef2f7] text-[var(--text-muted)]'}`}>{formatOvertimeStatus(item.status)}</span>
                </div>
                <div className="mt-4 grid gap-3 text-[13px] text-[var(--text-muted)] sm:grid-cols-2">
                  <div><p className="font-medium text-[var(--text)]">Date</p><p className="mt-1">{item.date}</p></div>
                  <div><p className="font-medium text-[var(--text)]">Duration</p><p className="mt-1">{item.minutes} minutes</p></div>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-[var(--text-muted)]">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
