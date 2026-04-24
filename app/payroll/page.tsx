import { AppShell } from "@/components/layout/app-shell";
import { PayrollWorkspace } from "@/components/payroll/payroll-workspace";
import { requireSession } from "@/lib/auth";
import { getPayRuns, getPayrollComponents, getPayrollOverview, getPayslips } from "@/lib/payroll";

export default async function PayrollPage() {
  const session = await requireSession(["admin", "hr", "manager", "employee"]);
  const [overviewResult, componentsResult, runsResult, payslipsResult] = await Promise.allSettled([
    getPayrollOverview(),
    getPayrollComponents(),
    getPayRuns(),
    getPayslips(session.role === "admin" || session.role === "hr" ? undefined : session.id)
  ]);
  const overview = overviewResult.status === "fulfilled"
    ? overviewResult.value
    : { latestRun: null, payrollComponents: 0, activeEmployees: 0, draftRuns: 0, publishedPayslips: 0 };
  const components = componentsResult.status === "fulfilled" ? componentsResult.value : [];
  const runs = runsResult.status === "fulfilled" ? runsResult.value : [];
  const payslips = payslipsResult.status === "fulfilled" ? payslipsResult.value : [];
  const dataUnavailable =
    overviewResult.status === "rejected" ||
    componentsResult.status === "rejected" ||
    runsResult.status === "rejected" ||
    payslipsResult.status === "rejected";

  return (
    <AppShell title="Payroll">
      {dataUnavailable ? (
        <div className="page-card mb-6 border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
          Some payroll data is temporarily unavailable. The page is still loaded with the latest safe data.
        </div>
      ) : null}
      <PayrollWorkspace
        role={session.role}
        userId={session.id}
        initialOverview={overview}
        initialComponents={components}
        initialRuns={runs}
        initialPayslips={payslips}
      />
    </AppShell>
  );
}
