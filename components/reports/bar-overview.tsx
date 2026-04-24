import type { AttendanceSeriesItem } from "@/lib/api";

export function BarOverview({ series }: { series: AttendanceSeriesItem[] }) {
  const max = Math.max(...series.map((item) => item.present), 1);

  return (
    <div className="page-card p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="section-title text-[24px] font-semibold text-[var(--primary)]">Monthly Attendance Trend</p>
          <p className="mt-1 text-[14px] text-[var(--text-muted)]">Aggregate daily presence.</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex rounded-full bg-[var(--primary)] px-3 py-1.5 text-[12px] font-semibold text-white">Present</span>
          <span className="inline-flex rounded-full bg-[var(--surface-soft)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-muted)]">Absent</span>
        </div>
      </div>

      <div className="grid h-[320px] grid-cols-7 items-end gap-4">
        {series.map((item) => (
          <div key={item.label} className="flex h-full flex-col items-center justify-end gap-3">
            <div className="flex h-full w-full items-end rounded-[12px] bg-[var(--surface-muted)] px-2">
              <div className="w-full rounded-t-[10px] bg-[var(--primary)]" style={{ height: `${Math.max((item.present / max) * 100, 14)}%` }} />
            </div>
            <span className="text-[12px] font-medium text-[var(--text-muted)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

