import { AppShell } from "@/components/layout/app-shell";
import { LeaveWorkflowBoard } from "@/components/leave/leave-workflow-board";
import { requireSession } from "@/lib/auth";

export default async function LeavePage() {
  await requireSession(["admin", "hr"]);

  return (
    <AppShell title="Leave System">
      <LeaveWorkflowBoard />
    </AppShell>
  );
}
