import { AppShell } from "@/components/layout/app-shell";
import { EmployeeProfileWorkspace } from "@/components/profile/employee-profile-workspace";
import { requireSession } from "@/lib/auth";
import { getEmployee, getLeaveHistoryPage } from "@/lib/api";

export default async function ProfilePage() {
  const session = await requireSession(["manager", "employee"]);
  const [employeeResult, leaveHistoryResult] = await Promise.allSettled([
    getEmployee(session.id),
    getLeaveHistoryPage({ userId: session.id, status: "approved", page: 1, pageSize: 120 })
  ]);
  const employee = employeeResult.status === "fulfilled" ? employeeResult.value : null;
  const leaveHistory = leaveHistoryResult.status === "fulfilled" ? leaveHistoryResult.value.items : [];
  const dataUnavailable = employeeResult.status === "rejected" || leaveHistoryResult.status === "rejected";
  const sickLeaveUsed = leaveHistory.filter((item) => item.userId === session.id && item.status === "approved" && (item.type === "Sick Submission" || item.type === "Sick Leave")).length;

  if (!employee) {
    return (
      <AppShell title="Profile">
        <div className="space-y-4">
          {dataUnavailable ? (
            <div className="page-card border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
              Some profile data is temporarily unavailable right now.
            </div>
          ) : null}
          <div className="page-card p-6 text-[14px] text-[var(--text-muted)]">Employee information is not available for this account.</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile">
      {dataUnavailable ? (
        <div className="page-card mb-6 border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
          Some profile data is temporarily unavailable. The page is still loaded with the latest safe data.
        </div>
      ) : null}
      <EmployeeProfileWorkspace employee={employee} sickLeaveUsed={sickLeaveUsed} />
    </AppShell>
  );
}
