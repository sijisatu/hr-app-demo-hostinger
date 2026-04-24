import { AppShell } from "@/components/layout/app-shell";
import { ReimbursementWorkspace } from "@/components/reimbursement/reimbursement-workspace";
import { requireSession } from "@/lib/auth";
import { getEmployees, getReimbursementClaimTypes, getReimbursementRequests } from "@/lib/api";

export default async function ReimbursementPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const shouldLoadEmployees = session.role === "hr" || session.role === "admin";
  const [employeesResult, claimTypesResult, requestsResult] = await Promise.allSettled([
    shouldLoadEmployees ? getEmployees() : Promise.resolve([]),
    getReimbursementClaimTypes(),
    getReimbursementRequests()
  ]);
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : [];
  const claimTypes = claimTypesResult.status === "fulfilled" ? claimTypesResult.value : [];
  const requests = requestsResult.status === "fulfilled" ? requestsResult.value : [];
  const dataUnavailable =
    employeesResult.status === "rejected" ||
    claimTypesResult.status === "rejected" ||
    requestsResult.status === "rejected";

  return (
    <AppShell title="Reimbursement">
      {dataUnavailable ? (
        <div className="page-card mb-6 border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
          Some reimbursement data is temporarily unavailable. The page is still loaded with the latest safe data.
        </div>
      ) : null}
      <ReimbursementWorkspace
        role={session.role}
        userId={session.id}
        initialEmployees={employees}
        initialClaimTypes={claimTypes}
        initialRequests={requests}
      />
    </AppShell>
  );
}
