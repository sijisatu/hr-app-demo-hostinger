"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, FileSpreadsheet, LoaderCircle, X } from "lucide-react";
import { InteractiveReportCharts } from "@/components/reports/interactive-report-charts";
import { formatReimbursementStatus } from "@/lib/api";
import { money } from "@/lib/payroll";
import { exportReport, toAssetUrl, type ReportCenterOverview, type ReportSnapshotMetric } from "@/lib/reporting";

type ReportCenterProps = {
  overview: ReportCenterOverview;
};

type ReportKey = "attendance" | "employees" | "reimbursement";

const reportNameMap: Record<ReportKey, string> = {
  attendance: "Attendance Report",
  employees: "Employee List Report",
  reimbursement: "Reimbursement Report"
};

export function ReportCenter({ overview }: ReportCenterProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<ReportKey | null>(null);

  const exportMutation = useMutation({
    mutationFn: (payload: {
      reportName: string;
      fileExtension: "xlsx";
      sheetName: string;
      columns: string[];
      rows: (string | number | null)[][];
    }) => exportReport(payload),
    onError: (error: Error) => setMessage(error.message)
  });

  const reportConfig = (key: ReportKey) => {
    if (key === "employees") {
      return {
        reportName: reportNameMap[key],
        fileExtension: "xlsx" as const,
        sheetName: "Employee List",
        columns: ["EMPLOYEE NUMBER", "NAME", "DEPARTMENT", "POSITION", "STATUS", "JOIN DATE"],
        rows: overview.employees.list.map((item) => [
          item.employeeNumber,
          item.name,
          item.department,
          item.position,
          item.status,
          item.joinDate
        ])
      };
    }

    if (key === "attendance") {
      return {
        reportName: reportNameMap[key],
        fileExtension: "xlsx" as const,
        sheetName: "Attendance",
        columns: ["EMPLOYEE", "ATTENDANCE DATE", "DESCRIPTION", "CHECK WINDOW", "GPS", "STATUS", "OVERTIME"],
        rows: overview.attendance.list.map((item) => [
          item.employee,
          item.attendanceDate,
          item.description,
          item.checkWindow,
          item.gps,
          item.status,
          item.overtime
        ])
      };
    }

    return {
      reportName: reportNameMap[key],
      fileExtension: "xlsx" as const,
      sheetName: "Reimbursement",
      columns: ["EMPLOYEE", "DEPARTMENT", "CLAIM TYPE", "RECEIPT DATE", "AMOUNT", "STATUS"],
      rows: overview.reimbursement.list.map((item) => [
        item.employee,
        item.department,
        item.claimType,
        item.receiptDate,
        item.amount,
        item.status
      ])
    };
  };

  const handleDownloadReport = (key: ReportKey) => {
    exportMutation.mutate(
      reportConfig(key),
      {
        onSuccess: (result) => {
          const fileUrl = toAssetUrl(result.fileUrl);
          setMessage(fileUrl ? `Report is ready to download: ${fileUrl}` : "Report generated successfully.");
          if (fileUrl) {
            window.open(fileUrl, "_blank", "noopener,noreferrer");
          }
          setPreviewKey(null);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="page-card p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Generate HR Reports</p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">Current filter: {overview.period.label}</p>
          </div>
          <FileSpreadsheet className="h-7 w-7 text-[var(--primary)]" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <button className="primary-button w-full" disabled={exportMutation.isPending} onClick={() => setPreviewKey("attendance")}>
            <Download className="h-4 w-4" />
            Attendance Report
          </button>
          <button className="primary-button w-full" disabled={exportMutation.isPending} onClick={() => setPreviewKey("employees")}>
            <Download className="h-4 w-4" />
            Employee List Report
          </button>
          <button className="primary-button w-full" disabled={exportMutation.isPending} onClick={() => setPreviewKey("reimbursement")}>
            <Download className="h-4 w-4" />
            Reimbursement Report
          </button>
        </div>
      </div>

      <InteractiveReportCharts attendance={overview.charts.attendance} employeeCount={overview.charts.employeeCount} />

      <div className="space-y-6">
        <ModuleSection
          title="Attendance Report"
          subtitle="Punctuality, GPS compliance, department performance, and operational anomalies."
          metrics={overview.attendance.metrics}
          action={<ExportButton pending={exportMutation.isPending} onClick={() => setPreviewKey("attendance")} />}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <MetricListCard title="Top Departments">
              {overview.attendance.topDepartments.map((item) => (
                <div key={item.name}>
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="font-medium text-[var(--text)]">{item.name}</span>
                    <span className="text-[var(--text-muted)]">{item.value}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[var(--surface-soft)]">
                    <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </MetricListCard>

            <MetricListCard title="Anomalies">
              {overview.attendance.anomalies.map((item) => (
                <div key={item.title} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                  <p className="text-[15px] font-semibold text-[var(--text)]">{item.title}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.note}</p>
                </div>
              ))}
            </MetricListCard>
          </div>
        </ModuleSection>

        <ModuleSection
          title="Employee Report"
          subtitle="Org structure, contract monitoring, and headcount mix."
          metrics={overview.employees.metrics}
          action={<ExportButton pending={exportMutation.isPending} onClick={() => setPreviewKey("employees")} />}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <MetricListCard title="Contract Alerts">
              {overview.employees.contractAlerts.map((item) => (
                <div key={`${item.employeeName}-${item.status}`} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                  <p className="text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">{item.status} | {item.note}</p>
                </div>
              ))}
            </MetricListCard>

            <MetricListCard title="Department Headcount">
              {overview.employees.departments.map((item, index) => (
                <div key={`${item.name}-${item.headcount}-${index}`} className="flex items-center justify-between rounded-[12px] border border-[var(--border)] bg-white px-4 py-3">
                  <span className="text-[14px] font-medium text-[var(--text)]">{item.name}</span>
                  <span className="text-[14px] font-semibold text-[var(--primary)]">{item.headcount}</span>
                </div>
              ))}
            </MetricListCard>
          </div>
        </ModuleSection>

        <ModuleSection
          title="Reimbursement Report"
          subtitle="Claim request visibility, pending approvals, and high-value reimbursement monitoring."
          metrics={overview.reimbursement.metrics}
          action={<ExportButton pending={exportMutation.isPending} onClick={() => setPreviewKey("reimbursement")} />}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <MetricListCard title="Pending Queue">
              {overview.reimbursement.pendingQueue.map((item, index) => (
                <div key={`${item.employeeName}-${item.claimType}-${item.amount}-${item.status}-${index}`} className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                  <p className="text-[15px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                    {item.claimType} | {formatReimbursementStatus(item.status)} | {money(item.amount)}
                  </p>
                </div>
              ))}
            </MetricListCard>

            <MetricListCard title="Top Claim Amount">
              {overview.reimbursement.topClaims.map((item, index) => (
                <div key={`${item.employeeName}-${item.department}-${item.amount}-${index}`} className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[var(--text)]">{item.employeeName}</p>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">{item.department}</p>
                  </div>
                  <span className="text-[14px] font-semibold text-[var(--primary)]">{money(item.amount)}</span>
                </div>
              ))}
            </MetricListCard>
          </div>
        </ModuleSection>
      </div>

      {message ? <div className="page-card p-4 text-[14px] text-[var(--text-muted)] whitespace-pre-wrap break-words">{message}</div> : null}

      {previewKey ? (
        <ReportPreviewModal
          reportKey={previewKey}
          overview={overview}
          pending={exportMutation.isPending}
          onClose={() => setPreviewKey(null)}
          onDownload={() => handleDownloadReport(previewKey)}
        />
      ) : null}
    </div>
  );
}

function ReportPreviewModal({
  reportKey,
  overview,
  pending,
  onClose,
  onDownload
}: {
  reportKey: ReportKey;
  overview: ReportCenterOverview;
  pending: boolean;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.52)] p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Preview {reportNameMap[reportKey]}</p>
          </div>
          <button className="secondary-button !min-h-10 !w-10 !rounded-full !p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-auto bg-[var(--surface-muted)] p-6">
          {reportKey === "attendance" ? <AttendancePreview overview={overview} /> : null}
          {reportKey === "employees" ? <EmployeePreview overview={overview} /> : null}
          {reportKey === "reimbursement" ? <ReimbursementPreview overview={overview} /> : null}
        </div>

        <div className="flex justify-end border-t border-[var(--border)] px-6 py-4">
          <button className="primary-button" disabled={pending} onClick={onDownload}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendancePreview({ overview }: { overview: ReportCenterOverview }) {
  return (
    <PreviewTable
      title="Attendance"
      headers={["EMPLOYEE", "ATTENDANCE DATE", "DESCRIPTION", "CHECK WINDOW", "GPS", "STATUS", "OVERTIME"]}
      rows={overview.attendance.list.map((item) => [item.employee, item.attendanceDate, item.description, item.checkWindow, item.gps, item.status, item.overtime])}
    />
  );
}

function EmployeePreview({ overview }: { overview: ReportCenterOverview }) {
  return (
    <PreviewTable
      title="Employee List"
      headers={["EMPLOYEE NUMBER", "NAME", "DEPARTMENT", "POSITION", "STATUS", "JOIN DATE"]}
      rows={overview.employees.list.map((item) => [item.employeeNumber, item.name, item.department, item.position, item.status, item.joinDate])}
    />
  );
}

function ReimbursementPreview({ overview }: { overview: ReportCenterOverview }) {
  return (
    <PreviewTable
      title="Reimbursement"
      headers={["EMPLOYEE", "DEPARTMENT", "CLAIM TYPE", "RECEIPT DATE", "AMOUNT", "STATUS"]}
      rows={overview.reimbursement.list.map((item) => [
        item.employee,
        item.department,
        item.claimType,
        item.receiptDate,
        item.amount,
        formatReimbursementStatus(item.status)
      ])}
    />
  );
}

function PreviewTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="page-card p-4">
      <p className="mb-3 text-[16px] font-semibold text-[var(--primary)]">{title}</p>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-muted)]">
              {headers.map((header) => (
                <th key={header} className="border border-[var(--border)] px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${index}-${cellIndex}`} className="border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--text)]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModuleSection({ title, subtitle, metrics, action, children }: { title: string; subtitle: string; metrics: ReportSnapshotMetric[]; action: ReactNode; children: ReactNode }) {
  return (
    <section className="page-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">{title}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {metrics.map((item) => (
          <div key={item.label} className="panel-muted p-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-3 text-[24px] font-semibold text-[var(--primary)]">{item.value}</p>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">{item.note}</p>
          </div>
        ))}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function MetricListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel-muted p-5">
      <p className="text-[18px] font-semibold text-[var(--primary)]">{title}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function ExportButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button className="secondary-button" onClick={onClick} disabled={pending}>
      <Download className="h-4 w-4" />
      Preview Download
    </button>
  );
}
