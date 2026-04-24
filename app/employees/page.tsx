import { EmployeeManagementWorkspace } from "@/components/employees/employee-management-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { getCompensationProfiles, getDepartments, getEmployees } from "@/lib/api";

export default async function EmployeesPage() {
  await requireSession(["admin", "hr", "manager"]);
  const [employeesResult, profilesResult, departmentsResult] = await Promise.allSettled([
    getEmployees(),
    getCompensationProfiles(),
    getDepartments()
  ]);

  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : [];
  const profiles = profilesResult.status === "fulfilled" ? profilesResult.value : [];
  const departments = departmentsResult.status === "fulfilled" ? departmentsResult.value : [];
  const dataUnavailable =
    employeesResult.status === "rejected" ||
    profilesResult.status === "rejected" ||
    departmentsResult.status === "rejected";

  return (
    <AppShell title="Employee Management">
      {dataUnavailable ? (
        <div className="page-card mb-6 border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
          Some employee management data is temporarily unavailable. The page is still loaded with the latest safe data.
        </div>
      ) : null}
      <EmployeeManagementWorkspace initialEmployees={employees} initialCompensationProfiles={profiles} initialDepartments={departments} />
    </AppShell>
  );
}
