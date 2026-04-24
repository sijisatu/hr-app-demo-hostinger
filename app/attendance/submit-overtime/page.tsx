import { EmployeeAttendanceWorkspace } from "@/components/attendance/employee-attendance-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function SubmitOvertimePage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell title="Submit Overtime">
      <EmployeeAttendanceWorkspace fixedAction="overtime" />
    </AppShell>
  );
}
