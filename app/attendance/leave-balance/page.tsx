import { EmployeeLeaveBalanceView } from "@/components/attendance/employee-leave-balance-view";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

export default async function LeaveBalancePage() {
  await requireSession(["employee", "manager", "hr"]);

  return (
    <AppShell title="Leave Balance">
      <EmployeeLeaveBalanceView />
    </AppShell>
  );
}
