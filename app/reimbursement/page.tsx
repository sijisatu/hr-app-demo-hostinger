import { AppShell } from "@/components/layout/app-shell";
import { ReimbursementWorkspace } from "@/components/reimbursement/reimbursement-workspace";
import { requireSession } from "@/lib/auth";
import { getEmployeesPage, getReimbursementClaimTypes, getReimbursementRequestsPage } from "@/lib/api";

const REIMBURSEMENT_PAGE_LIMIT = 200;

export default async function ReimbursementPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const shouldLoadEmployees = session.role === "hr" || session.role === "admin" || session.role === "manager";
  const [employeesResult, claimTypesResult, requestsResult] = await Promise.allSettled([
    shouldLoadEmployees ? getEmployeesPage({ page: 1, pageSize: REIMBURSEMENT_PAGE_LIMIT }) : Promise.resolve(null),
    getReimbursementClaimTypes(),
    getReimbursementRequestsPage(
      session.role === "employee"
        ? { userId: session.id, page: 1, pageSize: REIMBURSEMENT_PAGE_LIMIT }
        : { page: 1, pageSize: REIMBURSEMENT_PAGE_LIMIT }
    )
  ]);
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value?.items ?? [] : [];
  const claimTypes = claimTypesResult.status === "fulfilled" ? claimTypesResult.value : [];
  const requests = requestsResult.status === "fulfilled" ? requestsResult.value.items : [];
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
