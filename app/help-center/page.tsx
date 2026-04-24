import Image from "next/image";
import Link from "next/link";
import { BookOpen, Download, ExternalLink, FileText, LifeBuoy, MonitorSmartphone } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";

const screenshotCards = [
  { title: "Login", src: "/help-center/screenshots/login.png" },
  { title: "HR Dashboard", src: "/help-center/screenshots/dashboard-hr.png" },
  { title: "Employee Dashboard", src: "/help-center/screenshots/dashboard-employee.png" },
  { title: "Employees", src: "/help-center/screenshots/employees.png" },
  { title: "Add Employee Personal Info", src: "/help-center/screenshots/employee-add-personal.png" },
  { title: "Add Employee Job Details", src: "/help-center/screenshots/employee-add-job.png" },
  { title: "Add Employee Financial Details", src: "/help-center/screenshots/employee-add-financial.png" },
  { title: "Add Employee Documents", src: "/help-center/screenshots/employee-add-documents.png" },
  { title: "Attendance Hub", src: "/help-center/screenshots/attendance-hub.png" },
  { title: "On Duty Request", src: "/help-center/screenshots/attendance-on-duty.png" },
  { title: "Sick Submission", src: "/help-center/screenshots/attendance-sick.png" },
  { title: "Leave Request", src: "/help-center/screenshots/attendance-leave.png" },
  { title: "Half Day Leave", src: "/help-center/screenshots/attendance-half-day.png" },
  { title: "Submit Overtime", src: "/help-center/screenshots/attendance-overtime.png" },
  { title: "Leave Balance", src: "/help-center/screenshots/attendance-leave-balance.png" },
  { title: "Attendance Report", src: "/help-center/screenshots/attendance-team-report.png" },
  { title: "Leave Report", src: "/help-center/screenshots/attendance-leave-report.png" },
  { title: "Leave System", src: "/help-center/screenshots/leave-system.png" },
  { title: "Reimbursement", src: "/help-center/screenshots/reimbursement.png" },
  { title: "Reports", src: "/help-center/screenshots/reports.png" },
  { title: "Activity Logs", src: "/help-center/screenshots/activity-logs.png" },
  { title: "Profile", src: "/help-center/screenshots/profile.png" },
  { title: "Self-Service", src: "/help-center/screenshots/self-service.png" },
  { title: "Help Center", src: "/help-center/screenshots/help-center.png" }
] as const;

const moduleGuides = [
  {
    title: "Getting Started",
    description: "Sign in with employee credentials or use demo accounts for role-based walkthroughs."
  },
  {
    title: "Employee Operations",
    description: "Clock in, clock out, submit leave, overtime, sick leave, on-duty requests, and reimbursement."
  },
  {
    title: "HR Administration",
    description: "Manage employee records, documents, reports, and audit visibility."
  },
  {
    title: "Manager Review",
    description: "Use notifications and approval views to process pending team requests quickly."
  }
] as const;

export default async function HelpCenterPage() {
  await requireSession(["admin", "hr", "manager", "employee"]);

  return (
    <AppShell title="Help Center">
      <div className="space-y-6">
        <section className="page-card overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="bg-[linear-gradient(180deg,rgba(20,43,87,0.05),rgba(20,43,87,0.01))] p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">
                <LifeBuoy className="h-4 w-4" />
                User Guide
              </div>
              <h2 className="section-title mt-4 text-[32px] font-semibold tracking-[-0.04em] text-[var(--primary)] sm:text-[38px]">
                Learn every core workflow in Pralux HR-App
              </h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[var(--text-muted)]">
                Open the browser version for quick reading or download the PDF guide for onboarding, demos, and internal training.
                The guide covers login, dashboard, employees, attendance, leave, reimbursement, reports, notifications, and activity logs.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/help-center/user-guide.html" target="_blank" className="primary-button">
                  <BookOpen className="h-4 w-4" />
                  Open Guide
                </Link>
                <Link href="/help-center/user-guide.pdf" target="_blank" className="secondary-button">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Link>
              </div>
            </div>

            <div className="border-l border-[var(--border)] bg-[var(--surface-muted)] p-6">
              <div className="panel-muted p-5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Included</p>
                <div className="mt-4 space-y-4">
                  {moduleGuides.map((item) => (
                    <div key={item.title}>
                      <p className="text-[15px] font-semibold text-[var(--primary)]">{item.title}</p>
                      <p className="mt-1 text-[14px] leading-6 text-[var(--text-muted)]">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="page-card p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[17px] font-semibold text-[var(--primary)]">Complete Guide</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">Role-based instructions for HR, Admin, Manager, and Employee users.</p>
          </div>
          <div className="page-card p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <MonitorSmartphone className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[17px] font-semibold text-[var(--primary)]">Screenshot Coverage</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">Visual references for login, dashboard, employees, attendance, leave, reports, and self-service.</p>
          </div>
          <div className="page-card p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <ExternalLink className="h-5 w-5" />
            </div>
            <p className="mt-4 text-[17px] font-semibold text-[var(--primary)]">Download Ready</p>
            <p className="mt-2 text-[14px] leading-6 text-[var(--text-muted)]">Use the PDF version for demos, onboarding sessions, and offline distribution.</p>
          </div>
        </div>

        <section className="page-card p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-title text-[26px] font-semibold text-[var(--primary)]">Screenshot Overview</p>
              <p className="mt-2 text-[14px] text-[var(--text-muted)]">Core screens included in the PDF and online guide.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {screenshotCards.map((item) => (
              <figure key={item.title} className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface-muted)]">
                <div className="relative aspect-[16/10]">
                  <Image src={item.src} alt={`${item.title} screenshot`} fill className="object-cover object-top" />
                </div>
                <figcaption className="border-t border-[var(--border)] px-4 py-3 text-[14px] font-medium text-[var(--primary)]">
                  {item.title}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
