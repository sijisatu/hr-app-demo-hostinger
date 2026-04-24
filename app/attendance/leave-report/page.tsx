import Link from "next/link";
import { FileText, Stethoscope, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LeaveReportTable } from "@/components/tables/leave-report-table";
import { requireSession } from "@/lib/auth";
import { getEmployees, getLeaveHistory, isOnDutyLeaveType, isSickLeaveType } from "@/lib/api";

export default async function LeaveReportPage() {
  await requireSession(["admin", "hr"]);

  const [employeesResult, leaveRequestsResult] = await Promise.allSettled([
    getEmployees(),
    getLeaveHistory()
  ]);
  const employees = employeesResult.status === "fulfilled" ? employeesResult.value : [];
  const leaveRequests = leaveRequestsResult.status === "fulfilled" ? leaveRequestsResult.value : [];
  const dataUnavailable = employeesResult.status === "rejected" || leaveRequestsResult.status === "rejected";

  const leaveReportRecords = leaveRequests.filter((item) => !isOnDutyLeaveType(item.type));
  const sickSubmissions = leaveReportRecords.filter((item) => isSickLeaveType(item.type));
  const withDocuments = sickSubmissions.filter((item) => item.supportingDocumentUrl).length;
  const pending = leaveReportRecords.filter((item) => item.status !== "approved" && item.status !== "rejected").length;

  const reportCards = [
    {
      label: "Total Leave Requests",
      value: String(leaveReportRecords.length),
      note: "Complete organization-wide leave history"
    },
    {
      label: "Sick Submissions",
      value: String(sickSubmissions.length),
      note: `${withDocuments} include doctor letters`
    },
    {
      label: "Pending Review",
      value: String(pending),
      note: "Requests still waiting for approval flow"
    }
  ];

  return (
    <AppShell
      title="Leave Report"
      actions={(
        <Link href="/attendance" className="secondary-button">
          Back to Attendance
        </Link>
      )}
    >
      <div className="space-y-6">
        {dataUnavailable ? (
          <div className="page-card border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
            Some leave report data is temporarily unavailable. The page is still loaded with the latest safe data.
          </div>
        ) : null}
        <section className="rounded-[20px] bg-[var(--primary)] px-6 py-6 text-white lg:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/68">HR Leave Report</p>
          <h2 className="mt-4 text-[28px] font-semibold leading-tight">Track leave requests and supporting medical files in one place.</h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-white/78">
            Use this report to review leave, half-day, and sick request trends, plus doctor letters attached to sick submissions.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {reportCards.map((item, index) => (
            <div key={item.label} className={index === 2 ? "page-card bg-[var(--primary)] p-5 text-white" : "page-card p-5"}>
              <p className={index === 2 ? "text-[12px] font-medium uppercase tracking-[0.08em] text-white/72" : "text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"}>{item.label}</p>
              <p className={index === 2 ? "mt-3 text-[30px] font-semibold leading-none" : "mt-3 text-[30px] font-semibold leading-none text-[var(--primary)]"}>{item.value}</p>
              <p className={index === 2 ? "mt-3 text-[14px] text-white/74" : "mt-3 text-[14px] text-[var(--text-muted)]"}>{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Coverage</p>
              </div>
            </div>
          </div>

          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Medical Files</p>
              </div>
            </div>
          </div>

          <div className="page-card p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-[14px] bg-[var(--panel-alt)] p-3 text-[var(--primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Review Focus</p>
              </div>
            </div>
          </div>
        </section>

        <LeaveReportTable employees={employees} records={leaveReportRecords} />
      </div>
    </AppShell>
  );
}
