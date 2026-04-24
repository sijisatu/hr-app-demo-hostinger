import { notFound } from "next/navigation";
import { EmployeeManagementWorkspace } from "@/components/employees/employee-management-workspace";
import { getCompensationProfiles, getDepartments, getEmployees } from "@/lib/api";

const allowedTabs = new Set(["personal", "education", "job", "experience", "financial", "documents"]);
type CaptureTab = "personal" | "education" | "job" | "experience" | "financial" | "documents";

export default async function HelpCenterEmployeeCapturePage({
  params
}: {
  params: Promise<{ tab: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { tab } = await params;

  if (!allowedTabs.has(tab)) {
    notFound();
  }

  const [employeesResult, profilesResult, departmentsResult] = await Promise.allSettled([
    getEmployees(),
    getCompensationProfiles(),
    getDepartments()
  ]);

  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : [];
  const profiles = profilesResult.status === "fulfilled" ? profilesResult.value : [];
  const departments = departmentsResult.status === "fulfilled" ? departmentsResult.value : [];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7f9fc_100%)] p-6">
      <EmployeeManagementWorkspace
        initialEmployees={employees}
        initialCompensationProfiles={profiles}
        initialDepartments={departments}
        initialMode="create"
        initialTab={tab as CaptureTab}
        documentationMode
      />
    </div>
  );
}
