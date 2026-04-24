import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function SickSubmissionPage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell title="Sick Submission">
      <EmployeeAttendanceWorkspace fixedAction="sick" />
    </AppShell>
  );
}
