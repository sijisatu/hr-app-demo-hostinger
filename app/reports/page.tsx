import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ReportCenter } from "@/components/reports/report-center";
import { requireSession } from "@/lib/auth";
import { getReportCenterOverview, normalizeReportPeriodPreset, type ReportPeriodPreset } from "@/lib/reporting";

const periodLabelMap: Record<ReportPeriodPreset, string> = {
  "current-month": "Current Period",
  "last-month": "Last Month",
  "last-3-months": "Last 3 Months",
  "year-to-date": "Year to Date",
  all: "All Time"
};

function PeriodAction({ period }: { period: ReportPeriodPreset }) {
  return (
    <details className="relative">
      <summary className="secondary-button list-none gap-3 cursor-pointer">
        <CalendarDays className="h-4 w-4" />
        <span>{periodLabelMap[period]}</span>
        <ChevronDown className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-[12px] border border-[var(--border)] bg-white p-2 shadow-lg">
        {Object.entries(periodLabelMap).map(([value, label]) => {
          const active = value === period;
          return (
            <Link
              key={value}
              href={`/reports?period=${value}`}
              className={`block rounded-[8px] px-3 py-2 text-[13px] ${active ? "bg-[var(--surface-muted)] font-semibold text-[var(--primary)]" : "text-[var(--text)] hover:bg-[var(--surface-muted)]"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  await requireSession(["admin", "hr", "manager"]);
  const params = (await searchParams) ?? {};
  const period = normalizeReportPeriodPreset(params.period);
  const overviewResult = await Promise.allSettled([getReportCenterOverview(period)]);
  const overview = overviewResult[0].status === "fulfilled"
    ? overviewResult[0].value
    : {
        period: {
          preset: period,
          label: "Unavailable",
          startDate: null,
          endDate: null
        },
        charts: {
          attendance: [],
          employeeCount: []
        },
        attendance: {
          metrics: [],
          topDepartments: [],
          anomalies: [],
          list: []
        },
        employees: {
          metrics: [],
          contractAlerts: [],
          departments: [],
          list: []
        },
        reimbursement: {
          metrics: [],
          pendingQueue: [],
          topClaims: [],
          list: []
        }
      };
  const dataUnavailable = overviewResult[0].status === "rejected";

  return (
    <AppShell
      title="Reports"
      actions={<PeriodAction period={period} />}
    >
      {dataUnavailable ? (
        <div className="page-card mb-6 border-[var(--warning)]/20 bg-[var(--warning-soft)] p-4 text-[14px] text-[var(--primary)]">
          Some report data is temporarily unavailable. The page is still loaded with the latest safe data.
        </div>
      ) : null}
      <ReportCenter overview={overview} />
    </AppShell>
  );
}
